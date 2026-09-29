import type { AskResponse, TenantInfo } from "./types";

// Vite exposes only vars prefixed VITE_ to client code. Falls back to the
// FastAPI dev server's default port so `npm run dev` works out of the box
// against `uvicorn app.main:app --reload` with no .env needed.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    // response wasn't JSON -- fall through to a generic message
  }
  return `Request failed with status ${response.status}`;
}

export async function askSituation(situation: string): Promise<AskResponse> {
  const response = await fetch(`${API_BASE_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ situation }),
  });

  if (!response.ok) {
    throw new ApiError(await parseErrorDetail(response), response.status);
  }
  return response.json();
}

export async function generateForm(
  situation: string,
  tenantInfo: TenantInfo,
): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/generate-form`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ situation, ...tenantInfo }),
  });

  if (!response.ok) {
    throw new ApiError(await parseErrorDetail(response), response.status);
  }
  return response.blob();
}
