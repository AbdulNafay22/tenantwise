// Mirrors backend/app/schemas.py -- keep these in sync with the API.

export interface Citation {
  section_ids: string[];
  source_name: string;
  source_url: string;
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

export type ChatRole = "user" | "assistant" | "error";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  citations?: Citation[];
  /** The original situation text that produced this answer -- kept so a
   * later "generate LTB application" click can be tied back to it without
   * asking the user to retype anything. Only set on assistant messages. */
  sourceSituation?: string;
}
