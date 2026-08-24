import secrets
from typing import Dict
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer()

# In-memory active tokens for MVP session management
ACTIVE_TOKENS: Dict[str, str] = {}


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
async def login(req: LoginRequest):
    if req.username == "user" and req.password == "password":
        token = secrets.token_hex(24)
        ACTIVE_TOKENS[token] = req.username
        return TokenResponse(access_token=token, token_type="bearer", username=req.username)
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
