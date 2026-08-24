import os
from unittest.mock import patch
import pytest
from httpx import ASGITransport, AsyncClient
from main import app
from database import init_db


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    test_db = tmp_path / "test_kanban.db"
    monkeypatch.setenv("DATABASE_PATH", str(test_db))
    init_db()


@pytest.mark.asyncio
async def test_ai_test_requires_authentication():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        res = await client.post("/api/ai/test")
        assert res.status_code == 401


@pytest.mark.asyncio
async def test_ai_test_mocked_success():
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

        mock_openrouter_payload = {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "4",
                    }
                }
            ]
        }

        with patch(
            "ai.call_openrouter",
            return_value=mock_openrouter_payload,
        ):
            res = await client.post("/api/ai/test", headers=headers)
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "ok"
            assert data["response"] == "4"
            assert "deepseek/deepseek-v4-flash-0731" in data["model"]


@pytest.mark.asyncio
async def test_live_openrouter_connectivity():
    # Only run live call if OPENROUTER_API_KEY is available and not a placeholder
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key or api_key.startswith("sk-or-placeholder") or api_key == "your-key-here":
        pytest.skip("OPENROUTER_API_KEY is not configured for live testing.")

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        login_res = await client.post(
            "/api/auth/login",
            json={"username": "user", "password": "password"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        res = await client.post("/api/ai/test", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert "4" in data["response"]
