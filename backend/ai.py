import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from auth import get_current_user

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
