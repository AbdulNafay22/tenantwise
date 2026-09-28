"""Pydantic models for the TenantWise API."""

from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    situation: str = Field(
        ...,
        min_length=10,
        max_length=4000,
        description="Plain-language description of the tenant's situation.",
    )


class Citation(BaseModel):
    section_ids: list[str]
    source_name: str
    source_url: str


class AskResponse(BaseModel):
    answer: str
    citations: list[Citation]
    disclaimer: str = (
        "This is general information about Ontario tenancy law, not legal advice, "
        "and it is not a substitute for speaking with a paralegal, lawyer, or tenant "
        "duty counsel about your specific situation. For urgent help, contact your "
        "local community legal clinic or the Tenant Duty Counsel Program."
    )
