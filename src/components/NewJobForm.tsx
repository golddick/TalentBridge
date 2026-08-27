"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RequirementRow = {
  name: string;
  type: "MANDATORY" | "PREFERRED" | "INFORMATIONAL";
  weight: number;
  mandatory: boolean;
};

const emptyRow = (): RequirementRow => ({
  name: "",
  type: "MANDATORY",
  weight: 10,
  mandatory: true,
});

type GeneratedRequirement = {
  name: string;
  type?: "MANDATORY" | "PREFERRED" | "INFORMATIONAL";
  weight?: number;
  mandatory?: boolean;
};

export function NewJobForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    employmentType: "Full-time",
    qualificationThreshold: 70,
  });
  const [requirements, setRequirements] = useState<RequirementRow[]>([emptyRow()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  function updateRequirement(index: number, patch: Partial<RequirementRow>) {
    setRequirements((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRequirement() {
    setRequirements((rows) => [...rows, emptyRow()]);
  }

  function removeRequirement(index: number) {
    setRequirements((rows) => rows.filter((_, i) => i !== index));
  }

  async function generateWithAI() {
    setGenerateError(null);

    if (form.description.trim().length < 20) {
      setGenerateError("Add a bit more detail to the job description first (20+ characters).");
      return;
    }

    setGenerating(true);
    const res = await fetch("/api/jobs/parse-requirements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: form.description }),
    });
    const data = await res.json().catch(() => ({}));
    setGenerating(false);

    if (!res.ok) {
      setGenerateError(data?.error || "Couldn't generate requirements right now.");
      return;
    }

    const generated: GeneratedRequirement[] = data.requirements || [];
    if (generated.length === 0) {
      setGenerateError("No requirements came back — try adding more detail, or add them manually below.");
      return;
    }

    // Replaces whatever's currently in the list. The recruiter can still
    // edit, add, or remove any row after generation — nothing here is final
    // until "Create job" is clicked.
    setRequirements(
      generated.map((r) => ({
        name: r.name,
        type: r.type || "MANDATORY",
        weight: r.weight ?? 10,
        mandatory: r.mandatory ?? r.type === "MANDATORY",
      }))
    );
  }

  const totalWeight = requirements.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const manualRequirements = requirements
      .filter((r) => r.name.trim().length > 0)
      .map((r) => ({ ...r, weight: Number(r.weight) || 0 }));

    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        // Fallback safety net only: if the recruiter never generated or
        // typed any requirements, the server will still try the AI Job
        // Parser once at creation time. The primary path is the "Generate
        // with AI" button above, which runs before submit and is editable.
        autoGenerateRequirements: manualRequirements.length === 0,
        requirements: manualRequirements.length > 0 ? manualRequirements : undefined,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Something went wrong creating the job. Please try again.");
      return;
    }

    const { job } = await res.json();
    router.push(`/jobs/${job.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card space-y-5 p-6">
        <Field label="Job title">
          <input
            required
            className="input"
            placeholder="Senior Backend Engineer"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </Field>

        <Field label="Job description">
          <textarea
            required
            rows={8}
            className="input"
            placeholder="Responsibilities, required skills, minimum experience, education, tools…"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Location">
            <input
              className="input"
              placeholder="Remote"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </Field>
          <Field label="Employment type">
            <select
              className="input"
              value={form.employmentType}
              onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
            >
              <option>Full-time</option>
              <option>Part-time</option>
              <option>Contract</option>
            </select>
          </Field>
        </div>

        <Field label={`Qualification threshold (${form.qualificationThreshold}%)`}>
          <input
            type="range"
            min={40}
            max={95}
            value={form.qualificationThreshold}
            onChange={(e) => setForm({ ...form, qualificationThreshold: Number(e.target.value) })}
            className="w-full accent-accent"
          />
        </Field>
      </div>

      <div className="card space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold">Requirements</h3>
          <button
            type="button"
            onClick={generateWithAI}
            disabled={generating}
            className="btn-secondary inline-flex items-center gap-1.5"
          >
            <span aria-hidden>✨</span>
            {generating ? "Generating…" : "Generate with AI"}
          </button>
        </div>

        <p className="text-sm text-muted">
          Click "Generate with AI" to turn the job description above into a weighted requirement
          list automatically, then edit, add, or remove any row before creating the job — or skip
          it and add everything manually 
        </p>

        {generateError && <p className="text-sm text-danger">{generateError}</p>}

        <div className="space-y-3">
          {requirements.map((row, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
              <input
                className="input flex-1 min-w-[140px]"
                placeholder="e.g. Node.js, 5+ years experience"
                value={row.name}
                onChange={(e) => updateRequirement(i, { name: e.target.value })}
              />
              <select
                className="input w-40"
                value={row.type}
                onChange={(e) =>
                  updateRequirement(i, {
                    type: e.target.value as RequirementRow["type"],
                    mandatory: e.target.value === "MANDATORY",
                  })
                }
              >
                <option value="MANDATORY">Mandatory</option>
                <option value="PREFERRED">Preferred</option>
                <option value="INFORMATIONAL">Informational</option>
              </select>
              <input
                type="number"
                min={0}
                max={100}
                className="input w-24"
                value={row.weight}
                onChange={(e) => updateRequirement(i, { weight: Number(e.target.value) })}
              />
              <span className="text-xs text-muted">% weight</span>
              <button
                type="button"
                onClick={() => removeRequirement(i)}
                className="ml-auto text-sm text-danger hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button type="button" onClick={addRequirement} className="btn-secondary">
            + Add requirement
          </button>
          {requirements.some((r) => r.name.trim()) && (
            <span className={`font-mono text-xs ${totalWeight === 100 ? "text-success" : "text-warning"}`}>
              Total weight: {totalWeight}%
            </span>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-3">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Creating…" : "Create job"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink">{label}</label>
      {children}
    </div>
  );
}
