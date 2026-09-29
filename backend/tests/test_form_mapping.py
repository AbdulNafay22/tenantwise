from app.services import form_mapping


def test_split_name_puts_last_word_as_surname():
    assert form_mapping._split_name("Jane Student") == ("Jane", "Student")


def test_split_name_handles_multi_word_given_names():
    assert form_mapping._split_name("Mary Jane Student") == ("Mary Jane", "Student")


def test_split_name_handles_single_word_name():
    assert form_mapping._split_name("Cher") == ("Cher", "")


def test_split_address_extracts_postal_code():
    line, postal = form_mapping._split_address("123 Gould St, Toronto, ON M5B 2K3")
    assert postal == "M5B 2K3"
    assert "M5B" not in line


def test_split_address_without_postal_code_returns_full_string():
    line, postal = form_mapping._split_address("123 Gould St, Toronto, ON")
    assert postal is None
    assert line == "123 Gould St, Toronto, ON"


def test_build_form_target_fills_expected_abstract_fields():
    target = form_mapping.build_form_target(
        doc_id="rta-s26-s27-s36-entry",
        tenant_name="Jane Student",
        tenant_address="123 Gould St, Toronto, ON M5B 2K3",
        landlord_name="John Landlord",
        description="The landlord entered without notice.",
    )

    assert target is not None
    assert target.form_name == "T2"
    mapping = form_mapping.FORM_FIELD_MAP["T2"]
    assert target.field_values[mapping["tenant_first_name"]] == "Jane"
    assert target.field_values[mapping["tenant_last_name"]] == "Student"
    assert target.field_values[mapping["landlord_first_name"]] == "John"
    assert target.field_values[mapping["landlord_last_name"]] == "Landlord"
    assert target.field_values[mapping["tenant_province"]] == "ON"
    assert target.field_values[mapping["tenant_postal_code"]] == "M5B 2K3"
    assert "M5B" not in target.field_values[mapping["tenant_address"]]
    assert target.field_values[mapping["description"]] == "The landlord entered without notice."


def test_build_form_target_returns_none_for_unmapped_topic():
    assert (
        form_mapping.build_form_target(
            doc_id="rta-rent-deposit",
            tenant_name="Jane Student",
            tenant_address="123 Gould St",
            landlord_name="John Landlord",
            description="Deposit issue.",
        )
        is None
    )
