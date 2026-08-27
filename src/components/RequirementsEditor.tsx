"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

type Requirement = {
  id: string;
  name: string;
  type: string;
  weight: number;
  mandatory: boolean;
};

export function RequirementsEditor({ requirements }: { requirements: Requirement[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const totalWeight = requirements.reduce((s, r) => s + r.weight, 0);

  async function updateWeight(id: string, weight: number) {
    setSaving(id);
    await fetch(`/api/requirements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weight }),
    });
    setSaving(null);
    router.refresh();
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display font-semibold">Requirements & weighting</h3>
        <span
          className={clsx(
            "font-mono text-xs",
            totalWeight === 100 ? "text-success" : "text-warning"
          )}
        >
          Total weight: {totalWeight}%
        </span>
      </div>

      <div className="space-y-3">
        {requirements.map((r) => (
          <div key={r.id} className="flex items-center gap-3">
            <div className="w-40 shrink-0 truncate text-sm font-medium text-ink">{r.name}</div>
            <span
              className={clsx(
                "badge shrink-0",
                r.mandatory ? "bg-danger-soft text-danger" : "bg-canvas text-muted"
              )}
            >
              {r.mandatory ? "Mandatory" : r.type}
            </span>
            <input
              type="range"
              min={0}
              max={50}
              value={r.weight}
              onChange={(e) => updateWeight(r.id, Number(e.target.value))}
              className="flex-1 accent-accent"
            />
            <span className="w-10 shrink-0 text-right font-mono text-sm">
              {saving === r.id ? "…" : `${r.weight}%`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
