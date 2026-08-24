import pytest
from httpx import ASGITransport, AsyncClient
from main import app


@pytest.mark.asyncio
async def test_login_success():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/auth/login",
            json={"username": "user", "password": "password"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["username"] == "user"


@pytest.mark.asyncio
async def test_login_failure():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/auth/login",
            json={"username": "wrong_user", "password": "wrong_password"},
        )
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_authenticated_me_flow():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Unauthenticated request fails
        unauth_resp = await client.get("/api/auth/me")
        assert unauth_resp.status_code == 401

        # Login
        login_resp = await client.post(
            "/api/auth/login",
            json={"username": "user", "password": "password"},
        )
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Authenticated /me succeeds
        me_resp = await client.get("/api/auth/me", headers=headers)
        assert me_resp.status_code == 200
        assert me_resp.json() == {"username": "user"}

        # Logout
        logout_resp = await client.post("/api/auth/logout", headers=headers)
        assert logout_resp.status_code == 200

        # After logout, token is invalidated
        after_logout_resp = await client.get("/api/auth/me", headers=headers)
        assert after_logout_resp.status_code == 401
