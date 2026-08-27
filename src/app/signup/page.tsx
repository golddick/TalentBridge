"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type Step = "details" | "code";

/**
 * Recruiter self-service sign-up. Until now the only way into a recruiter
 * account was a Super Admin creating the organization at /admin and emailing
 * an invite; this is the front-door equivalent — a recruiter creates their own
 * organization and lands straight on the "post a job" screen.
 *
 * Nothing is written to the database on the first step: /api/auth/signup only
 * validates the form and emails a code. The Organization and RECRUITER user
 * are created by the "signup" NextAuth provider once that code is verified,
 * which also starts the session — so there's no separate sign-in afterwards.
 */
export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setAlreadyMember(false);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, organizationName, password }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Something went wrong. Try again.");
      if (data?.code === "ALREADY_MEMBER") setAlreadyMember(true);
      return;
    }

    setStep("code");
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    // The whole form rides along with the code: the provider verifies the code
    // first, then creates the organization and signs them in in one step.
    const res = await signIn("signup", {
      email,
      code,
      name,
      organizationName,
      password,
      redirect: false,
    });
    setLoading(false);

    if (res?.error) {
      setError("That code didn't work. Check it and try again.");
      return;
    }

    // Straight to job creation — the first thing a brand-new organization
    // needs is a vacancy to upload CVs against.
    router.push("/jobs/new");
    router.refresh();
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
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="font-display text-2xl font-bold text-ink">
            TalentBridge
          </Link>
          <p className="mt-1 text-sm text-muted">
            {step === "details"
              ? "Create your organization and start qualifying candidates."
              : "One last step — confirm your email."}
          </p>
        </div>

        <div className="card p-6">
          {step === "details" && (
            <form onSubmit={handleDetailsSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="mb-1 block text-sm font-medium text-ink">
                  Your name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  className="input"
                  placeholder="Jamie Recruiter"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

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

              <div>
                <label htmlFor="organizationName" className="mb-1 block text-sm font-medium text-ink">
                  Organization name
                </label>
                <input
                  id="organizationName"
                  type="text"
                  required
                  minLength={2}
                  className="input"
                  placeholder="Acme Recruiting"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted">
                  Your jobs, candidates, and shortlists all live under this organization.
                </p>
              </div>

              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  className="input"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted">
                  You can also sign in with an emailed code any time — a password just saves you
                  the step.
                </p>
              </div>

              {error && (
                <p className="text-sm text-danger">
                  {error}
                  {alreadyMember && (
                    <>
                      {" "}
                      <Link href="/login" className="text-accent underline hover:text-accent-hover">
                        Go to sign in
                      </Link>
                    </>
                  )}
                </p>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? "Sending code…" : "Create organization"}
              </button>

              <p className="text-center text-sm text-muted">
                Already have an account?{" "}
                <Link href="/login" className="text-accent hover:text-accent-hover">
                  Sign in
                </Link>
              </p>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <p className="text-sm text-muted">
                We sent a 6-digit code to <span className="font-medium text-ink">{email}</span>. Enter
                it to create <span className="font-medium text-ink">{organizationName}</span>.
              </p>

              <div>
                <label htmlFor="code" className="mb-1 block text-sm font-medium text-ink">
                  Verification code
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                  className="input tracking-[0.4em] text-center font-mono text-lg"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>

              {error && <p className="text-sm text-danger">{error}</p>}
              {info && <p className="text-sm text-success">{info}</p>}

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? "Creating…" : "Verify and create organization"}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setInfo(null);
                    setStep("details");
                  }}
                  className="text-muted hover:text-ink"
                >
                  Edit details
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
