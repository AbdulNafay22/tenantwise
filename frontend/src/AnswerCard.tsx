import { useState } from "react";
import RichText from "./RichText";
import { CheckIcon, CopyIcon, ExternalIcon, FileIcon, LogoMark } from "./icons";
import type { Citation } from "./types";

interface Props {
  text: string;
  citations: Citation[];
  onDraftForm?: () => void;
}

export default function AnswerCard({ text, citations, onDraftForm }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked (e.g. insecure context) -- nothing useful to show
    }
  }

  return (
    <article className="answer">
      <div className="answer-avatar">
        <LogoMark size={28} />
      </div>

      <div className="answer-body">
        <RichText text={text} />

        <div className="answer-toolbar">
          <button type="button" className="ghost-button" onClick={handleCopy}>
            {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
            {copied ? "Copied" : "Copy"}
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

        {onDraftForm && (
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
    </article>
  );
}
