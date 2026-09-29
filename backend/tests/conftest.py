"""Shared pytest fixtures.

`sample_form_pdf` builds a small synthetic AcroForm PDF at test time (via
reportlab) rather than depending on the real, network-downloaded LTB T2/T6
forms. That keeps the PDF-fill tests hermetic and fast, and independent of
whether the real forms have been fetched into app/data/forms/ yet (see
scripts/inspect_form_fields.py).
"""

from pathlib import Path

import pytest


@pytest.fixture
def sample_form_pdf(tmp_path, monkeypatch):
    from reportlab.pdfgen import canvas

    forms_dir = tmp_path / "forms"
    forms_dir.mkdir()
    form_path = forms_dir / "SAMPLE.pdf"

    c = canvas.Canvas(str(form_path))
    form = c.acroForm
    form.textfield(name="tenant_full_name", x=50, y=700, width=300, height=20)
    form.textfield(name="description_of_problem", x=50, y=500, width=400, height=100)
    c.showPage()
    c.save()

    import app.services.pdf_fill as pdf_fill_module

    monkeypatch.setattr(pdf_fill_module, "FORMS_DIR", forms_dir)
    return "SAMPLE"
