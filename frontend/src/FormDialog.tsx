import { useEffect, useRef, useState } from "react";
import { ApiError, generateForm } from "./api";
import { AlertIcon, CheckIcon, CloseIcon, DownloadIcon } from "./icons";
import type { TenantInfo } from "./types";

type Status = "form" | "loading" | "done" | "error";

interface Props {
  situation: string;
  initialInfo: TenantInfo;
  onInfoChange: (info: TenantInfo) => void;
  onClose: () => void;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function FormDialog({ situation, initialInfo, onInfoChange, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<Status>("form");
  const [info, setInfo] = useState<TenantInfo>(initialInfo);
  const [errorMessage, setErrorMessage] = useState("");

  // Native <dialog> gives us focus trapping, Esc-to-close and the backdrop for free.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const canSubmit =
    info.tenant_name.trim().length > 0 &&
    info.tenant_address.trim().length > 0 &&
    info.landlord_name.trim().length > 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setStatus("loading");
    setErrorMessage("");
    try {
      const blob = await generateForm(situation, info);
      downloadBlob(blob, "ltb_application_draft.pdf");
      onInfoChange(info); // remember details for the next draft
      setStatus("done");
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setErrorMessage("This situation doesn't clearly match a specific LTB application form yet.");
      } else if (err instanceof ApiError && err.status === 503) {
        setErrorMessage("The form-drafting service isn't available right now. Try again shortly.");
      } else {
        setErrorMessage("Something went wrong generating the form. Please try again.");
      }
      setStatus("error");
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      onClose={onClose}
      onClick={(e) => {
        // click on the backdrop (the dialog element itself, outside the panel)
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
    >
      <div className="dialog-panel">
        <header className="dialog-header">
          <div>
            <h2>Draft an LTB application</h2>
            <p className="dialog-subtitle">
              We'll match your situation to the right form and pre-fill it as a PDF.
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close"
            onClick={() => dialogRef.current?.close()}
          >
            <CloseIcon size={18} />
          </button>
        </header>

        {status === "done" ? (
          <div className="dialog-done">
            <div className="done-badge">
              <CheckIcon size={22} />
            </div>
            <h3>Your draft has downloaded</h3>
            <p>
              Review it carefully before filing. It's a starting point, not legal advice, and
              some address fields may need to be completed by hand.
            </p>
            <div className="dialog-actions">
              <button type="button" className="secondary-button" onClick={() => setStatus("form")}>
                <DownloadIcon size={16} /> Download again
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => dialogRef.current?.close()}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form className="dialog-form" onSubmit={handleSubmit}>
            <label className="field">
              <span className="field-label">Your full name</span>
              <input
                value={info.tenant_name}
                onChange={(e) => setInfo({ ...info, tenant_name: e.target.value })}
                placeholder="Jane Student"
                autoComplete="name"
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Your address</span>
              <input
                value={info.tenant_address}
                onChange={(e) => setInfo({ ...info, tenant_address: e.target.value })}
                placeholder="123 Gould St, Toronto, ON M5B 2K3"
                autoComplete="street-address"
                required
              />
              <span className="field-hint">Include your postal code so it can be filled in.</span>
            </label>
            <label className="field">
              <span className="field-label">Landlord's name</span>
              <input
                value={info.landlord_name}
                onChange={(e) => setInfo({ ...info, landlord_name: e.target.value })}
                placeholder="John Landlord"
                required
              />
            </label>

            {status === "error" && (
              <p className="inline-alert" role="alert">
                <AlertIcon size={16} /> {errorMessage}
              </p>
            )}

            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => dialogRef.current?.close()}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={!canSubmit || status === "loading"}
              >
                {status === "loading" ? (
                  <>
                    <span className="spinner" /> Generating
                  </>
                ) : (
                  <>
                    <DownloadIcon size={16} /> Generate PDF
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
