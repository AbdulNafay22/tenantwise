from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_ask_rejects_too_short_situation():
    resp = client.post("/ask", json={"situation": "help"})
    assert resp.status_code == 422


def test_ask_returns_cited_answer():
    fake_answer = "Landlords generally need 24 hours written notice to enter (RTA s.27)."
    with patch("app.services.rag.llm.call_gemini", return_value=fake_answer):
        resp = client.post(
            "/ask",
            json={"situation": "My landlord keeps entering my unit with no warning at all."},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["answer"] == fake_answer
    assert len(body["citations"]) >= 1
    assert "disclaimer" in body


def test_ask_passes_follow_up_and_history_through():
    from app.schemas import AskResponse

    with patch(
        "app.routes.ask.rag.answer_situation",
        return_value=AskResponse(answer="ok", citations=[], follow_ups=["Next?"]),
    ) as mock_answer:
        resp = client.post(
            "/ask",
            json={
                "situation": "My heater has been broken for three weeks.",
                "follow_up": "What if they ignore me?",
                "history": [{"question": "Can I withhold rent?", "answer": "Generally no."}],
            },
        )
    assert resp.status_code == 200
    assert resp.json()["follow_ups"] == ["Next?"]
    kwargs = mock_answer.call_args.kwargs
    assert kwargs["follow_up"] == "What if they ignore me?"
    assert kwargs["history"][0].question == "Can I withhold rent?"
