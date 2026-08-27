"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RecruiterActions({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function act(action: "shortlist" | "review" | "reject", reason?: string) {
    setLoading(action);
    await fetch(`/api/applications/${applicationId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setLoading(null);
    router.refresh();
  }

  async function addNote() {
    if (!note.trim()) return;
    setLoading("note");
    await fetch(`/api/applications/${applicationId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    setNote("");
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="card p-5">
      <h3 className="mb-3 font-display font-semibold">Recruiter actions</h3>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => act("shortlist")}
          disabled={loading !== null}
          className="btn-primary"
        >
          {loading === "shortlist" ? "…" : "Shortlist"}
        </button>
        <button
          onClick={() => act("review", "Recruiter requested a closer look.")}
          disabled={loading !== null}
          className="btn-secondary"
        >
          {loading === "review" ? "…" : "Request review"}
        </button>
        <button
          onClick={() => act("reject")}
          disabled={loading !== null}
          className="btn-secondary text-danger hover:bg-danger-soft"
        >
          {loading === "reject" ? "…" : "Reject"}
        </button>
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium text-ink">Add a note</label>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="e.g. Strong portfolio despite missing certification"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button onClick={addNote} disabled={loading !== null} className="btn-secondary shrink-0">
            {loading === "note" ? "…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
