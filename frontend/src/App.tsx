import { useEffect, useRef, useState } from "react";
import { ApiError, askSituation } from "./api";
import FormDialog from "./FormDialog";
import ResultCard from "./ResultCard";
import {
  ArrowUpIcon,
  DoorIcon,
  GithubIcon,
  LogoMark,
  ShieldIcon,
  WalletIcon,
  WrenchIcon,
} from "./icons";
import type { Exchange, TenantInfo } from "./types";
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
  return `q-${nextId}`;
}

export default function App() {
  // Newest first: the latest answer always sits directly under the search box.
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [draft, setDraft] = useState("");
  const [formSituation, setFormSituation] = useState<string | null>(null);
  const [tenantInfo, setTenantInfo] = useState<TenantInfo>({
    tenant_name: "",
    tenant_address: "",
    landlord_name: "",
  });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultsRef = useRef<HTMLElement>(null);

  const isAsking = exchanges.some((e) => e.status === "loading");

  // Auto-grow the search box up to a cap.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  function update(id: string, patch: Partial<Exchange>) {
    setExchanges((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  async function ask(situation: string, existingId?: string) {
    if (!situation || isAsking) return;

    const id = existingId ?? newId();
    if (existingId) {
      update(id, { status: "loading", errorText: undefined });
    } else {
      setExchanges((prev) => [{ id, question: situation, status: "loading" }, ...prev]);
    }
    setDraft("");
    requestAnimationFrame(() =>
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );

    try {
      const response = await askSituation(situation);
      update(id, { status: "done", answer: response.answer, citations: response.citations });
    } catch (err) {
      const errorText =
        err instanceof ApiError && err.status === 503
          ? "The assistant isn't available right now (the backend couldn't reach its language " +
            "model). Try again shortly."
          : "Something went wrong answering that. Please try rephrasing your situation.";
      update(id, { status: "error", errorText });
    }
  }

  function handleSubmit(event?: React.FormEvent) {
    event?.preventDefault();
    if (draft.trim().length >= 10) ask(draft.trim());
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleSubmit();
    }
  }

  function pickTopic(prompt: string) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    ask(prompt);
  }

  const canSend = !isAsking && draft.trim().length >= 10;
  const hasResults = exchanges.length > 0;

  return (
    <div className="page">
      <header className="topbar">
        <div className="container topbar-inner">
          <a className="brand" href="/" aria-label="TenantWise home">
            <LogoMark size={28} />
            <span className="brand-name">TenantWise</span>
            <span className="brand-badge">Ontario</span>
          </a>
          <a
            className="icon-button"
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="View source on GitHub"
          >
            <GithubIcon size={18} />
          </a>
        </div>
      </header>

      <main className={`container layout ${hasResults ? "has-results" : ""}`}>
        <section className={`hero ${hasResults ? "hero-compact" : ""}`}>
          <p className="hero-kicker">For tenants under Ontario's Residential Tenancies Act</p>
          <h1>
            Know your rights. <span className="hero-accent">Then act on them.</span>
          </h1>
          <p className="hero-sub">
            Describe your rental problem and get a plain-language answer grounded in real Landlord
            and Tenant Board guidance, with every source cited.
          </p>

          <form className="search" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what's happening with your rental..."
              maxLength={4000}
              aria-label="Describe your situation"
            />
            <button type="submit" className="send-button" disabled={!canSend} aria-label="Ask">
              <ArrowUpIcon size={18} />
            </button>
          </form>
          <p className="search-hint">Press Enter to ask. Shift + Enter for a new line.</p>
        </section>

        <aside className="how" aria-labelledby="how-heading">
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
          <p className="how-note">
            <strong>Not legal advice.</strong> General information only. For your specific case,
            contact a community legal clinic or Tenant Duty Counsel.
          </p>
        </aside>

        <div className="feed">
          {hasResults && (
            <section className="results" ref={resultsRef} aria-label="Answers">
              {exchanges.map((exchange, i) => (
                <ResultCard
                  key={exchange.id}
                  exchange={exchange}
                  defaultOpen={i === 0}
                  onRetry={() => ask(exchange.question, exchange.id)}
                  onDraftForm={() => setFormSituation(exchange.question)}
                />
              ))}
            </section>
          )}

          <section className="topics" aria-labelledby="topics-heading">
            <h2 id="topics-heading" className="section-label">
              {hasResults ? "Try another common situation" : "Start with a common situation"}
            </h2>
            <div className="topic-grid">
              {TOPICS.map(({ icon: Icon, title, prompt }) => (
                <button
                  key={title}
                  type="button"
                  className="topic-card"
                  onClick={() => pickTopic(prompt)}
                  disabled={isAsking}
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
        </div>
      </main>

      <footer className="site-footer">
        <div className="container">
          <p>
            <strong>Not legal advice.</strong> {DISCLAIMER}
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
