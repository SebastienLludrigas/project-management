from fastapi import APIRouter, Depends
from auth import get_current_user
from database import get_board_for_user, save_board_for_user
from models import BoardData

router = APIRouter(prefix="/api/board", tags=["board"])


@router.get("", response_model=BoardData)
async def get_board(current_user: str = Depends(get_current_user)):
    return get_board_for_user(current_user)


@router.put("", response_model=BoardData)
async def update_board(
    board: BoardData, current_user: str = Depends(get_current_user)
):
    return save_board_for_user(current_user, board)
