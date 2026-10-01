// Mirrors backend/app/schemas.py -- keep these in sync with the API.

export interface Citation {
  section_ids: string[];
  source_name: string;
  source_url: string;
  /** Short preview of the actual retrieved source text, so the user can see why this
   * citation is relevant without leaving the page. May be empty for older API responses. */
  snippet?: string;
}

export interface AskResponse {
  answer: string;
  citations: Citation[];
  disclaimer: string;
}

export interface TenantInfo {
  tenant_name: string;
  tenant_address: string;
  landlord_name: string;
}

export type ExchangeStatus = "loading" | "done" | "error";

/** One question the tenant asked and what came back for it. The question text is
 * also what a later "draft LTB application" click sends, so nothing is retyped. */
export interface Exchange {
  id: string;
  question: string;
  status: ExchangeStatus;
  answer?: string;
  citations?: Citation[];
  errorText?: string;
}
