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
import type { Exchange, HistoryTurn, TenantInfo, Turn } from "./types";
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

  const isAsking = exchanges.some((e) => e.turns.some((t) => t.status === "loading"));

  // Auto-grow the search box up to a cap.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  function updateTurn(exchangeId: string, turnId: string, patch: Partial<Turn>) {
    setExchanges((prev) =>
      prev.map((e) =>
        e.id === exchangeId
          ? { ...e, turns: e.turns.map((t) => (t.id === turnId ? { ...t, ...patch } : t)) }
          : e,
      ),
    );
  }

  async function runTurn(exchange: Exchange, turn: Turn) {
    // Everything answered before this turn becomes the follow-up's context.
    const priorTurns = exchange.turns.slice(0, exchange.turns.findIndex((t) => t.id === turn.id));
    const history: HistoryTurn[] = priorTurns
      .filter((t) => t.status === "done" && t.answer)
      .map((t) => ({
        question: (t.followUp ?? exchange.question).slice(0, 1000),
        answer: t.answer!.slice(0, 6000),
      }))
      .slice(-6);

    try {
      const response = await askSituation(
        exchange.question,
        turn.followUp ? { question: turn.followUp, history } : undefined,
      );
      updateTurn(exchange.id, turn.id, {
        status: "done",
        answer: response.answer,
        citations: response.citations,
        followUps: response.follow_ups ?? [],
      });
    } catch (err) {
      const errorText =
        err instanceof ApiError && err.status === 503
          ? "The assistant isn't available right now (the backend couldn't reach its language " +
            "model). Try again shortly."
          : "Something went wrong answering that. Please try rephrasing.";
      updateTurn(exchange.id, turn.id, { status: "error", errorText });
    }
  }

  function ask(situation: string) {
    if (!situation || isAsking) return;
    const turn: Turn = { id: newId(), status: "loading" };
    const exchange: Exchange = { id: newId(), question: situation, turns: [turn] };
    setExchanges((prev) => [exchange, ...prev]);
    setDraft("");
    requestAnimationFrame(() =>
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
    runTurn(exchange, turn);
  }

  function askFollowUp(exchange: Exchange, question: string) {
    if (!question || isAsking) return;
    const turn: Turn = { id: newId(), followUp: question, status: "loading" };
    const next = { ...exchange, turns: [...exchange.turns, turn] };
    setExchanges((prev) => prev.map((e) => (e.id === exchange.id ? next : e)));
    runTurn(next, turn);
  }

  function retry(exchange: Exchange, turn: Turn) {
    if (isAsking) return;
    updateTurn(exchange.id, turn.id, { status: "loading", errorText: undefined });
    runTurn(exchange, turn);
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
          <p className="search-hint">Each situation starts its own conversation. Press Enter to ask, Shift + Enter for a new line.</p>
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
                  isBusy={isAsking}
                  onRetry={(turn) => retry(exchange, turn)}
                  onFollowUp={(question) => askFollowUp(exchange, question)}
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
