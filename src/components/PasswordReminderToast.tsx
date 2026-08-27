"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DISMISS_KEY = "tb_password_reminder_dismissed";

export function PasswordReminderToast({ hasPassword }: { hasPassword: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (hasPassword) return;
    // Dismissal is remembered for the current browser session only — it
    // naturally reappears next time someone signs in with a fresh session,
    // which is the point at which "you just used an email code" is true again.
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    setVisible(true);
  }, [hasPassword]);

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0">
      <div className="card flex items-start gap-3 p-4 shadow-lg">
        <span className="text-lg" aria-hidden>
          🔐
        </span>
        <div className="flex-1 text-sm">
          <p className="font-medium text-ink">You signed in with an email code</p>
          <p className="mt-0.5 text-muted">
            Set a password for faster sign-in next time — your email code will always keep working too.
          </p>
          <div className="mt-2 flex gap-3">
            <Link href="/account" onClick={dismiss} className="font-medium text-accent hover:text-accent-hover">
              Set password
            </Link>
            <button onClick={dismiss} className="text-muted hover:text-ink">
              Not now
            </button>
          </div>
        </div>
        <button onClick={dismiss} aria-label="Dismiss" className="text-muted hover:text-ink">
          ✕
        </button>
      </div>
    </div>
  );
}
