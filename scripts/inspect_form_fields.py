"""Standalone script: run this in an environment with real internet access
(your Codespace, not the sandbox this project was scaffolded in) to download
the real LTB T2 and T6 forms and print their AcroForm field names.

Usage:
    cd backend
    python ../scripts/inspect_form_fields.py

Paste the printed output back so the field mapping in
app/services/form_mapping.py can be filled in with the real field names
instead of placeholders.
"""

import urllib.request
from pathlib import Path

from pypdf import PdfReader

FORMS = {
    "T2": "https://tribunalsontario.ca/documents/ltb/Tenant%20Applications%20&%20Instructions/T2.pdf",
    "T6": "https://tribunalsontario.ca/documents/ltb/Tenant%20Applications%20&%20Instructions/T6.pdf",
}

OUT_DIR = Path(__file__).resolve().parent.parent / "backend" / "app" / "data" / "forms"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# tribunalsontario.ca's WAF rejects requests with no/unusual User-Agent
# (urllib's default "Python-urllib/x.y" gets a 403), so pretend to be a
# normal browser.
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept": "application/pdf,*/*",
}

for name, url in FORMS.items():
    out_path = OUT_DIR / f"{name}.pdf"
    print(f"Downloading {name} -> {out_path}")
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as resp, open(out_path, "wb") as f:
        f.write(resp.read())

    reader = PdfReader(out_path)
    fields = reader.get_fields() or {}
    print(f"\n=== {name}.pdf: {len(fields)} form fields ===")
    for field_name, field in fields.items():
        field_type = field.get("/FT", "?")
        print(f"  [{field_type}] {field_name!r}")
    print()