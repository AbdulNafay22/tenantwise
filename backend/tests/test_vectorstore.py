from app.services.vectorstore import get_store


def test_deposit_situation_retrieves_deposit_doc():
    store = get_store()
    results = store.search("my landlord won't give back my last month's rent deposit", top_k=1)
    assert results, "expected at least one retrieved doc"
    top_doc, score = results[0]
    assert top_doc.id == "rta-rent-deposit"
    assert score > 0.25


def test_entry_situation_retrieves_entry_doc():
    store = get_store()
    results = store.search(
        "my landlord keeps walking into my apartment without telling me first", top_k=1
    )
    top_doc, _score = results[0]
    assert top_doc.id == "rta-s26-s27-s36-entry"


def test_maintenance_situation_retrieves_maintenance_doc():
    store = get_store()
    results = store.search(
        "there's mold and a broken heater and my landlord won't fix anything", top_k=1
    )
    top_doc, _score = results[0]
    assert top_doc.id == "rta-s20-s29-s30-maintenance"
