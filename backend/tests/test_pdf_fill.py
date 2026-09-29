from pypdf import PdfReader
from io import BytesIO

from app.services import pdf_fill


def test_list_form_fields_returns_real_field_names(sample_form_pdf):
    fields = pdf_fill.list_form_fields(sample_form_pdf)
    assert "tenant_full_name" in fields
    assert "description_of_problem" in fields


def test_fill_form_round_trips_values(sample_form_pdf):
    filled = pdf_fill.fill_form(
        sample_form_pdf,
        {
            "tenant_full_name": "Jane Student",
            "description_of_problem": "Landlord entered without notice.",
        },
    )
    reader = PdfReader(BytesIO(filled))
    result_fields = reader.get_fields()
    assert result_fields["tenant_full_name"]["/V"] == "Jane Student"
    assert result_fields["description_of_problem"]["/V"] == "Landlord entered without notice."


def test_fill_form_ignores_unknown_keys(sample_form_pdf):
    # Should not raise even if a key doesn't correspond to a real field --
    # important once we're filling with LLM-extracted fields that might not
    # perfectly match the real T2/T6 field names on the first pass.
    filled = pdf_fill.fill_form(sample_form_pdf, {"not_a_real_field": "whatever"})
    assert len(filled) > 0
