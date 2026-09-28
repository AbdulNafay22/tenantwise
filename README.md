# TenantWise

An AI assistant that explains Ontario tenant rights in plain language, grounded in real Landlord and Tenant Board (LTB) sources, and helps a tenant understand which LTB process applies to their situation.

**This is informational only, not legal advice.** For urgent situations, contact a community legal clinic or the Tenant Duty Counsel Program.

## Why this exists

Toronto Metropolitan University students face real, documented landlord issues -- wrongful deposit retention, unauthorized entry, unresponsive maintenance, and in some cases harassment or threats tied to immigration status (see The Eyeopener's "Students vs. Landlords," April 2026). Most students don't know their rights under the Residential Tenancies Act, 2006, and existing tenant-rights chatbots are built for other provinces or U.S. states. TenantWise is scoped specifically to Ontario and to the situations students most commonly run into.

## What makes this more than a chatbot wrapper

- **Grounded, not improvised**: every answer is retrieved from a small, hand-sourced corpus of real LTB Interpretation Guidelines and the LTB's own Guide to the Residential Tenancies Act (see `backend/app/data/rta_corpus.json`, each entry carries its real source URL and section numbers).
- **An evals harness, not just a demo**: `backend/app/evals/scenarios.json` has 22 realistic tenant scenarios with hand-labelled expected answers, scored automatically (`backend/app/evals/run_evals.py`) and wired into the test suite as a real quality gate (`tests/test_evals.py`) -- so retrieval accuracy is measured, not assumed.
- **Tenant-only by design**: this deliberately does not try to also serve landlords. That keeps the liability profile lower (explaining someone's own rights vs. giving eviction guidance to the other side of a dispute) and keeps the audience reachable and testable (TMU students).

## Architecture

- **Backend**: FastAPI (`backend/app`). A local embedding model (`sentence-transformers`, `all-MiniLM-L6-v2`) retrieves the most relevant corpus entries for a tenant's situation; Gemini generates the plain-language explanation from that retrieved context, always citing section numbers.
- **Frontend**: React + TypeScript (`frontend/`) -- in progress.
- **Data**: `backend/app/data/rta_corpus.json`, sourced from tribunalsontario.ca's official Interpretation Guidelines and Guide to the RTA (see each entry's `source_url`).

## Running the backend locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env  # then add your real GEMINI_API_KEY
python -m pytest -v
uvicorn app.main:app --reload
```

Note: the first test run downloads the `all-MiniLM-L6-v2` embedding model from Hugging Face (a few hundred MB, cached after that). This needs normal internet access -- it will not work in a network-restricted sandbox, but works fine in a Codespace or CI runner.

## Status

- [x] Real, sourced RTA corpus (rent deposits, entry, maintenance, tenant rights/harassment)
- [x] RAG retrieval + cited Gemini answers, with an eval harness and test suite
- [ ] LTB form auto-fill (PDF generation) -- next
- [ ] Frontend chat UI -- next
- [ ] Deploy

## Disclaimer

TenantWise provides general information about Ontario tenancy law. It does not provide legal advice and does not create a lawyer-client or paralegal-client relationship. For advice about your specific situation, contact a community legal clinic, a paralegal, a lawyer, or the Tenant Duty Counsel Program.
