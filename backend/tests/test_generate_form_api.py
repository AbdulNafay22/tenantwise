from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.services import form_mapping
from app.services.vectorstore import CorpusDoc

client = TestClient(app)


def test_generate_form_endpoint_returns_a_pdf(sample_form_pdf, monkeypatch):
    entry_doc = CorpusDoc(
        id="rta-s26-s27-s36-entry",
        topic="Landlord's right of entry",
        sections=["26", "27"],
        source_name="LTB Interpretation Guideline 19",
        source_url="https://tribunalsontario.ca/example",
        text="A landlord may not enter without notice except in narrow circumstances.",
    )

    monkeypatch.setitem(form_mapping.TOPIC_TO_FORM, "rta-s26-s27-s36-entry", sample_form_pdf)
    monkeypatch.setitem(
        form_mapping.FORM_FIELD_MAP,
        sample_form_pdf,
        {
            "tenant_first_name": "tenant_full_name",
            "tenant_last_name": "tenant_full_name",
            "tenant_address": "tenant_full_name",
            "tenant_province": "tenant_full_name",
            "tenant_postal_code": "tenant_full_name",
            "landlord_first_name": "tenant_full_name",
            "landlord_last_name": "tenant_full_name",
            "description": "description_of_problem",
        },
    )

    class _FakeStore:
        def search(self, query, top_k=1):
            return [(entry_doc, 0.9)]

    with (
        patch("app.services.form_generation.get_store", return_value=_FakeStore()),
        patch("app.services.form_generation.llm.call_gemini", return_value="Fake description."),
    ):
        resp = client.post(
            "/generate-form",
            json={
                "situation": "My landlord walked in without knocking.",
                "tenant_name": "Jane Student",
                "tenant_address": "123 Gould St",
                "landlord_name": "John Landlord",
            },
        )

    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content.startswith(b"%PDF")
