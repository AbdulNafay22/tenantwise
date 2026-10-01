import { useEffect, useRef, useState } from "react";
import { ApiError, askSituation } from "./api";
import AnswerCard from "./AnswerCard";
import FormDialog from "./FormDialog";
import {
  AlertIcon,
  ArrowUpIcon,
  DoorIcon,
  GithubIcon,
  LogoMark,
  PlusIcon,
  ShieldIcon,
  WalletIcon,
  WrenchIcon,
} from "./icons";
import type { ChatMessage, TenantInfo } from "./types";
import "./App.css";

const REPO_URL = "https://github.com/AbdulNafay22/tenantwise";

const DISCLAIMER =
  "TenantWise provides general information about Ontario tenancy law. It is not legal advice " +
  "and does not create a lawyer-client or paralegal-client relationship. For advice about your " +
  "specific situation, contact a community legal clinic, a paralegal, a lawyer, or the Tenant " +
  "Duty Counsel Program.";

const TOPICS = [
  {
    icon: WrenchIcon,
    title: "Repairs & maintenance",
    prompt: "My landlord hasn't fixed my broken heater in three weeks",
  },
  {
    icon: DoorIcon,
    title: "Landlord entry",
    prompt: "My landlord keeps entering my apartment without any notice",
  },
  {
    icon: WalletIcon,
    title: "Deposits & rent",
    prompt: "My landlord won't return my rent deposit when I moved in",
  },
  {
    icon: ShieldIcon,
    title: "Eviction & harassment",
    prompt: "My landlord is threatening to evict me after I complained",
  },
];

