import { useEffect, useRef, useState } from "react";
import { ApiError, askSituation } from "./api";
import GenerateFormPanel from "./GenerateFormPanel";
import type { ChatMessage, TenantInfo } from "./types";
import "./App.css";

const DISCLAIMER =
  "TenantWise provides general information about Ontario tenancy law. It is not legal advice " +
  "and does not create a lawyer-client or paralegal-client relationship. For advice about your " +
  "specific situation, contact a community legal clinic, a paralegal, a lawyer, or the Tenant " +
  "Duty Counsel Program.";

const EXAMPLE_SITUATIONS = [
  "My landlord hasn't fixed my broken heater in three weeks",
  "My landlord keeps entering my apartment without any notice",
  "My landlord won't return my rent deposit when I moved in",
  "My landlord is threatening to evict me after I complained",
];

let nextId = 0;
function newId() {
  nextId += 1;
  return `msg-${nextId}`;
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [isSlow, setIsSlow] = useState(false);
  const [tenantInfo, setTenantInfo] = useState<TenantInfo>({
    tenant_name: "",
    tenant_address: "",
    landlord_name: "",
  });
  const listEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The backend runs on Render's free tier, which spins down after 15 minutes idle --
  // the first request after that can take 50+ seconds to wake back up. Rather than let
  // the plain loading indicator sit there looking stuck, surface a cold-start hint once
  // a request has been pending a while so it reads as "working" rather than "broken".
  useEffect(() => {
    if (!isAsking) {
      setIsSlow(false);
      return;
    }
    const timer = setTimeout(() => setIsSlow(true), 6000);
    return () => clearTimeout(timer);
  }, [isAsking]);

  async function submitSituation(situation: string) {
    if (!situation || isAsking) return;

    const userMessage: ChatMessage = { id: newId(), role: "user", text: situation };
    setMessages((prev) => [...prev, userMessage]);
    setDraft("");
    setIsAsking(true);

    try {
      const response = await askSituation(situation);
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          text: response.answer,
          citations: response.citations,
          sourceSituation: situation,
        },
      ]);
    } catch (err) {
      const text =
        err instanceof ApiError && err.status === 503
          ? "The assistant isn't available right now (the backend couldn't reach its language " +
            "model). Try again shortly."
          : "Something went wrong answering that. Please try rephrasing your situation.";
      setMessages((prev) => [...prev, { id: newId(), role: "error", text }]);
    } finally {
      setIsAsking(false);
      requestAnimationFrame(() => listEndRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  }

  function handleSend(event: React.FormEvent) {
    event.preventDefault();
    submitSituation(draft.trim());
  }

  function handleExampleClick(example: string) {
    inputRef.current?.focus();
    submitSituation(example);
  }

  return (
    <div className="app">
      <header className="app-header">
        <p className="eyebrow">Ontario Residential Tenancies Act</p>
        <h1>TenantWise</h1>
        <p className="app-tagline">
          Plain-language answers about your rights as a tenant, grounded in real Landlord and
          Tenant Board sources -- with citations, not guesses.
        </p>
        <ul className="trust-row">
          <li>Cites real LTB guidelines</li>
          <li>Drafts real T2/T6 forms</li>
          <li>Ontario tenants only</li>
        </ul>
      </header>

      <div className="disclaimer-banner">
        <strong>Not legal advice.</strong> {DISCLAIMER}
      </div>

      <main className="chat-log">
        {messages.length === 0 && (
          <div className="empty-state">
            <h2>Describe what's happening</h2>
            <p>
              Tell TenantWise about your situation in your own words, or try one of these:
            </p>
            <div className="example-grid">
              {EXAMPLE_SITUATIONS.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="example-chip"
                  onClick={() => handleExampleClick(example)}
                  disabled={isAsking}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`message message-${message.role}`}>
            {message.role === "assistant" && <p className="message-label">TenantWise</p>}
            <p className="message-text">{message.text}</p>

            {message.role === "assistant" && message.citations && message.citations.length > 0 && (
              <ul className="citations">
                {message.citations.map((citation, idx) => (
                  <li key={idx}>
                    <a href={citation.source_url} target="_blank" rel="noreferrer">
                      {citation.source_name}
                    </a>
                    {citation.section_ids.length > 0 && (
                      <span className="citation-sections"> s. {citation.section_ids.join(", ")}</span>
                    )}
                    {citation.snippet && <p className="citation-snippet">"{citation.snippet}"</p>}
                  </li>
                ))}
              </ul>
            )}

            {message.role === "assistant" && message.sourceSituation && (
              <GenerateFormPanel
                situation={message.sourceSituation}
                initialInfo={tenantInfo}
                onInfoChange={setTenantInfo}
              />
            )}
          </div>
        ))}

        {isAsking && (
          <div className="message message-assistant message-pending">
            <p className="message-label">TenantWise</p>
            <p className="typing-indicator">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </p>
            {isSlow && (
              <p className="fine-print">
                Still working -- the server may be waking up from being idle, which can take
                up to about a minute.
              </p>
            )}
          </div>
        )}

        <div ref={listEndRef} />
      </main>

      <form className="composer" onSubmit={handleSend}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Describe your situation..."
          minLength={10}
          maxLength={4000}
          disabled={isAsking}
        />
        <button type="submit" disabled={isAsking || draft.trim().length < 10}>
          Send
        </button>
      </form>
    </div>
  );
}
