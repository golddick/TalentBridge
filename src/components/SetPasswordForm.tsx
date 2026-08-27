"use client";

import { useState } from "react";

export function SetPasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords don't match." });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters." });
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword, currentPassword: currentPassword || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setMessage({ type: "error", text: data?.error || "Something went wrong." });
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage({
      type: "success",
      text: hasPassword
        ? "Password updated. You can still sign in with an email code any time."
        : "Password set! You can now sign in with either your email code or this password.",
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-6">
      <div>
        <h3 className="font-display font-semibold">{hasPassword ? "Change password" : "Set a password"}</h3>
        <p className="text-sm text-muted">
          {hasPassword
            ? "Update your password below. Your email sign-in code will always keep working too."
            : "Optional — sign in with a password instead of an email code next time. The email code will always keep working as a fallback."}
        </p>
      </div>

      {hasPassword && (
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Current password</label>
          <input
            type="password"
            required
            className="input"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">New password</label>
        <input
          type="password"
          required
          minLength={8}
          className="input"
          placeholder="At least 8 characters"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Confirm new password</label>
        <input
          type="password"
          required
          className="input"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>

      {message && (
        <p className={`text-sm ${message.type === "success" ? "text-success" : "text-danger"}`}>
          {message.text}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Saving…" : hasPassword ? "Update password" : "Set password"}
      </button>
    </form>
  );
}
