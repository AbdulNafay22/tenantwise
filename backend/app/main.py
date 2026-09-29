from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Must run before anything reads os.environ (e.g. app.services.llm.call_gemini
# checking GEMINI_API_KEY) -- python-dotenv was already a dependency but
# nothing was actually calling load_dotenv(), so a real .env file's values
# never made it into the process environment.
load_dotenv()

from app.routes.ask import router as ask_router  # noqa: E402
from app.routes.generate_form import router as generate_form_router  # noqa: E402

app = FastAPI(title="TenantWise API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tightened before production deploy (see README)
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ask_router)
app.include_router(generate_form_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
