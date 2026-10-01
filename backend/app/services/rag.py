"""Retrieval-augmented answer generation over the RTA corpus."""

from __future__ import annotations

import re

from app.schemas import AskResponse, Citation, Turn
from app.services import llm
from app.services.vectorstore import VectorStore, get_store

SIMILARITY_FLOOR = 0.25  # below this, retrieved docs are treated as irrelevant noise
SNIPPET_MAX_CHARS = 220  # keeps the frontend preview short; full text is one click away

PROMPT_TEMPLATE = """You are a plain-language explainer of Ontario tenancy law for students in Toronto. \
You are NOT a lawyer and must never give individualized legal advice or tell the tenant what to do. \
Only use the CONTEXT below, drawn from official Landlord and Tenant Board (LTB) sources. \
If the context does not clearly cover the situation, say so plainly instead of guessing.

Always:
- Explain what the law generally says in plain language.
- Reference the specific section numbers you are drawing from.
- Stay neutral and factual; do not tell the tenant what action to take, only what the law provides for.
- Start directly with the substance. Do not open with a disclaimer or describe your own role; \
the app already shows a "not legal advice" notice.

CONTEXT:
{context}

TENANT'S SITUATION:
{situation}
{conversation}
{task}

Then, on a new line, write "FOLLOW-UPS:" followed by up to 3 short questions (one per line, each \
starting with "- ") that this tenant would likely want to ask next about their situation. Only suggest \
questions the context above can answer.
"""

NEW_SITUATION_TASK = (
    "Write a short, clear explanation (3-6 sentences) of the relevant rights and what LTB process "
    "may apply, citing section numbers from the context."
)

FOLLOW_UP_TASK = (
    "The tenant is asking a follow-up question about the situation above. Answer that question "
    "directly in 2-5 sentences, building on what was already explained rather than repeating it, "
    "and cite section numbers from the context."
)

FOLLOW_UP_MARKER = re.compile(r"^\s*\**FOLLOW-?UPS?:?\**\s*:?", re.IGNORECASE | re.MULTILINE)
MAX_FOLLOW_UPS = 3


def _format_context(docs_with_scores: list[tuple]) -> str:
    blocks = []
    for doc, _score in docs_with_scores:
        blocks.append(
            f"[{doc.topic} — RTA s.{', '.join(doc.sections)} — {doc.source_name}]\n{doc.text}"
        )
    return "\n\n".join(blocks)


def _format_conversation(history: list[Turn], follow_up: str | None) -> str:
    if not follow_up:
        return ""
    lines = ["", "CONVERSATION SO FAR:"]
    for turn in history:
        lines.append(f"Tenant: {turn.question}")
        lines.append(f"Explainer: {turn.answer}")
    lines.append("")
    lines.append("TENANT'S FOLLOW-UP QUESTION:")
    lines.append(follow_up)
    return "\n".join(lines) + "\n"


def split_follow_ups(raw: str) -> tuple[str, list[str]]:
    """Separates the model's answer from its trailing "FOLLOW-UPS:" list.

    Tolerant by design: if the model leaves the section out (or a test stub returns
    plain text), the whole response is the answer and there are no follow-ups.
    """
    match = FOLLOW_UP_MARKER.search(raw)
    if not match:
        return raw.strip(), []
    answer = raw[: match.start()].strip()
    follow_ups = []
    for line in raw[match.end() :].splitlines():
        question = re.sub(r"^\s*(?:[-*•]|\d+[.)])\s*", "", line).strip().strip('"')
        if question:
            follow_ups.append(question)
    return answer, follow_ups[:MAX_FOLLOW_UPS]


def _make_snippet(text: str, max_chars: int = SNIPPET_MAX_CHARS) -> str:
    """Truncates a corpus doc's full text to a short preview for the UI, breaking on a
    word boundary rather than mid-word, with an ellipsis if it was actually cut short."""
    text = text.strip()
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars].rsplit(" ", 1)[0]
    return f"{truncated}…"


def answer_situation(
    situation: str,
    store: VectorStore | None = None,
    follow_up: str | None = None,
    history: list[Turn] | None = None,
) -> AskResponse:
    store = store or get_store()
    # A follow-up like "what if they still don't fix it?" retrieves poorly on its own, so
    # search with the original situation for grounding plus the new question.
    query = f"{situation}\n{follow_up}" if follow_up else situation
    results = store.search(query, top_k=3)
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
    prompt = PROMPT_TEMPLATE.format(
        context=context,
        situation=situation,
        conversation=_format_conversation(history or [], follow_up),
        task=FOLLOW_UP_TASK if follow_up else NEW_SITUATION_TASK,
    )
    answer_text, follow_ups = split_follow_ups(llm.call_gemini(prompt))

    citations = [
        Citation(
            section_ids=doc.sections,
            source_name=doc.source_name,
            source_url=doc.source_url,
            snippet=_make_snippet(doc.text),
        )
        for doc, _score in relevant
    ]
    return AskResponse(answer=answer_text, citations=citations, follow_ups=follow_ups)
