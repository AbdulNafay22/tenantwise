from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.ask import router as ask_router

app = FastAPI(title="TenantWise API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tightened before production deploy (see README)
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ask_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
