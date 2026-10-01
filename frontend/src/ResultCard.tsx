import { useEffect, useState } from "react";
import RichText from "./RichText";
import {
  AlertIcon,
  LogoMark,
  ArrowUpIcon,
  CheckIcon,
  ChevronIcon,
  CopyIcon,
  ExternalIcon,
  FileIcon,
} from "./icons";
import type { Exchange, Turn } from "./types";

interface Props {
  exchange: Exchange;
  /** Only the newest situation starts expanded; older ones fold down to their question. */
  defaultOpen: boolean;
  /** True while any question on the page is being answered. */
  isBusy: boolean;
  onRetry: (turn: Turn) => void;
  onFollowUp: (question: string) => void;
  onDraftForm: () => void;
}

export default function ResultCard({
  exchange,
  defaultOpen,
  isBusy,
  onRetry,
  onFollowUp,
  onDraftForm,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [prevDefaultOpen, setPrevDefaultOpen] = useState(defaultOpen);
  const [followUpDraft, setFollowUpDraft] = useState("");

  // When a newer situation pushes this one down, fold it (adjusting state during
  // render rather than in an effect, per React's "derived state" guidance).
  if (defaultOpen !== prevDefaultOpen) {
    setPrevDefaultOpen(defaultOpen);
    setOpen(defaultOpen);
  }

  const lastTurn = exchange.turns[exchange.turns.length - 1];
  const hasAnswer = exchange.turns.some((t) => t.status === "done");
  const asked = new Set(exchange.turns.map((t) => t.followUp));
  const suggestions =
    lastTurn.status === "done" ? (lastTurn.followUps ?? []).filter((q) => !asked.has(q)) : [];
  const canSendFollowUp = !isBusy && followUpDraft.trim().length >= 3;

  function sendFollowUp(question: string) {
    if (isBusy) return;
    onFollowUp(question);
    setFollowUpDraft("");
  }

  function handleFollowUpSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (canSendFollowUp) sendFollowUp(followUpDraft.trim());
  }

  return (
    <article className={`result ${open ? "result-open" : ""}`}>
      <button
        type="button"
        className="result-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="result-question">
          <span className="result-label">Conversation</span>
          <span className="result-question-text">{exchange.question}</span>
        </span>
        {exchange.turns.length > 1 && (
          <span className="result-count">
            {exchange.turns.length - 1} follow-up{exchange.turns.length > 2 ? "s" : ""}
          </span>
        )}
        <ChevronIcon size={18} className="result-chevron" />
      </button>

      {open && (
        <div className="result-body">
          <div className="chat">
            {exchange.turns.map((turn, i) => (
              <TurnView
                key={turn.id}
                turn={turn}
                question={turn.followUp ?? exchange.question}
                isFirst={i === 0}
                onRetry={() => onRetry(turn)}
              />
            ))}
          </div>

          {hasAnswer && (
            <div className="follow-up">
              {suggestions.length > 0 && (
                <div className="suggestions" aria-label="Suggested follow-up questions">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="suggestion-chip"
                      onClick={() => sendFollowUp(s)}
                      disabled={isBusy}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <form className="follow-up-form" onSubmit={handleFollowUpSubmit}>
                <input
                  value={followUpDraft}
                  onChange={(e) => setFollowUpDraft(e.target.value)}
                  placeholder="Ask a follow-up about this situation..."
                  maxLength={1000}
                  aria-label="Ask a follow-up question"
                />
                <button
                  type="submit"
                  className="send-button small"
                  disabled={!canSendFollowUp}
                  aria-label="Ask follow-up"
                >
                  <ArrowUpIcon size={16} />
                </button>
              </form>
            </div>
          )}

          {hasAnswer && (
            <div className="action-callout">
              <div className="action-icon">
                <FileIcon size={20} />
              </div>
              <div className="action-copy">
                <p className="action-title">Ready to take this to the LTB?</p>
                <p className="action-text">
                  Get a pre-filled draft of the matching T2 or T6 application, ready to review.
                </p>
              </div>
              <button type="button" className="primary-button" onClick={onDraftForm}>
                Draft application
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

interface TurnProps {
  turn: Turn;
  question: string;
  /** The first answer shows its sources expanded; follow-ups keep them folded. */
  isFirst: boolean;
  onRetry: () => void;
}

function TurnView({ turn, question, isFirst, onRetry }: TurnProps) {
  const [copied, setCopied] = useState(false);
  const [isSlow, setIsSlow] = useState(false);
  const isLoading = turn.status === "loading";

  // The backend runs on Render's free tier, which spins down after 15 minutes idle --
  // the first request after that can take 50+ seconds. Surface a cold-start hint once
  // a request has been pending a while so it reads as "working" rather than "broken".
  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => setIsSlow(true), 6000);
    return () => {
      clearTimeout(timer);
      setIsSlow(false);
    };
  }, [isLoading]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(turn.answer ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked (e.g. insecure context) -- nothing useful to show
    }
  }

  const citations = turn.citations ?? [];

  return (
    <>
      <div className="chat-user">
        <p className="chat-bubble">{question}</p>
      </div>

      <div className="chat-bot">
        <div className="chat-avatar">
          <LogoMark size={26} />
        </div>
        <div className="chat-bot-body">
      {isLoading && (
        <div aria-live="polite">
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
      )}

      {turn.status === "error" && (
        <div className="error-card" role="alert">
          <AlertIcon size={18} />
          <p>{turn.errorText}</p>
          <button type="button" className="secondary-button compact" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      {turn.status === "done" && turn.answer && (
        <>
          <RichText text={turn.answer} />

          <div className="answer-toolbar">
            <button type="button" className="ghost-button" onClick={handleCopy}>
              {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
              {copied ? "Copied" : "Copy answer"}
            </button>
          </div>

          {citations.length > 0 && (
            <details className="sources" open={isFirst}>
              <summary className="sources-summary">
                {citations.length} source{citations.length > 1 ? "s" : ""}
                <ChevronIcon size={14} className="sources-chevron" />
              </summary>
              <ol className="source-list">
                {citations.map((citation, idx) => (
                  <li key={idx}>
                    <a
                      className="source-card"
                      href={citation.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className="source-index">{idx + 1}</span>
                      <span className="source-main">
                        <span className="source-title">
                          {citation.source_name}
                          <ExternalIcon size={13} className="source-external" />
                        </span>
                        {citation.section_ids.length > 0 && (
                          <span className="source-sections">
                            {citation.section_ids.map((s) => (
                              <span key={s} className="tag">
                                s. {s}
                              </span>
                            ))}
                          </span>
                        )}
                        {citation.snippet && (
                          <span className="source-snippet">{citation.snippet}</span>
                        )}
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </>
      )}
        </div>
      </div>
    </>
  );
}
