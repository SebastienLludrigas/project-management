import json
import os
from unittest.mock import patch
import pytest
from httpx import ASGITransport, AsyncClient
from main import app
from database import init_db, get_board_for_user


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    test_db = tmp_path / "test_kanban.db"
    monkeypatch.setenv("DATABASE_PATH", str(test_db))
    init_db()


@pytest.mark.asyncio
async def test_ai_chat_requires_auth():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        res = await client.post(
            "/api/ai/chat",
            json={"messages": [{"role": "user", "content": "Hello"}]},
        )
        assert res.status_code == 401


@pytest.mark.asyncio
async def test_ai_chat_conversational_response_mocked():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Login
        login_res = await client.post(
            "/api/auth/login",
            json={"username": "user", "password": "password"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        mock_payload = {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": json.dumps(
                            {
                                "message": "Here is some productivity advice.",
                                "board": None,
                            }
                        ),
                    }
                }
            ]
        }

        with patch("ai.call_openrouter", return_value=mock_payload):
            res = await client.post(
                "/api/ai/chat",
                headers=headers,
                json={
                    "messages": [
                        {
                            "role": "user",
                            "content": "Can you give me project advice?",
                        }
                    ]
                },
            )
            assert res.status_code == 200
            data = res.json()
            assert data["message"] == "Here is some productivity advice."
            assert data["board"] is None


@pytest.mark.asyncio
async def test_ai_chat_board_mutation_mocked():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Login
        login_res = await client.post(
            "/api/auth/login",
            json={"username": "user", "password": "password"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Initialize board
        await client.get("/api/board", headers=headers)

        updated_mock_board = {
            "columns": [
                {
                    "id": "col-backlog",
                    "title": "Backlog",
                    "cardIds": ["card-1", "card-ai-new"],
                },
                {"id": "col-discovery", "title": "Discovery", "cardIds": []},
                {"id": "col-progress", "title": "In Progress", "cardIds": []},
                {"id": "col-review", "title": "Review", "cardIds": []},
                {"id": "col-done", "title": "Done", "cardIds": []},
            ],
            "cards": {
                "card-1": {
                    "id": "card-1",
                    "title": "Existing card",
                    "details": "",
                },
                "card-ai-new": {
                    "id": "card-ai-new",
                    "title": "AI generated task",
                    "details": "Created by assistant.",
                },
            },
        }

        mock_payload = {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": json.dumps(
                            {
                                "message": "I added 'AI generated task' to Backlog.",
                                "board": updated_mock_board,
                            }
                        ),
                    }
                }
            ]
        }

        with patch("ai.call_openrouter", return_value=mock_payload):
            res = await client.post(
                "/api/ai/chat",
                headers=headers,
                json={
                    "messages": [
                        {
                            "role": "user",
                            "content": "Add an AI generated task to Backlog.",
                        }
                    ]
                },
            )
            assert res.status_code == 200
            data = res.json()
            assert "AI generated task" in data["message"]
            assert data["board"] is not None
            assert "card-ai-new" in data["board"]["cards"]

            # Verify SQLite persistence
            persisted_board = get_board_for_user("user")
            assert "card-ai-new" in persisted_board.cards


@pytest.mark.asyncio
async def test_live_ai_chat_board_mutation():
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key or api_key.startswith("sk-or-placeholder") or api_key == "your-key-here":
        pytest.skip("OPENROUTER_API_KEY not configured for live chat test.")

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        login_res = await client.post(
            "/api/auth/login",
            json={"username": "user", "password": "password"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Seed initial board
        await client.get("/api/board", headers=headers)

        res = await client.post(
            "/api/ai/chat",
            headers=headers,
            json={
                "messages": [
                    {
                        "role": "user",
                        "content": "Please create a new card with title 'Deploy to Staging' and add it to the 'Review' column.",
                    }
                ]
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert len(data["message"]) > 0
        assert data["board"] is not None

        # Assert card was added
        card_titles = [c["title"] for c in data["board"]["cards"].values()]
        assert any("Deploy to Staging" in title for title in card_titles)

        # Assert DB persisted
        persisted = get_board_for_user("user")
        persisted_titles = [c.title for c in persisted.cards.values()]
        assert any("Deploy to Staging" in title for title in persisted_titles)
