import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TopNav } from "@/components/TopNav";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { ScoreDonut } from "@/components/ui/ScoreDonut";
import { EvidenceCard } from "@/components/ui/EvidenceCard";
import { RecruiterActions } from "@/components/RecruiterActions";

const RECRUITING_ROLES = ["RECRUITER", "HIRING_MANAGER", "ADMIN"];

export default async function ApplicationDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const role = (session?.user as any)?.role as string | undefined;
  const isRecruitingRole = !!role && RECRUITING_ROLES.includes(role);

  const application = await prisma.application.findUnique({
    where: { id: params.id },
    include: {
      candidate: true,
      job: true,
      evaluation: { include: { criteria: { include: { requirement: true } } } },
      auditLogs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!application) notFound();

  // Authorization: recruiting roles can view any application; an applicant
  // may only view their own (project doc: candidates only ever see their
  // own feedback, never other applicants').
  const isOwner = application.candidate.userId && application.candidate.userId === userId;
  if (!isRecruitingRole && !isOwner) {
    redirect("/jobs");
  }

  return isRecruitingRole ? (
    <RecruiterApplicationView application={application} />
  ) : (
    <ApplicantFeedbackView application={application} />
  );
}

/** Full recruiter view: evidence per requirement, recruiter actions, notes,
 * and the audit trail. Not shown to applicants. */
function RecruiterApplicationView({ application }: { application: any }) {
  const strengths = (application.evaluation?.strengths as string[] | null) || [];
  const gaps = (application.evaluation?.gaps as string[] | null) || [];
  const notes = application.auditLogs.filter((l: any) => l.action === "Recruiter note");
  const timeline = application.auditLogs.filter((l: any) => l.action !== "Recruiter note");

  return (
    <div>
      <TopNav />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Link href={`/jobs/${application.jobId}`} className="mb-4 inline-block text-sm text-muted hover:text-ink">
          ← {application.job.title}
        </Link>

        <div className="card mb-6 p-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold">{application.candidate.name}</h1>
              <p className="text-sm text-muted">Applying for {application.job.title}</p>
            </div>
            <div className="flex items-center gap-3">
              {application.qualificationStatus && <StatusBadge status={application.qualificationStatus} />}
            </div>
          </div>
          <div className="mb-4">
            <a
              href={application.cvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary inline-flex items-center gap-1.5 text-sm"
            >
              View / download CV
            </a>
          </div>
          <ScoreBar score={application.qualificationScore ?? 0} label="Overall qualification score" />
          {application.evaluation?.reason && (
            <p className="mt-3 text-sm text-muted">{application.evaluation.reason}</p>
          )}
        </div>

        <div className="mb-6 grid gap-6 md:grid-cols-2">
          <div className="card p-5">
            <h3 className="mb-3 font-display font-semibold text-success">Strengths</h3>
            {strengths.length ? (
              <ul className="space-y-1.5 text-sm text-ink">
                {strengths.map((s, i) => <li key={i}>✓ {s}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-muted">Not yet generated.</p>
            )}
          </div>
          <div className="card p-5">
            <h3 className="mb-3 font-display font-semibold text-warning">Gaps</h3>
            {gaps.length ? (
              <ul className="space-y-1.5 text-sm text-ink">
                {gaps.map((g, i) => <li key={i}>⚠ {g}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-muted">No gaps identified.</p>
            )}
          </div>
        </div>

        <div className="card mb-6 p-5">
          <h3 className="mb-3 font-display font-semibold">Evidence by requirement</h3>
          <div className="space-y-3">
            {application.evaluation?.criteria.map((c: any) => (
              <EvidenceCard
                key={c.id}
                requirement={`${c.requirement.name} — ${c.status.replace("_", " ")}`}
                evidence={c.evidence}
                source="CV"
              />
            ))}
            {!application.evaluation && <p className="text-sm text-muted">Not yet evaluated.</p>}
          </div>
        </div>

        <div className="mb-6">
          <RecruiterActions applicationId={application.id} />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="card p-5">
            <h3 className="mb-3 font-display font-semibold">Notes</h3>
            {notes.length ? (
              <ul className="space-y-2 text-sm">
                {notes.map((n: any) => (
                  <li key={n.id} className="text-ink">
                    {(n.metadata as any)?.note}
                    <div className="text-xs text-muted">{new Date(n.createdAt).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No notes yet.</p>
            )}
          </div>
          <div className="card p-5">
            <h3 className="mb-3 font-display font-semibold">Audit trail</h3>
            <ul className="space-y-2 text-sm">
              {timeline.map((t: any) => (
                <li key={t.id} className="flex justify-between gap-3 text-ink">
                  <span>{t.action}</span>
                  <span className="shrink-0 font-mono text-xs text-muted">
                    {new Date(t.createdAt).toLocaleTimeString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

/** Simplified applicant-facing feedback (project doc §13): score, status,
 * matched strengths and gaps in plain language — no raw CV evidence quotes,
 * no recruiter actions, no notes, no audit trail. */
function ApplicantFeedbackView({ application }: { application: any }) {
  const strengths = (application.evaluation?.strengths as string[] | null) || [];
  const gaps = (application.evaluation?.gaps as string[] | null) || [];

  return (
    <div>
      <TopNav />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <Link href="/jobs" className="mb-4 inline-block text-sm text-muted hover:text-ink">
          ← Open roles
        </Link>

        <div className="card p-6 text-center">
          <p className="mb-1 text-sm text-muted">Your application for</p>
          <h1 className="mb-4 font-display text-xl font-bold">{application.job.title}</h1>
          <div className="mb-3 flex justify-center">
            <ScoreDonut score={application.qualificationScore ?? 0} size={120} strokeWidth={10} />
          </div>
          {application.qualificationStatus && <StatusBadge status={application.qualificationStatus} />}
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="card p-5">
            <h3 className="mb-3 font-display font-semibold text-success">You matched</h3>
            {strengths.length ? (
              <ul className="space-y-1.5 text-sm text-ink">
                {strengths.map((s, i) => <li key={i}>✓ {s}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-muted">Still processing your application.</p>
            )}
          </div>
          <div className="card p-5">
            <h3 className="mb-3 font-display font-semibold text-warning">Potential gaps</h3>
            {gaps.length ? (
              <ul className="space-y-1.5 text-sm text-ink">
                {gaps.map((g, i) => <li key={i}>⚠ {g}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-muted">No gaps identified.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
