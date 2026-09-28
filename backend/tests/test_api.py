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
