# TenantWise frontend

React + TypeScript + Vite chat UI for the TenantWise backend. See the repo root
`README.md` for the project overview; running instructions are there too.

Quick reference:

```bash
npm install
cp .env.example .env  # only needed if the backend isn't on localhost:8000
npm run dev
```

- `src/App.tsx` -- the chat UI itself.
- `src/GenerateFormPanel.tsx` -- the "draft an LTB application" flow attached to each answer.
- `src/api.ts` -- the fetch wrapper for `/ask` and `/generate-form`.
