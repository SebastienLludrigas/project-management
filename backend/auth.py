import secrets
import time
from collections import defaultdict
from typing import Dict, List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer()

# In-memory active tokens for MVP session management
ACTIVE_TOKENS: Dict[str, str] = {}

# In-memory failed login attempts per client IP, for basic brute-force protection
FAILED_LOGIN_ATTEMPTS: Dict[str, List[float]] = defaultdict(list)
MAX_FAILED_LOGIN_ATTEMPTS = 5
FAILED_LOGIN_WINDOW_SECONDS = 60


def _is_rate_limited(client_ip: str) -> bool:
    now = time.time()
    attempts = FAILED_LOGIN_ATTEMPTS[client_ip]
    attempts[:] = [t for t in attempts if now - t < FAILED_LOGIN_WINDOW_SECONDS]
    return len(attempts) >= MAX_FAILED_LOGIN_ATTEMPTS


def _register_failed_login(client_ip: str) -> None:
    FAILED_LOGIN_ATTEMPTS[client_ip].append(time.time())


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


class UserResponse(BaseModel):
    username: str


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    if _is_rate_limited(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later.",
        )

    if req.username == "user" and req.password == "password":
        token = secrets.token_hex(24)
        ACTIVE_TOKENS[token] = req.username
        return TokenResponse(access_token=token, token_type="bearer", username=req.username)

    _register_failed_login(client_ip)
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid username or password",
    )


@router.post("/logout")
async def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    ACTIVE_TOKENS.pop(token, None)
    return {"message": "Logged out successfully"}


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    token = credentials.credentials
    username = ACTIVE_TOKENS.get(token)
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return username


@router.get("/me", response_model=UserResponse)
async def get_me(username: str = Depends(get_current_user)):
    return UserResponse(username=username)
