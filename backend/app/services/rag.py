"""Retrieval-augmented answer generation over the RTA corpus."""

from __future__ import annotations

from app.schemas import AskResponse, Citation
from app.services import llm
from app.services.vectorstore import VectorStore, get_store

SIMILARITY_FLOOR = 0.25  # below this, retrieved docs are treated as irrelevant noise

PROMPT_TEMPLATE = """You are a plain-language explainer of Ontario tenancy law for students in Toronto. \
You are NOT a lawyer and must never give individualized legal advice or tell the tenant what to do. \
Only use the CONTEXT below, drawn from official Landlord and Tenant Board (LTB) sources. \
If the context does not clearly cover the situation, say so plainly instead of guessing.

Always:
- Explain what the law generally says in plain language.
- Reference the specific section numbers you are drawing from.
- Stay neutral and factual; do not tell the tenant what action to take, only what the law provides for.

CONTEXT:
{context}

TENANT'S SITUATION:
{situation}

Write a short, clear explanation (3-6 sentences) of the relevant rights and what LTB process may apply, \
citing section numbers from the context.
"""


def _format_context(docs_with_scores: list[tuple]) -> str:
    blocks = []
    for doc, _score in docs_with_scores:
        blocks.append(
            f"[{doc.topic} — RTA s.{', '.join(doc.sections)} — {doc.source_name}]\n{doc.text}"
        )
    return "\n\n".join(blocks)


def answer_situation(situation: str, store: VectorStore | None = None) -> AskResponse:
    store = store or get_store()
    results = store.search(situation, top_k=3)
    relevant = [(doc, score) for doc, score in results if score >= SIMILARITY_FLOOR]

    if not relevant:
        return AskResponse(
            answer=(
                "I couldn't confidently match your situation to a specific part of the "
                "Residential Tenancies Act in my current knowledge base. This tool currently "
                "covers rent deposits, landlord entry, maintenance obligations, and harassment "
                "or interference. For anything else, please contact a community legal clinic "
                "or the Tenant Duty Counsel Program directly."
            ),
            citations=[],
        )

    context = _format_context(relevant)
    prompt = PROMPT_TEMPLATE.format(context=context, situation=situation)
    answer_text = llm.call_gemini(prompt)

    citations = [
        Citation(section_ids=doc.sections, source_name=doc.source_name, source_url=doc.source_url)
        for doc, _score in relevant
    ]
    return AskResponse(answer=answer_text, citations=citations)
