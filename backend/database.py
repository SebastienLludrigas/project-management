import json
import os
import sqlite3
from pathlib import Path
from typing import Optional

from models import BoardData, INITIAL_BOARD_DATA


def get_db_path() -> Path:
    env_path = os.environ.get("DATABASE_PATH")
    if env_path:
        db_path = Path(env_path)
    else:
        # Default to data/kanban.db at project root or under backend/data
        db_path = Path(__file__).parent.parent / "data" / "kanban.db"

    db_path.parent.mkdir(parents=True, exist_ok=True)
    return db_path


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(get_db_path()))
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS boards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL,
                data TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TRIGGER IF NOT EXISTS update_boards_timestamp
            AFTER UPDATE ON boards
            FOR EACH ROW
            BEGIN
                UPDATE boards SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
            END;
            """
        )
        conn.commit()


def get_or_create_user(username: str) -> int:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
        row = cursor.fetchone()
        if row:
            return row["id"]
        cursor.execute("INSERT INTO users (username) VALUES (?)", (username,))
        conn.commit()
        return cursor.lastrowid


def get_board_for_user(username: str) -> BoardData:
    user_id = get_or_create_user(username)
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT data FROM boards WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        if row:
            data = json.loads(row["data"])
            return BoardData.model_validate(data)

        # Seed initial data
        initial = INITIAL_BOARD_DATA
        cursor.execute(
            "INSERT INTO boards (user_id, data) VALUES (?, ?)",
            (user_id, json.dumps(initial)),
        )
        conn.commit()
        return BoardData.model_validate(initial)


def save_board_for_user(username: str, board: BoardData) -> BoardData:
    user_id = get_or_create_user(username)
    board_json = json.dumps(board.model_dump())
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO boards (user_id, data)
            VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET data = excluded.data;
            """,
            (user_id, board_json),
        )
        conn.commit()
    return board
