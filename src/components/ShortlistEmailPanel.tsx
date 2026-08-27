"use client";

import { useState } from "react";

type ShortlistedCandidate = {
  applicationId: string;
  candidateName: string;
  hasEmail: boolean;
};

export function ShortlistEmailPanel({
  jobId,
  candidates,
}: {
  jobId: string;
  candidates: ShortlistedCandidate[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(candidates.map((c) => c.applicationId)));
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === candidates.length ? new Set() : new Set(candidates.map((c) => c.applicationId))
    );
  }

  async function generate() {
    setGenerating(true);
    setMessage(null);
    const res = await fetch(`/api/jobs/${jobId}/shortlist-email/generate`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setGenerating(false);

    if (!res.ok) {
      setMessage({ type: "error", text: data?.error || "Couldn't generate a draft." });
      return;
    }
    setSubject(data.subject || "");
    setBody(data.body || "");
  }

  async function send() {
    if (selected.size === 0 || !subject.trim() || !body.trim()) return;
    setSending(true);
    setMessage(null);

    const res = await fetch(`/api/jobs/${jobId}/shortlist-email/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationIds: Array.from(selected), subject, body }),
    });
    const data = await res.json().catch(() => ({ results: [] }));
    setSending(false);

    const sentCount = (data.results || []).filter((r: any) => r.sent).length;
    const failedCount = (data.results || []).length - sentCount;

    setMessage({
      type: failedCount === 0 ? "success" : "error",
      text:
        failedCount === 0
          ? `Sent to ${sentCount} candidate${sentCount === 1 ? "" : "s"}.`
          : `Sent to ${sentCount}, failed for ${failedCount} — check they have an email on file.`,
    });
  }

  if (candidates.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-muted">
        No shortlisted candidates yet. Shortlist someone from the Candidates tab first.
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display font-semibold">Shortlisted ({candidates.length})</h3>
          <button type="button" onClick={toggleAll} className="text-sm text-accent hover:text-accent-hover">
            {selected.size === candidates.length ? "Deselect all" : "Select all"}
          </button>
        </div>
        <ul className="space-y-1">
          {candidates.map((c) => (
            <li key={c.applicationId}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-canvas">
                <input
                  type="checkbox"
                  checked={selected.has(c.applicationId)}
                  onChange={() => toggle(c.applicationId)}
                  className="accent-accent"
                />
                <span className="text-sm text-ink">{c.candidateName}</span>
                {!c.hasEmail && <span className="ml-auto text-xs text-danger">No email on file</span>}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display font-semibold">Email to shortlisted candidates</h3>
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="btn-secondary inline-flex items-center gap-1.5"
          >
            <span aria-hidden>✨</span>
            {generating ? "Generating…" : "Generate email"}
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Subject</label>
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Body</label>
            <textarea
              rows={10}
              className="input"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder='Click "Generate email" above, or write your own.'
            />
          </div>
        </div>

        {message && (
          <p className={`mt-3 text-sm ${message.type === "success" ? "text-success" : "text-danger"}`}>
            {message.text}
          </p>
        )}

        <button
          type="button"
          onClick={send}
          disabled={sending || selected.size === 0 || !subject.trim() || !body.trim()}
          className="btn-primary mt-4"
        >
          {sending ? "Sending…" : `Send to ${selected.size} selected`}
        </button>
      </div>
    </div>
  );
}
