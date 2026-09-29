import { useState } from "react";
import { ApiError, generateForm } from "./api";
import type { TenantInfo } from "./types";

type Status = "idle" | "form" | "loading" | "done" | "error";

interface Props {
  situation: string;
  initialInfo: TenantInfo;
  onInfoChange: (info: TenantInfo) => void;
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

export default function GenerateFormPanel({ situation, initialInfo, onInfoChange }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [info, setInfo] = useState<TenantInfo>(initialInfo);
  const [errorMessage, setErrorMessage] = useState("");

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
      onInfoChange(info); // remember details for next time
      setStatus("done");
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setErrorMessage(
          "This situation doesn't clearly match a specific LTB application form yet.",
        );
      } else if (err instanceof ApiError && err.status === 503) {
        setErrorMessage("The form-drafting service isn't available right now. Try again shortly.");
      } else {
        setErrorMessage("Something went wrong generating the form. Please try again.");
      }
      setStatus("error");
    }
  }

  if (status === "idle") {
    return (
      <button className="secondary-button" onClick={() => setStatus("form")}>
        Draft an LTB application (PDF)
      </button>
    );
  }

  if (status === "done") {
    return (
      <div className="form-panel form-panel-done">
        <p>Your draft LTB application PDF has downloaded.</p>
        <p className="fine-print">
          Review it carefully before filing -- this is a starting draft, not legal advice, and
          the tenant/landlord address fields may need manual corrections (see the app's README
          for known limitations).
        </p>
      </div>
    );
  }

  return (
    <form className="form-panel" onSubmit={handleSubmit}>
      <label>
        Your full name
        <input
          value={info.tenant_name}
          onChange={(e) => setInfo({ ...info, tenant_name: e.target.value })}
          placeholder="Jane Student"
          required
        />
      </label>
      <label>
        Your address (include postal code if you can)
        <input
          value={info.tenant_address}
          onChange={(e) => setInfo({ ...info, tenant_address: e.target.value })}
          placeholder="123 Gould St, Toronto, ON M5B 2K3"
          required
        />
      </label>
      <label>
        Landlord's name
        <input
          value={info.landlord_name}
          onChange={(e) => setInfo({ ...info, landlord_name: e.target.value })}
          placeholder="John Landlord"
          required
        />
      </label>

      {status === "error" && <p className="error-text">{errorMessage}</p>}

      <div className="form-panel-actions">
        <button type="submit" disabled={!canSubmit || status === "loading"}>
          {status === "loading" ? "Generating..." : "Generate PDF"}
        </button>
        <button type="button" className="link-button" onClick={() => setStatus("idle")}>
          Cancel
        </button>
      </div>
    </form>
  );
}
