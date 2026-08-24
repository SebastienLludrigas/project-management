import os
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
async def test_board_requires_authentication():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # GET requires auth
        get_res = await client.get("/api/board")
        assert get_res.status_code == 401

        # PUT requires auth
        put_res = await client.put("/api/board", json={"columns": [], "cards": {}})
        assert put_res.status_code == 401


@pytest.mark.asyncio
async def test_get_board_seeds_initial_data():
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

        # Fetch board
        board_res = await client.get("/api/board", headers=headers)
        assert board_res.status_code == 200
        board = board_res.json()
        assert len(board["columns"]) == 5
        assert len(board["cards"]) == 8
        assert board["columns"][0]["title"] == "Backlog"


@pytest.mark.asyncio
async def test_put_and_get_board_persistence():
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

        # Update board
        modified_board = {
            "columns": [
                {"id": "col-todo", "title": "To Do", "cardIds": ["card-new-1"]},
                {"id": "col-done", "title": "Done", "cardIds": []},
            ],
            "cards": {
                "card-new-1": {
                    "id": "card-new-1",
                    "title": "Custom persisted card",
                    "details": "Details here.",
                }
            },
        }

        put_res = await client.put("/api/board", headers=headers, json=modified_board)
        assert put_res.status_code == 200
        saved = put_res.json()
        assert len(saved["columns"]) == 2
        assert saved["columns"][0]["title"] == "To Do"

        # Fetch again to assert persistence
        get_res = await client.get("/api/board", headers=headers)
        assert get_res.status_code == 200
        fetched = get_res.json()
        assert len(fetched["columns"]) == 2
        assert fetched["cards"]["card-new-1"]["title"] == "Custom persisted card"