const STEPS = [
  { title: "Describe it", text: "Explain what's happening in your own words." },
  { title: "Get a cited answer", text: "Plain-language rights, backed by real LTB sources." },
  { title: "Draft the form", text: "Download a pre-filled T2 or T6 application to review." },
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
  const [formSituation, setFormSituation] = useState<string | null>(null);
  const [tenantInfo, setTenantInfo] = useState<TenantInfo>({
    tenant_name: "",
    tenant_address: "",
    landlord_name: "",
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // The backend runs on Render's free tier, which spins down after 15 minutes idle --
  // the first request after that can take 50+ seconds to wake back up. Surface a
  // cold-start hint once a request has been pending a while so it reads as "working"
  // rather than "broken".
  useEffect(() => {
    if (!isAsking) {
      setIsSlow(false);
      return;
    }
    const timer = setTimeout(() => setIsSlow(true), 6000);
    return () => clearTimeout(timer);
  }, [isAsking]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isAsking]);

  // Auto-grow the composer up to a cap.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [draft]);

  async function submitSituation(situation: string) {
    if (!situation || isAsking) return;

    setMessages((prev) => [...prev, { id: newId(), role: "user", text: situation }]);
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
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "error", text, sourceSituation: situation },
      ]);
    } finally {
      setIsAsking(false);
    }
  }

  function retry(situation: string, errorId: string) {
    setMessages((prev) => {
      // drop the failed exchange (the error and the user message before it)
      const idx = prev.findIndex((m) => m.id === errorId);
      return idx > 0 ? prev.slice(0, idx - 1) : prev;
    });
    submitSituation(situation);
  }

  function handleSubmit(event?: React.FormEvent) {
    event?.preventDefault();
    if (draft.trim().length >= 10) submitSituation(draft.trim());
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleSubmit();
    }
  }

  function startOver() {
    setMessages([]);
    setDraft("");
    inputRef.current?.focus();
  }

  const isEmpty = messages.length === 0 && !isAsking;
  const canSend = !isAsking && draft.trim().length >= 10;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <button type="button" className="brand" onClick={startOver} aria-label="TenantWise home">
            <LogoMark size={28} />
            <span className="brand-name">TenantWise</span>
            <span className="brand-badge">Ontario</span>
          </button>
          <nav className="topbar-actions">
            {!isEmpty && (
              <button type="button" className="secondary-button compact" onClick={startOver}>
                <PlusIcon size={16} /> <span className="hide-sm">New question</span>
              </button>
            )}
            <a
              className="icon-button"
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="View source on GitHub"
            >
              <GithubIcon size={18} />
            </a>
          </nav>
        </div>
      </header>

      <div className="scroll" ref={scrollRef}>
        {isEmpty ? (
          <main className="home">
            <section className="hero">
              <p className="hero-kicker">For tenants under Ontario's Residential Tenancies Act</p>
              <h1>
                Know your rights.
                <br />
                <span className="hero-accent">Then act on them.</span>
              </h1>
              <p className="hero-sub">
                Describe your rental problem and get a plain-language answer grounded in real
                Landlord and Tenant Board guidance, with every source cited.
              </p>
            </section>

            <section aria-labelledby="topics-heading">
              <h2 id="topics-heading" className="section-label">
                Start with a common situation
              </h2>
              <div className="topic-grid">
                {TOPICS.map(({ icon: Icon, title, prompt }) => (
                  <button
                    key={title}
                    type="button"
                    className="topic-card"
                    onClick={() => submitSituation(prompt)}
                  >
                    <span className="topic-icon">
                      <Icon size={18} />
                    </span>
                    <span className="topic-title">{title}</span>
                    <span className="topic-prompt">"{prompt}"</span>
                  </button>
                ))}
              </div>
            </section>

            <section aria-labelledby="how-heading" className="how">
              <h2 id="how-heading" className="section-label">
                How it works
              </h2>
              <ol className="steps">
                {STEPS.map((step, i) => (
                  <li key={step.title} className="step">
                    <span className="step-num">{i + 1}</span>
                    <span>
                      <span className="step-title">{step.title}</span>
                      <span className="step-text">{step.text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </main>
        ) : (
          <main className="thread">
            {messages.map((message) => {
              if (message.role === "user") {
                return (
                  <div key={message.id} className="user-row">
                    <p className="user-bubble">{message.text}</p>
                  </div>
                );
              }
              if (message.role === "error") {
                return (
                  <div key={message.id} className="error-card" role="alert">
                    <AlertIcon size={18} />
                    <p>{message.text}</p>
                    {message.sourceSituation && (
                      <button
                        type="button"
                        className="secondary-button compact"
                        onClick={() => retry(message.sourceSituation!, message.id)}
                        disabled={isAsking}
                      >
                        Try again
                      </button>
                    )}
                  </div>
                );
              }
              return (
                <AnswerCard
                  key={message.id}
                  text={message.text}
                  citations={message.citations ?? []}
                  onDraftForm={
                    message.sourceSituation
                      ? () => setFormSituation(message.sourceSituation!)
                      : undefined
                  }
                />
              );
            })}

            {isAsking && (
              <div className="answer answer-pending" aria-live="polite">
                <div className="answer-avatar">
                  <LogoMark size={28} />
                </div>
                <div className="answer-body">
                  <p className="pending-label">
                    <span className="spinner" /> Searching LTB sources and drafting an answer
                  </p>
                  <div className="skeleton" style={{ width: "92%" }} />
                  <div className="skeleton" style={{ width: "84%" }} />
                  <div className="skeleton" style={{ width: "60%" }} />
                  {isSlow && (
                    <p className="pending-hint">
                      The server may be waking up from being idle. This can take up to a minute.
                    </p>
                  )}
                </div>
              </div>
            )}
          </main>
        )}
      </div>

      <footer className="dock">
        <div className="dock-inner">
        <form className="composer" onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isEmpty ? "Describe what's happening with your rental..." : "Describe another situation..."
            }
            maxLength={4000}
            aria-label="Describe your situation"
          />
          <button type="submit" className="send-button" disabled={!canSend} aria-label="Send">
            <ArrowUpIcon size={18} />
          </button>
        </form>
        <p className="dock-note" title={DISCLAIMER}>
          General information, not legal advice. For your specific case, contact a community legal
          clinic or Tenant Duty Counsel.
        </p>
        </div>
      </footer>

      {formSituation && (
        <FormDialog
          situation={formSituation}
          initialInfo={tenantInfo}
          onInfoChange={setTenantInfo}
          onClose={() => setFormSituation(null)}
        />
      )}
    </div>
  );
}
