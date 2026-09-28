from unittest.mock import patch

from app.services import rag


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
