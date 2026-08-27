"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateOrganizationForm() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/admin/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationName, inviteEmail, inviteName: inviteName || undefined }),
    });

    setLoading(false);

    if (!res.ok) {
      setMessage({ type: "error", text: "Something went wrong creating the organization." });
      return;
    }

    const data = await res.json();
    setMessage({
      type: data.emailSent ? "success" : "error",
      text: data.emailSent
        ? `${organizationName} was created and an invite was sent to ${inviteEmail}.`
        : `${organizationName} was created, but the invite email failed to send. You can resend it from the organization list.`,
    });
    setOrganizationName("");
    setInviteEmail("");
    setInviteName("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-6">
      <h3 className="font-display font-semibold">Create a new organization</h3>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Organization name</label>
        <input
          required
          className="input"
          placeholder="Acme Recruiting"
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">First recruiter's email</label>
          <input
            required
            type="email"
            className="input"
            placeholder="recruiter@acme.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Their name (optional)</label>
          <input
            className="input"
            placeholder="Jamie Recruiter"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
          />
        </div>
      </div>

      {message && (
        <p className={`text-sm ${message.type === "success" ? "text-success" : "text-danger"}`}>
          {message.text}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Creating…" : "Create organization & send invite"}
      </button>
    </form>
  );
}
