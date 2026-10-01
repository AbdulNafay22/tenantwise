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
  /** Suggested next questions. Absent from older API responses. */
  follow_ups?: string[];
  disclaimer: string;
}

/** An earlier question/answer pair, sent back so a follow-up builds on it. */
export interface HistoryTurn {
  question: string;
  answer: string;
}

export interface TenantInfo {
  tenant_name: string;
  tenant_address: string;
  landlord_name: string;
}

export type TurnStatus = "loading" | "done" | "error";

/** One answer inside an exchange: the first answer to the situation, or a follow-up. */
export interface Turn {
  id: string;
  /** The follow-up question; undefined for the first answer to the situation itself. */
  followUp?: string;
  status: TurnStatus;
  answer?: string;
  citations?: Citation[];
  followUps?: string[];
  errorText?: string;
}

/** One situation the tenant described, plus every follow-up asked about it. The
 * situation text is also what "draft LTB application" sends, so nothing is retyped. */
export interface Exchange {
  id: string;
  question: string;
  turns: Turn[];
}
