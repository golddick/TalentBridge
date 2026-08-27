import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Hero3D } from "@/components/Hero3D";
import { SiteHeader } from "@/components/SiteHeader";

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const primaryHref = session ? (role === "SUPERADMIN" ? "/admin" : "/dashboard") : "/login";
  const primaryLabel = session ? "Go to dashboard" : "Sign in";

  return (
    <div>
      <SiteHeader />

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-10 md:grid-cols-2 md:py-20">
        <div>
          <span className="badge mb-4 bg-accent-soft text-accent-hover">
            AI Recruitment Assistant
          </span>
          <h1 className="font-display text-4xl font-bold leading-tight text-ink md:text-5xl">
            Qualify first.
            <br />
            Then get Hired.
          </h1>
          <p className="mt-5 max-w-md text-base text-muted">
            TalentBridge reads every CV against your job requirements, scores each candidate
            with cited evidence, and hands your recruiters a shortlist they can trust without
            ever making the hiring decision for you.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href={primaryHref} className="btn-primary">
              {primaryLabel}
            </Link>
            <a href="#how-it-works" className="btn-secondary">
              See how it works
            </a>
          </div>
          <div className="mt-10 flex gap-8 text-sm">
            <Metric value="100" suffix="→31" label="Applications qualified" />
            <Metric value="91" suffix="%" label="Evidence-backed score" />
            <Metric value="0" suffix="" label="Hiring decisions made by AI" />
          </div>
        </div>

        <Hero3D />
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y border-border bg-surface/60">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="mb-10 text-center font-display text-2xl font-bold">How it works</h2>
          <div className="grid gap-6 md:grid-cols-4">
            <Step
              n="1"
              title="Describe the role"
              body="Paste a job description. TalentBridge parses it into structured, weighted requirements."
            />
            <Step
              n="2"
              title="Upload every CV"
              body="Bulk-upload PDFs or DOCX files — hundreds at a time, extracted and structured automatically."
            />
            <Step
              n="3"
              title="Get a cited score"
              body="Every requirement is marked Confirmed, Unclear, or Not Found — with the CV text behind it."
            />
            <Step
              n="4"
              title="Recruiter decides"
              body="You shortlist, request review, or reject. The AI never makes that call for you."
            />
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-10 text-center font-display text-2xl font-bold">
          Built around one idea: evidence
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          <Feature
            title="Evidence, not assumptions"
            body="A skill is only ever marked Confirmed when the CV text actually supports it. Vague phrasing is flagged as Unclear, never guessed."
          />
          <Feature
            title="Fair by design"
            body="Age, gender, photos, and other irrelevant attributes are excluded from scoring. Blind screening hides identity entirely on request."
          />
          <Feature
            title="Humans stay in control"
            body="Every AI recommendation can be overridden by a recruiter, and every override is logged with a reason — nothing happens silently."
          />
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-14 text-center">
          <h2 className="font-display text-2xl font-bold">
            Stop ranking everyone. Qualify the right people.
          </h2>
          <Link href={primaryHref} className="btn-primary mt-6 inline-flex">
            {primaryLabel}
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        TalentBridge AI — Qualify first.  Hire smarter.
      </footer>
    </div>
  );
}

function Metric({ value, suffix, label }: { value: string; suffix: string; label: string }) {
  return (
    <div>
      <div className="font-mono text-xl font-semibold text-ink">
        {value}
        <span className="text-accent">{suffix}</span>
      </div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-accent font-mono text-sm font-bold text-white">
        {n}
      </div>
      <h3 className="mb-1 font-display font-semibold text-ink">{title}</h3>
      <p className="text-sm text-muted">{body}</p>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="evidence-card">
      <h3 className="mb-1 font-display font-semibold text-ink">{title}</h3>
      <p className="text-sm text-ink/80">{body}</p>
    </div>
  );
}
