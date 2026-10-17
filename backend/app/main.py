"""Paytm Saathi FastAPI application entry point.

Run locally:

    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import get_session_factory, init_db
from .seed import seed_if_empty
from .api import (
    assistant,
    budgets,
    bills,
    dev,
    goals,
    health,
    insights,
    overview,
    safety,
    transactions,
    users,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Create tables and seed the database exactly once, if it is empty."""
    settings = get_settings()
    init_db()
    if settings.seed_on_start:
        session = get_session_factory()()
        try:
            seed_if_empty(session)
        finally:
            session.close()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=settings.version,
        description=(
            "Demonstration backend for the Paytm Saathi prototype. All data is fictional and simulated; "
            "no bank, wallet or payment network is connected."
        ),
        lifespan=lifespan,
    )

    # Permissive CORS so the API also works when the frontend is served from
    # another origin (e.g. Vercel static hosting pointed at a deployed API).
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(overview.router)
    app.include_router(users.router)
    app.include_router(transactions.router)
    app.include_router(budgets.router)
    app.include_router(goals.router)
    app.include_router(bills.router)
    app.include_router(insights.router)
    app.include_router(safety.router)
    app.include_router(assistant.router)
    app.include_router(dev.router)

    return app


app = create_app()
