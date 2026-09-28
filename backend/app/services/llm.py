"""Thin wrapper around the Gemini call so it can be mocked in tests.

Keeping this as a single small function (rather than inlining the API call
in the route) is what lets the eval harness and unit tests exercise the
retrieval + prompt-construction logic deterministically, without needing a
live API key or burning quota on every test run.
"""

from __future__ import annotations

import os

GEMINI_MODEL = "gemini-3.5-flash-lite"


def call_gemini(prompt: str) -> str:
    """Call Gemini with a fully-constructed prompt and return the raw text response.

    Raises RuntimeError if GEMINI_API_KEY is not configured, so the failure
    is explicit rather than silently returning a stub answer in production.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Add it to your .env file (see .env.example)."
        )

    from google import genai  # imported lazily so tests that mock call_gemini
    # never need the dependency installed with real network access configured.

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    return response.text
