import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from auth import get_current_user
from database import get_board_for_user, save_board_for_user
from models import AIChatResponse, BoardData, ChatRequest

# Ensure environment variables from root .env or backend .env are loaded
load_dotenv(Path(__file__).parent.parent / ".env")
load_dotenv(Path(__file__).parent / ".env")

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "deepseek/deepseek-v4-flash-0731"

router = APIRouter(prefix="/api/ai", tags=["ai"])


def get_api_key() -> str:
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OPENROUTER_API_KEY is not configured.",
        )
    return key


async def call_openrouter(
    messages: List[Dict[str, str]],
    model: str = DEFAULT_MODEL,
    response_format: Optional[Dict[str, Any]] = None,
    temperature: float = 0.2,
) -> Dict[str, Any]:
    api_key = get_api_key()
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Kanban Studio",
    }

    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }

    if response_format:
        payload["response_format"] = response_format

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            OPENROUTER_API_URL,
            headers=headers,
            json=payload,
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"OpenRouter API error: {response.text}",
            )

        return response.json()


def parse_structured_response(raw_text: str) -> AIChatResponse:
    # Clean code fences if present
    cleaned = raw_text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
    if match:
        cleaned = match.group(1).strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        # Fallback if model returned plain text instead of JSON
        return AIChatResponse(message=raw_text, board=None)

    message = data.get("message", "")
    board_data = data.get("board")

    validated_board: Optional[BoardData] = None
    if board_data and isinstance(board_data, dict):
        try:
            validated_board = BoardData.model_validate(board_data)
        except Exception:
            validated_board = None

    return AIChatResponse(message=message or raw_text, board=validated_board)


@router.post("/test")
async def test_ai(current_user: str = Depends(get_current_user)):
    messages = [
        {"role": "user", "content": "What is 2+2? Answer with only the digit."}
    ]
    data = await call_openrouter(messages=messages)
    content = data["choices"][0]["message"]["content"].strip()
    return {
        "status": "ok",
        "model": DEFAULT_MODEL,
        "response": content,
    }


@router.post("/chat", response_model=AIChatResponse)
async def chat_ai(
    req: ChatRequest, current_user: str = Depends(get_current_user)
):
    current_board = req.board or get_board_for_user(current_user)
    board_json_str = json.dumps(current_board.model_dump(), indent=2)

    system_prompt = f"""You are an intelligent AI assistant embedded into a Kanban Project Management web app.
You help the user manage their tasks, reorder cards, add/remove cards, rename columns, and provide productivity suggestions.

CURRENT KANBAN BOARD STATE (JSON):
{board_json_str}

CRITICAL RULES:
1. ALWAYS respond in valid JSON matching this schema:
{{
  "message": "Friendly explanation of what you did or the answer to user's question.",
  "board": null OR {{ "columns": [...], "cards": {{...}} }}
}}
2. If the user asks you to modify the board (e.g. create a card, move a card, delete a card, edit card details, rename columns):
   - You MUST return the COMPLETE updated BoardData in the "board" field.
   - For new cards, generate a unique id like "card-ai-1", "card-ai-2" or similar.
   - Ensure all card IDs in "columns[].cardIds" exist in the "cards" dictionary.
   - Keep all existing columns and unedited cards intact unless requested otherwise.
3. If the user asks a general question or no board modification is required:
   - Set "board": null.
   - Provide your answer in the "message" field.
"""

    llm_messages = [{"role": "system", "content": system_prompt}]
    for msg in req.messages:
        llm_messages.append({"role": msg.role, "content": msg.content})

    openrouter_response = await call_openrouter(
        messages=llm_messages,
        response_format={"type": "json_object"},
    )

    raw_content = openrouter_response["choices"][0]["message"]["content"]
    parsed_response = parse_structured_response(raw_content)

    # If board was modified by AI, persist it automatically in SQLite
    if parsed_response.board:
        save_board_for_user(current_user, parsed_response.board)

    return parsed_response
