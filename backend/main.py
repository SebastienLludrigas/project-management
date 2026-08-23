import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Kanban Project Management API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


# Determine static files directory
candidates = [
    os.environ.get("STATIC_DIR"),
    Path(__file__).parent.parent / "frontend" / "out",
    Path(__file__).parent / "static",
]

static_path = None
for candidate in candidates:
    if candidate:
        p = Path(candidate)
        if p.exists() and (p / "index.html").exists():
            static_path = p
            break

if static_path:
    app.mount("/", StaticFiles(directory=str(static_path), html=True), name="static")

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 3000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
