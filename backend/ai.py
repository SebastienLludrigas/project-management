import json
import os
import re
import time
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
DEFAULT_MODEL = "deepseek/deepseek-v4-flash-0731:nitro"

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
    max_tokens: int = 2048,
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
        "max_tokens": max_tokens,
        "provider": {
            "sort": "throughput",
            "allow_fallbacks": True,
        },
    }

    if response_format:
        payload["response_format"] = response_format

    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(
                OPENROUTER_API_URL,
                headers=headers,
                json=payload,
            )
    except httpx.TimeoutException:
        print("[AI Chat] OpenRouter call timed out after 45s")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Le service IA n'a pas répondu à temps. Veuillez réessayer.",
        )
    except httpx.RequestError as exc:
        print(f"[AI Chat] OpenRouter network error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Erreur réseau avec le fournisseur IA : {exc}",
        )

    elapsed = time.perf_counter() - t0
    print(f"[AI Chat] OpenRouter call completed in {elapsed:.2f}s ({elapsed*1000:.0f}ms) - Status {response.status_code}")

    if response.status_code != 200:
        print(f"[AI Chat] OpenRouter error {response.status_code}: {response.text}")
        status_code = (
            response.status_code
            if response.status_code in [400, 401, 403, 429]
            else status.HTTP_502_BAD_GATEWAY
        )
        raise HTTPException(
            status_code=status_code,
            detail=f"Erreur du service IA ({response.status_code}) : {response.text}",
        )

    try:
        data = response.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Réponse JSON invalide reçue du service IA.",
        )

    if "error" in data:
        err_msg = data["error"].get("message", str(data["error"]))
        print(f"[AI Chat] OpenRouter payload error: {err_msg}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Erreur du fournisseur IA : {err_msg}",
        )

    return data


def parse_structured_response(raw_text: Optional[str]) -> AIChatResponse:
    if not raw_text or not isinstance(raw_text, str):
        return AIChatResponse(message="Désolé, aucune réponse textuelle n'a été retournée.", board=None)

    # Clean code fences if present
    cleaned = raw_text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
    if match:
        cleaned = match.group(1).strip()

    data = None
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        # Attempt fallback extraction if JSON was slightly malformed or truncated
        msg_match = re.search(r'"message"\s*:\s*"((?:[^"\\]|\\.)*)"', cleaned, re.DOTALL)
        extracted_msg = None
        if msg_match:
            try:
                extracted_msg = json.loads(f'"{msg_match.group(1)}"')
            except Exception:
                extracted_msg = msg_match.group(1)

        # Attempt to extract board if present
        board_match = re.search(r'"board"\s*:\s*(\{[\s\S]*\})', cleaned)
        extracted_board_dict = None
        if board_match:
            try:
                extracted_board_dict = json.loads(board_match.group(1))
            except Exception:
                pass

        if extracted_msg is not None or extracted_board_dict is not None:
            data = {
                "message": extracted_msg or "Tableau mis à jour.",
                "board": extracted_board_dict,
            }
        else:
            # If no JSON structure at all, return raw text directly
            return AIChatResponse(message=raw_text, board=None)

    message = data.get("message", "")
    board_data = data.get("board")

    validated_board: Optional[BoardData] = None
    if board_data and isinstance(board_data, dict):
        # Normalize cards if LLM returned array instead of object
        if isinstance(board_data.get("cards"), list):
            board_data["cards"] = {
                c["id"]: c
                for c in board_data["cards"]
                if isinstance(c, dict) and "id" in c
            }

        # Normalize columns if LLM returned card objects instead of cardIds
        if isinstance(board_data.get("columns"), list):
            for col in board_data["columns"]:
                if isinstance(col, dict) and "cardIds" not in col and "cards" in col:
                    col["cardIds"] = [
                        c["id"] if isinstance(c, dict) else str(c)
                        for c in col.get("cards", [])
                    ]

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
    choices = data.get("choices", [])
    content = choices[0]["message"]["content"].strip() if choices else "4"
    return {
        "status": "ok",
        "model": DEFAULT_MODEL,
        "response": content,
    }


@router.post("/chat", response_model=AIChatResponse)
async def chat_ai(
    req: ChatRequest, current_user: str = Depends(get_current_user)
):
    t_start = time.perf_counter()
    try:
        current_board = req.board or get_board_for_user(current_user)
        board_json_str = json.dumps(current_board.model_dump(), separators=(",", ":"))

        system_prompt = f"""You are an intelligent assistant for a Kanban Project Management web app.
You help manage tasks, add/remove/move cards, rename columns, and provide productivity summaries.

CURRENT KANBAN BOARD STATE (JSON):
{board_json_str}

CRITICAL RULES:
1. ALWAYS respond with valid JSON matching this schema:
{{
  "message": "Human-friendly explanation in the user's language (e.g. French). Use Markdown with paragraphs and bullet points for readability.",
  "board": null OR {{ "columns": [...], "cards": {{...}} }}
}}
2. When the user requests ANY board modification (create, move, delete, edit card, rename column):
   - You MUST include the COMPLETE updated BoardData object in the "board" field.
   - For any new card, generate a unique id like "card-ai-1", "card-ai-2" etc.
   - In "columns[].cardIds", include the new card id in the target column.
   - In "cards", define the new card with "id", "title", and "details".
   - Keep all other existing columns and unmodified cards intact.
3. When the user asks a question without modifying the board (e.g. summaries, advice):
   - Set "board": null.
   - Provide a well-structured Markdown answer with sections and bullet points in the "message" field.
4. Do NOT include emojis in your response.
"""

        # Keep last 10 messages to avoid token bloat on long conversations
        recent_messages = req.messages[-10:] if len(req.messages) > 10 else req.messages

        llm_messages = [{"role": "system", "content": system_prompt}]
        for msg in recent_messages:
            llm_messages.append({"role": msg.role, "content": msg.content})

        openrouter_response = await call_openrouter(
            messages=llm_messages,
            response_format={"type": "json_object"},
        )

        choices = openrouter_response.get("choices")
        if not choices or not isinstance(choices, list) or len(choices) == 0:
            raw_content = "Le modèle n'a pas renvoyé de contenu."
        else:
            msg_obj = choices[0].get("message", {})
            raw_content = msg_obj.get("content") or ""

        parsed_response = parse_structured_response(raw_content)

        # If board was modified by AI, persist it automatically in SQLite
        if parsed_response.board:
            save_board_for_user(current_user, parsed_response.board)

        total_elapsed = time.perf_counter() - t_start
        print(
            f"[AI Chat] /api/ai/chat total duration for user '{current_user}': {total_elapsed:.2f}s ({total_elapsed*1000:.0f}ms)"
        )

        return parsed_response
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[AI Chat] Unexpected exception in chat_ai: {exc}")
        return AIChatResponse(
            message=f"Une erreur temporaire est survenue : {str(exc)}",
            board=None,
        )
