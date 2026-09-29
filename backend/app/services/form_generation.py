"""Ties retrieval, LLM description drafting, and PDF form filling together."""

from __future__ import annotations

from app.services import form_mapping, llm, pdf_fill
from app.services.rag import SIMILARITY_FLOOR, _format_context
from app.services.vectorstore import VectorStore, get_store

DESCRIPTION_PROMPT_TEMPLATE = """You are drafting the "description of the problem" section of an Ontario \
Landlord and Tenant Board application, based on a tenant's own account of their situation. \
Write in the tenant's voice, in plain factual language suitable for a government form: state what \
happened, when (if known), and reference the relevant Residential Tenancies Act section number(s) \
from the context below. Do not invent facts the tenant did not mention. Do not give legal advice or \
tell the tenant what the outcome will be. Keep it to 2-4 sentences.

CONTEXT (for citing the right section numbers):
{context}

TENANT'S OWN DESCRIPTION:
{situation}

Write the form description now:
"""


class NoMatchingFormError(Exception):
    """Raised when the situation doesn't clearly match a form we can generate."""


def generate_form_for_situation(
    situation: str,
    tenant_name: str,
    tenant_address: str,
    landlord_name: str,
    store: VectorStore | None = None,
) -> bytes:
    store = store or get_store()
    results = store.search(situation, top_k=1)
    if not results or results[0][1] < SIMILARITY_FLOOR:
        raise NoMatchingFormError(
            "Could not confidently match this situation to a specific LTB form."
        )

    top_doc, _score = results[0]
    target = form_mapping.build_form_target(
        doc_id=top_doc.id,
        tenant_name=tenant_name,
        tenant_address=tenant_address,
        landlord_name=landlord_name,
        description="",  # filled in below once we have the drafted text
    )
    if target is None:
        raise NoMatchingFormError(
            f"'{top_doc.topic}' situations don't map to a direct LTB application form yet."
        )

    context = _format_context([(top_doc, _score)])
    prompt = DESCRIPTION_PROMPT_TEMPLATE.format(context=context, situation=situation)
    description = llm.call_gemini(prompt)

    # Re-build with the real description now that we have it.
    target = form_mapping.build_form_target(
        doc_id=top_doc.id,
        tenant_name=tenant_name,
        tenant_address=tenant_address,
        landlord_name=landlord_name,
        description=description,
    )
    assert target is not None  # already validated above

    return pdf_fill.fill_form(target.form_name, target.field_values)
