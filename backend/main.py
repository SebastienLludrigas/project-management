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


# Determine static files directory (frontend out/ or backend static/)
static_dir_frontend = Path(__file__).parent.parent / "frontend" / "out"
static_dir_backend = Path(__file__).parent / "static"

if static_dir_frontend.exists() and (static_dir_frontend / "index.html").exists():
    app.mount("/", StaticFiles(directory=str(static_dir_frontend), html=True), name="static")
elif static_dir_backend.exists():
    app.mount("/", StaticFiles(directory=str(static_backend := static_dir_backend), html=True), name="static")

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 3000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
