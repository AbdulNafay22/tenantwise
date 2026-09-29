"""Maps a matched RTA topic to the real LTB form that applies, and the field
names on that form.

Field names below were captured on 2026-09-27 by running
scripts/inspect_form_fields.py against the real T2.pdf and T6.pdf downloaded
from tribunalsontario.ca (that script needs a normal internet connection --
this project was scaffolded in a network-restricted sandbox that couldn't
reach that host directly).

IMPORTANT CAVEATS (read before trusting this blindly):

1. These are Adobe LiveCycle / XFA-style dynamic forms -- the field names
   are qualified paths like "form1[0].#subform[1]...", which is the
   telltale sign of an Adobe LiveCycle Designer form. pypdf fills the
   classic AcroForm field values, which is what `reader.get_fields()` reads
   here -- but some PDF viewers (notably Adobe Reader/Acrobat) prefer a
   form's XFA data island over its flat AcroForm values when both are
   present, which can make a pypdf-filled PDF look blank in Adobe Reader
   even though the AcroForm values are set correctly. This has been
   verified against pypdf programmatically (see tests/test_pdf_fill.py and
   tests/test_form_generation.py) but NOT visually confirmed in Adobe
   Reader/Acrobat. Before relying on this for a real filing, generate one
   PDF via POST /generate-form and open it in the actual viewer a tenant
   would use (browser PDF viewer, Preview, Adobe Reader) to confirm the
   values actually render.

2. Name splitting is a simple heuristic (`_split_name` below): everything
   before the last space is treated as the first name, the last word as the
   surname. This is wrong for some real names (multi-word surnames,
   single-word/mononyms). Good enough for a portfolio-grade demo, not
   guaranteed correct for every name.

3. Address handling is deliberately conservative: rather than guess how to
   split a free-text address into street number / street name / unit /
   municipality (unreliable without a real address-parsing service), this
   only pulls out a Canadian postal code via regex (if present) and puts
   everything else into a single "address" line field. `TUnit` /
   `TMunicipality` are left blank rather than guessed. `TProvince` is
   hardcoded to "ON" since this project is Ontario-only by design.

4. The landlord's address isn't collected by this API at all (only their
   name), so `LAddress` / `LMunicipality` / etc. on the form are left
   blank. The rental unit's own structured address block
   (`Rental_Address_for_Landlord_form`, which wants separate street
   number/name/type/direction fields) is also left unfilled for the same
   "don't guess a free-text split" reason -- a tenant filling this out by
   hand still needs to double check and complete these sections.

None of this is fabricated data: every field that IS filled is either
directly supplied by the tenant (name, address line, description) or a
hardcoded, documented constant (province). Nothing here invents facts.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Which LTB form applies to each corpus doc id (see data/rta_corpus.json).
TOPIC_TO_FORM = {
    "rta-s26-s27-s36-entry": "T2",
    "rta-s21-25-s29-s31-s41-tenant-rights": "T2",
    "rta-s20-s29-s30-maintenance": "T6",
    # Rent deposit disputes are typically raised as a term of an existing
    # T2/T6 application or resolved without a Board application; no direct
    # form mapping yet.
    "rta-rent-deposit": None,
}

# T2 and T6 share an identical tenant/landlord name+address block; only the
# "description of the problem" field differs between the two forms.
_TENANT_LANDLORD_FIELDS = {
    "tenant_first_name": "form1[0].#subform[1].LTHAS_Tenant_Name__Address[0].TFirstName1[0]",
    "tenant_last_name": "form1[0].#subform[1].LTHAS_Tenant_Name__Address[0].TLastName1[0]",
    "tenant_address": "form1[0].#subform[1].LTHAS_Tenant_Name__Address[0].TAddress[0]",
    "tenant_province": "form1[0].#subform[1].LTHAS_Tenant_Name__Address[0].TProvince[0]",
    "tenant_postal_code": "form1[0].#subform[1].LTHAS_Tenant_Name__Address[0].TPostalCode[0]",
    "landlord_first_name": "form1[0].#subform[5].LTHAS_Landlord_Name__Address[0].LFirstName[0]",
    "landlord_last_name": "form1[0].#subform[5].LTHAS_Landlord_Name__Address[0].LLastName[0]",
}

FORM_FIELD_MAP = {
    "T2": {
        **_TENANT_LANDLORD_FIELDS,
        "description": "form1[0].#subform[9].ReasonTable[0].Row1[0].ReasonDetail[0]",
    },
    "T6": {
        **_TENANT_LANDLORD_FIELDS,
        "description": "form1[0].#subform[8].Part2ReasonDetail[0]",
    },
}

# Ontario-only project (see README) -- the RTA and these LTB forms don't
# apply outside Ontario, so this is a safe hardcoded default rather than a
# guess.
_DEFAULT_PROVINCE = "ON"

_POSTAL_CODE_RE = re.compile(r"([A-Za-z]\d[A-Za-z])\s?(\d[A-Za-z]\d)\b")


def _split_name(full_name: str) -> tuple[str, str]:
    """Naive first/last name split: last whitespace-separated token is the
    surname, everything before it is the given name(s). See module
    docstring caveat #2."""
    parts = full_name.strip().split()
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return " ".join(parts[:-1]), parts[-1]


def _split_address(address: str) -> tuple[str, str | None]:
    """Pulls a Canadian postal code out of a free-text address if present,
    returning (remaining_address_line, postal_code_or_None). Does not
    attempt to split unit/municipality -- see module docstring caveat #3."""
    match = _POSTAL_CODE_RE.search(address)
    if not match:
        return address.strip(), None
    postal_code = f"{match.group(1).upper()} {match.group(2).upper()}"
    remainder = (address[: match.start()] + address[match.end() :]).strip(" ,")
    return remainder, postal_code


@dataclass
class FormTarget:
    form_name: str
    field_values: dict[str, str]


def build_form_target(
    doc_id: str,
    tenant_name: str,
    tenant_address: str,
    landlord_name: str,
    description: str,
) -> FormTarget | None:
    form_name = TOPIC_TO_FORM.get(doc_id)
    if form_name is None:
        return None

    mapping = FORM_FIELD_MAP[form_name]
    tenant_first, tenant_last = _split_name(tenant_name)
    landlord_first, landlord_last = _split_name(landlord_name)
    address_line, postal_code = _split_address(tenant_address)

    field_values = {
        mapping["tenant_first_name"]: tenant_first,
        mapping["tenant_last_name"]: tenant_last,
        mapping["tenant_address"]: address_line,
        mapping["tenant_province"]: _DEFAULT_PROVINCE,
        mapping["landlord_first_name"]: landlord_first,
        mapping["landlord_last_name"]: landlord_last,
        mapping["description"]: description,
    }
    if postal_code:
        field_values[mapping["tenant_postal_code"]] = postal_code

    return FormTarget(form_name=form_name, field_values=field_values)
