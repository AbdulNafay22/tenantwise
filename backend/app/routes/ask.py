from fastapi import APIRouter, HTTPException

from app.schemas import AskRequest, AskResponse
from app.services.llm import call_gemini  # noqa: F401  (imported for patching in tests)
from app.services import rag

router = APIRouter()


@router.post("/ask", response_model=AskResponse)
def ask(payload: AskRequest) -> AskResponse:
    try:
        return rag.answer_situation(
            payload.situation, follow_up=payload.follow_up, history=payload.history
        )
    except RuntimeError as exc:
        # Missing/misconfigured API key, etc. -- a config problem, not a client error.
        raise HTTPException(status_code=503, detail=str(exc)) from exc
