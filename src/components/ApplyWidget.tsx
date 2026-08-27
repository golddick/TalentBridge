"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ApplyWidget({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply() {
    if (!file) return;
    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/jobs/${jobId}/apply`, { method: "POST", body: formData });
    const data = await res.json().catch(() => ({}));

    setSubmitting(false);

    if (!res.ok && res.status !== 202) {
      setError(data?.error || "Something went wrong. Please try again.");
      return;
    }

    if (data.applicationId) {
      router.push(`/applications/${data.applicationId}`);
    }
  }

  return (
    <div className="card p-5">
      <h3 className="mb-1 font-display font-semibold">Apply for this role</h3>
      <p className="mb-3 text-sm text-muted">
        Upload your CV (PDF or DOCX). We'll compare it against this job's requirements and show
        you exactly how you match up.
      </p>

      <input
        type="file"
        accept=".pdf,.docx"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="input mb-3 file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-accent-hover"
      />

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <button onClick={handleApply} disabled={!file || submitting} className="btn-primary">
        {submitting ? "Submitting…" : "Submit application"}
      </button>
    </div>
  );
}
