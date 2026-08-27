"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Step = "email" | "password" | "code";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function afterSignIn() {
    const freshSession = await getSession();
    const role = (freshSession?.user as any)?.role;
    router.push(role === "SUPERADMIN" ? "/admin" : "/dashboard");
    router.refresh();
  }

  async function requestOtp() {
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Something went wrong. Try again.");
      return false;
    }
    return true;
  }

  // Step 1: email only. Checks whether this account has a password set —
  // if so, show the password field; if not, go straight to the existing
  // email-code flow (unchanged default behavior for anyone who hasn't set
  // a password, including brand new applicants).
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/check-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({ hasPassword: false }));

    if (data.hasPassword) {
      setLoading(false);
      setStep("password");
      return;
    }

    const sent = await requestOtp();
    setLoading(false);
    if (sent) setStep("code");
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("password", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("That password didn't work. Check it and try again.");
      return;
    }
    await afterSignIn();
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("otp", { email, code, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("That code didn't work. Check it and try again.");
      return;
    }
    await afterSignIn();
  }

  async function switchToCode() {
    setError(null);
    setInfo(null);
    setLoading(true);
    const sent = await requestOtp();
    setLoading(false);
    if (sent) setStep("code");
  }

  async function resendCode() {
    setError(null);
    setInfo(null);
    setLoading(true);
    const res = await fetch("/api/auth/resend-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, reason: "not_received" }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Could not resend the code. Try again in a moment.");
      return;
    }
    setInfo("A new code is on its way.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">TalentBridge</h1>
          <p className="mt-1 text-sm text-muted">Qualify first. Hire smarter.</p>
        </div>

        <div className="card p-6">
          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
                  Work email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  className="input"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? "Checking…" : "Continue"}
              </button>
              <p className="text-center text-sm text-muted">
                Hiring and don't have an account?{" "}
                <Link href="/signup" className="text-accent hover:text-accent-hover">
                  Create your organization
                </Link>
              </p>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <p className="text-sm text-muted">
                Signing in as <span className="font-medium text-ink">{email}</span>
              </p>
              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoFocus
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? "Signing in…" : "Sign in"}
              </button>
              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={() => setStep("email")} className="text-muted hover:text-ink">
                  Use a different email
                </button>
                <button
                  type="button"
                  onClick={switchToCode}
                  disabled={loading}
                  className="text-accent hover:text-accent-hover"
                >
                  Use email code instead
                </button>
              </div>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <p className="text-sm text-muted">
                We sent a 6-digit code to <span className="font-medium text-ink">{email}</span>.
              </p>
              <div>
                <label htmlFor="code" className="mb-1 block text-sm font-medium text-ink">
                  Sign-in code
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  className="input tracking-[0.4em] text-center font-mono text-lg"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              {info && <p className="text-sm text-success">{info}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? "Verifying…" : "Verify and sign in"}
              </button>
              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={() => setStep("email")} className="text-muted hover:text-ink">
                  Use a different email
                </button>
                <button
                  type="button"
                  onClick={resendCode}
                  disabled={loading}
                  className="text-accent hover:text-accent-hover"
                >
                  Resend code
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
