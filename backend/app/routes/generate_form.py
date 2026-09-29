from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.schemas import GenerateFormRequest
from app.services import form_generation

router = APIRouter()


@router.post("/generate-form")
def generate_form(payload: GenerateFormRequest) -> Response:
    try:
        pdf_bytes = form_generation.generate_form_for_situation(
            situation=payload.situation,
            tenant_name=payload.tenant_name,
            tenant_address=payload.tenant_address,
            landlord_name=payload.landlord_name,
        )
    except form_generation.NoMatchingFormError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=ltb_application_draft.pdf"},
    )
