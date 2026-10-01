from unittest.mock import patch

from app.services import rag


def test_make_snippet_returns_short_text_unchanged():
    text = "Short text."
    assert rag._make_snippet(text) == text


def test_make_snippet_truncates_long_text_on_a_word_boundary():
    text = "word " * 100  # far longer than SNIPPET_MAX_CHARS
    snippet = rag._make_snippet(text)
    assert len(snippet) <= rag.SNIPPET_MAX_CHARS + 1  # +1 for the trailing ellipsis char
    assert snippet.endswith("…")
    assert not snippet[:-1].endswith(" ")  # rsplit dropped the trailing partial word cleanly


def test_answer_situation_cites_the_relevant_section():
    fake_answer = "Your landlord must return the deposit as last month's rent (RTA s.106)."
    with patch("app.services.rag.llm.call_gemini", return_value=fake_answer) as mock_call:
        response = rag.answer_situation(
            "My landlord is refusing to use my deposit as last month's rent and wants extra cash."
        )

    mock_call.assert_called_once()
    assert response.answer == fake_answer
    assert response.citations, "expected at least one citation"
    assert any("106" in c.section_ids for c in response.citations)
    assert "not legal advice" in response.disclaimer.lower() or "not a substitute" in response.disclaimer.lower()


def test_answer_situation_handles_unmatched_query_without_calling_llm():
    with patch("app.services.rag.llm.call_gemini") as mock_call:
        response = rag.answer_situation("what is the capital of France")

    mock_call.assert_not_called()
    assert response.citations == []
    assert "community legal clinic" in response.answer.lower()


class _FakeStore:
    """Stands in for the embedding-backed VectorStore so these tests stay hermetic."""

    def __init__(self):
        self.queries: list[str] = []

    def search(self, query, top_k=3):
        from app.services.vectorstore import CorpusDoc

        self.queries.append(query)
        doc = CorpusDoc(
            id="maintenance",
            topic="Maintenance",
            sections=["20"],
            source_name="LTB Guide to the RTA",
            source_url="https://tribunalsontario.ca/ltb/",
            text="A landlord is responsible for maintaining the rental unit in a good state of repair.",
        )
        return [(doc, 0.9)]


def test_split_follow_ups_separates_answer_from_suggestions():
    raw = (
        "Your landlord must keep the unit in good repair (RTA s.20).\n\n"
        "FOLLOW-UPS:\n- What if they still don't fix it?\n- Can I withhold rent?\n"
        "- How do I file a T6?\n- One too many?"
    )
    answer, follow_ups = rag.split_follow_ups(raw)
    assert answer == "Your landlord must keep the unit in good repair (RTA s.20)."
    assert follow_ups == [
        "What if they still don't fix it?",
        "Can I withhold rent?",
        "How do I file a T6?",
    ]


def test_split_follow_ups_without_marker_returns_whole_text():
    answer, follow_ups = rag.split_follow_ups("Just an answer (RTA s.20).")
    assert answer == "Just an answer (RTA s.20)."
    assert follow_ups == []


def test_answer_situation_returns_follow_up_suggestions():
    raw = "Repairs are the landlord's job (RTA s.20).\n**Follow-ups:**\n1. Can I file a T6?"
    with patch("app.services.rag.llm.call_gemini", return_value=raw):
        response = rag.answer_situation("My heater is broken", store=_FakeStore())
    assert response.answer == "Repairs are the landlord's job (RTA s.20)."
    assert response.follow_ups == ["Can I file a T6?"]


def test_follow_up_carries_situation_and_history_into_prompt_and_retrieval():
    store = _FakeStore()
    history = [rag.Turn(question="Can I withhold rent?", answer="No, withholding rent is risky.")]
    with patch("app.services.rag.llm.call_gemini", return_value="Answer.") as mock_call:
        rag.answer_situation(
            "My heater has been broken for three weeks",
            store=store,
            follow_up="What if they still don't fix it?",
            history=history,
        )

    prompt = mock_call.call_args.args[0]
    assert "My heater has been broken for three weeks" in prompt
    assert "Tenant: Can I withhold rent?" in prompt
    assert "Explainer: No, withholding rent is risky." in prompt
    assert "TENANT'S FOLLOW-UP QUESTION:\nWhat if they still don't fix it?" in prompt
    assert rag.FOLLOW_UP_TASK in prompt
    # retrieval is grounded in the original situation, not just the short follow-up
    assert store.queries == ["My heater has been broken for three weeks\nWhat if they still don't fix it?"]


def test_new_situation_prompt_has_no_conversation_section():
    with patch("app.services.rag.llm.call_gemini", return_value="Answer.") as mock_call:
        rag.answer_situation("My heater is broken", store=_FakeStore())
    prompt = mock_call.call_args.args[0]
    assert "CONVERSATION SO FAR" not in prompt
    assert rag.NEW_SITUATION_TASK in prompt
