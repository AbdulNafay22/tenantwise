"""Fills a real LTB PDF form's AcroForm fields and returns the filled bytes.

This deliberately fills Tribunals Ontario's own published form (T2 or T6),
not a look-alike -- the output is the real government form, just with a
tenant's own details already typed in, ready for them to review before
filing. It never submits anything on the tenant's behalf.
"""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter

FORMS_DIR = Path(__file__).resolve().parent.parent / "data" / "forms"


def list_form_fields(form_name: str) -> list[str]:
    """Return the AcroForm field names present in a given LTB form PDF.

    Useful for mapping a form's real field names once the PDF is available
    (see scripts/inspect_form_fields.py for a standalone version of this
    that can run anywhere with the PDF on disk).
    """
    reader = PdfReader(FORMS_DIR / f"{form_name}.pdf")
    fields = reader.get_fields() or {}
    return list(fields.keys())


def fill_form(form_name: str, field_values: dict[str, str]) -> bytes:
    """Fill the named form's AcroForm fields with field_values and return PDF bytes.

    field_values keys must match the form's real field names (see
    list_form_fields). Unknown keys are ignored by pypdf rather than
    raising, so a partial/best-effort fill still produces a usable PDF.
    """
    reader = PdfReader(FORMS_DIR / f"{form_name}.pdf")
    writer = PdfWriter()
    writer.append(reader)

    for page in writer.pages:
        writer.update_page_form_field_values(page, field_values)

    # NeedAppearances so PDF viewers actually render the typed-in values.
    writer.set_need_appearances_writer(True)

    buffer = BytesIO()
    writer.write(buffer)
    return buffer.getvalue()
