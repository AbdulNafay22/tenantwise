import { useEffect, useState } from "react";
import RichText from "./RichText";
import { AlertIcon, CheckIcon, ChevronIcon, CopyIcon, ExternalIcon, FileIcon } from "./icons";
import type { Exchange } from "./types";

interface Props {
  exchange: Exchange;
  /** Only the newest answer starts expanded; older ones fold down to their question. */
  defaultOpen: boolean;
  onRetry: () => void;
  onDraftForm: () => void;
}

export default function ResultCard({ exchange, defaultOpen, onRetry, onDraftForm }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [prevDefaultOpen, setPrevDefaultOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const [isSlow, setIsSlow] = useState(false);

  // When a newer question pushes this one down, fold it (adjusting state during
  // render rather than in an effect, per React's "derived state" guidance).
  if (defaultOpen !== prevDefaultOpen) {
    setPrevDefaultOpen(defaultOpen);
    setOpen(defaultOpen);
  }

  const isLoading = exchange.status === "loading";

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
      await navigator.clipboard.writeText(exchange.answer ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked (e.g. insecure context) -- nothing useful to show
    }
  }

  const citations = exchange.citations ?? [];

  return (
    <article className={`result ${open ? "result-open" : ""}`}>
      <button
        type="button"
        className="result-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="result-question">
          <span className="result-label">Your situation</span>
          <span className="result-question-text">{exchange.question}</span>
        </span>
        <ChevronIcon size={18} className="result-chevron" />
      </button>

      {open && (
        <div className="result-body">
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

          {exchange.status === "error" && (
            <div className="error-card" role="alert">
              <AlertIcon size={18} />
              <p>{exchange.errorText}</p>
              <button type="button" className="secondary-button compact" onClick={onRetry}>
                Try again
              </button>
            </div>
          )}

          {exchange.status === "done" && exchange.answer && (
            <>
              <RichText text={exchange.answer} />

              <div className="answer-toolbar">
                <button type="button" className="ghost-button" onClick={handleCopy}>
                  {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
                  {copied ? "Copied" : "Copy answer"}
                </button>
              </div>

              {citations.length > 0 && (
                <section className="sources" aria-label="Sources">
                  <h3 className="section-label">Sources</h3>
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
                </section>
              )}

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
            </>
          )}
        </div>
      )}
    </article>
  );
}
