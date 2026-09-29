from unittest.mock import patch

import pytest
from pypdf import PdfReader
from io import BytesIO

from app.services import form_generation, form_mapping
from app.services.vectorstore import CorpusDoc


class _FakeStore:
    """A minimal stand-in for VectorStore that always returns one fixed doc,
    so this test exercises the form-generation plumbing (mapping, prompt
    construction, PDF filling) without needing the real embedding model or
    the real T2/T6 forms."""

    def __init__(self, doc: CorpusDoc, score: float = 0.9):
        self.doc = doc
        self.score = score

    def search(self, query, top_k=1):
        return [(self.doc, self.score)]


@pytest.fixture
def entry_doc():
    return CorpusDoc(
        id="rta-s26-s27-s36-entry",
        topic="Landlord's right of entry",
        sections=["26", "27"],
        source_name="LTB Interpretation Guideline 19",
        source_url="https://tribunalsontario.ca/example",
        text="A landlord may not enter without notice except in narrow circumstances.",
    )


def test_generate_form_fills_the_mapped_form(sample_form_pdf, entry_doc, monkeypatch):
    monkeypatch.setitem(form_mapping.TOPIC_TO_FORM, "rta-s26-s27-s36-entry", sample_form_pdf)
    monkeypatch.setitem(
        form_mapping.FORM_FIELD_MAP,
        sample_form_pdf,
        {
            # sample fixture only has 2 fields, so pile every abstract key
            # that isn't "description" onto the one spare field -- this
            # test only cares that the description ends up right.
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

    fake_store = _FakeStore(entry_doc)
    fake_description = "The landlord entered without notice on Sept 20 (RTA s.27)."

    with patch("app.services.form_generation.llm.call_gemini", return_value=fake_description):
        pdf_bytes = form_generation.generate_form_for_situation(
            situation="My landlord walked in without knocking while I was home.",
            tenant_name="Jane Student",
            tenant_address="123 Gould St",
            landlord_name="John Landlord",
            store=fake_store,
        )

    reader = PdfReader(BytesIO(pdf_bytes))
    fields = reader.get_fields()
    assert fields["description_of_problem"]["/V"] == fake_description


def test_generate_form_raises_when_topic_has_no_form(entry_doc):
    fake_store = _FakeStore(entry_doc)
    # rent deposit topic maps to None in form_mapping.TOPIC_TO_FORM
    deposit_doc = CorpusDoc(
        id="rta-rent-deposit",
        topic="Rent deposit",
        sections=["106"],
        source_name="LTB Guide",
        source_url="https://tribunalsontario.ca/example",
        text="Deposit rules.",
    )
    fake_store.doc = deposit_doc

    with pytest.raises(form_generation.NoMatchingFormError):
        form_generation.generate_form_for_situation(
            situation="My landlord won't return my deposit.",
            tenant_name="Jane Student",
            tenant_address="123 Gould St",
            landlord_name="John Landlord",
            store=fake_store,
        )
