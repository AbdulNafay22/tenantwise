"""Pydantic models for the TenantWise API."""

from pydantic import BaseModel, Field


class Turn(BaseModel):
    """One earlier question/answer pair, sent back by the client for follow-ups."""

    question: str = Field(..., min_length=1, max_length=1000)
    answer: str = Field(..., min_length=1, max_length=6000)


class AskRequest(BaseModel):
    situation: str = Field(
        ...,
        min_length=10,
        max_length=4000,
        description="Plain-language description of the tenant's situation.",
    )
    follow_up: str | None = Field(
        default=None,
        min_length=3,
        max_length=1000,
        description=(
            "A follow-up question about the same situation. When set, the answer builds on "
            "`situation` and `history` instead of treating this as a new situation."
        ),
    )
    history: list[Turn] = Field(
        default_factory=list,
        max_length=6,
        description="Earlier follow-up questions and answers for this situation, oldest first.",
    )


class Citation(BaseModel):
    section_ids: list[str]
    source_name: str
    source_url: str
    snippet: str = Field(
        default="",
        description=(
            "A short preview of the actual retrieved corpus text this citation is drawn from, "
            "so a user can see why it's relevant without following the link."
        ),
    )


class GenerateFormRequest(BaseModel):
    situation: str = Field(..., min_length=10, max_length=4000)
    tenant_name: str = Field(..., min_length=1, max_length=200)
    tenant_address: str = Field(..., min_length=1, max_length=300)
    landlord_name: str = Field(..., min_length=1, max_length=200)


class AskResponse(BaseModel):
    answer: str
    citations: list[Citation]
    follow_ups: list[str] = Field(
        default_factory=list,
        description="Up to 3 short follow-up questions the tenant might want to ask next.",
    )
    disclaimer: str = (
        "This is general information about Ontario tenancy law, not legal advice, "
        "and it is not a substitute for speaking with a paralegal, lawyer, or tenant "
        "duty counsel about your specific situation. For urgent help, contact your "
        "local community legal clinic or the Tenant Duty Counsel Program."
    )
