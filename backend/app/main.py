from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import client, get_db, init_db
from .routers import colleagues, events, geocode


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await client.close()


app = FastAPI(title="MDSCevents API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (events.router, colleagues.router, geocode.router):
    app.include_router(r, prefix="/api")


@app.get("/api/health", tags=["health"])
async def health():
    await get_db().command("ping")
    return {"status": "ok"}
