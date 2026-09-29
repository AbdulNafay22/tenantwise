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

- **Backend**: FastAPI (`backend/app`). A local embedding model (`sentence-transformers/all-MiniLM-L6-v2`, run via `fastembed`'s ONNX Runtime rather than PyTorch -- see Status below for why) retrieves the most relevant corpus entries for a tenant's situation; Gemini generates the plain-language explanation from that retrieved context, always citing section numbers.
- **Frontend**: React + TypeScript, Vite (`frontend/`). A single-page chat UI: describe a situation, get a cited plain-language answer, and optionally generate a draft LTB application PDF from that same answer (collects tenant/landlord name and address once, remembers them for the rest of the session).
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

Note: the first test run downloads the `all-MiniLM-L6-v2` ONNX model (~90MB, cached after that). This needs normal internet access -- it will not work in a network-restricted sandbox, but works fine in a Codespace, CI runner, or Render.

## Running the frontend locally

```bash
cd frontend
npm install
cp .env.example .env  # only needed if your backend isn't on localhost:8000
npm run dev
```

Requires the backend running (see above) on `http://localhost:8000` by default.

## Status

- [x] Real, sourced RTA corpus (rent deposits, entry, maintenance, tenant rights/harassment)
- [x] RAG retrieval + cited Gemini answers, with an eval harness and test suite (68.2% -> passing after a corpus-vocabulary fix, see git history)
- [x] LTB form auto-fill pipeline (retrieval -> Gemini-drafted description -> real T2/T6 PDF filled with pypdf), tested against a synthetic fixture form
- [x] Real T2/T6 AcroForm field names wired into `backend/app/services/form_mapping.py` (captured 2026-09-27 via `scripts/inspect_form_fields.py` from the actual tribunalsontario.ca PDFs). **Verified end-to-end against the real forms, including visually**: generated a real T6 PDF through the running app (chat -> "Draft an LTB application" -> `/generate-form`) and confirmed in an actual PDF viewer that tenant name/address/province, landlord name, and a properly cited Gemini-drafted description all render correctly. Name splitting and address handling remain intentionally conservative -- see the caveats documented at the top of `form_mapping.py`.
- [x] Frontend chat UI (`frontend/`, React + TypeScript + Vite): chat interface for `/ask`, with a per-answer "Draft an LTB application" flow that calls `/generate-form` and downloads the resulting PDF. Verified working end-to-end in a real browser against the backend running in GitHub Codespaces.
- [~] Deploy -- backend on Render, frontend on Vercel. First Render deploy hit "Out of memory (used over 512Mi)" on the free tier: `sentence-transformers` pulls in PyTorch, whose own baseline footprint (independent of the model itself) doesn't fit in 512MB. Switched the embedding runtime to `fastembed` (ONNX Runtime, no PyTorch) for the exact same model and near-identical embeddings -- same retrieval quality, verified by re-running the eval gate, at a fraction of the memory. CORS is also now configurable via an `ALLOWED_ORIGINS` env var instead of hardcoded wide open, for the production frontend origin.

## Disclaimer

TenantWise provides general information about Ontario tenancy law. It does not provide legal advice and does not create a lawyer-client or paralegal-client relationship. For advice about your specific situation, contact a community legal clinic, a paralegal, a lawyer, or the Tenant Duty Counsel Program.
