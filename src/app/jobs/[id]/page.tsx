import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TopNav } from "@/components/TopNav";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ScoreDonut } from "@/components/ui/ScoreDonut";
import { RequirementsEditor } from "@/components/RequirementsEditor";
import { CvUploadWidget } from "@/components/CvUploadWidget";
import { ApplyWidget } from "@/components/ApplyWidget";
import { ShortlistEmailPanel } from "@/components/ShortlistEmailPanel";

const RECRUITING_ROLES = ["RECRUITER", "HIRING_MANAGER", "ADMIN"];

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const role = (session?.user as any)?.role as string | undefined;
  const isRecruitingRole = !!role && RECRUITING_ROLES.includes(role);
  const tab = searchParams.tab === "shortlisted" ? "shortlisted" : "candidates";

  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: {
      organization: true,
      requirements: true,
      applications: isRecruitingRole
        ? { include: { candidate: true }, orderBy: { qualificationScore: "desc" } }
        : false,
    },
  });

  if (!job) notFound();

  return (
    <div>
      <TopNav />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Link href="/jobs" className="mb-4 inline-block text-sm text-muted hover:text-ink">
          ← All jobs
        </Link>

        <JobHeader job={job} isRecruitingRole={isRecruitingRole} />

        {isRecruitingRole ? (
          <RecruiterView job={job as any} tab={tab} />
        ) : (
          <ApplicantView
            jobId={job.id}
            jobStatus={job.status}
            userId={userId}
            requirements={job.requirements}
          />
        )}
      </main>
    </div>
  );
}

function JobHeader({ job, isRecruitingRole }: { job: any; isRecruitingRole: boolean }) {
  const total = isRecruitingRole ? job.applications.length : 0;
  const qualified = isRecruitingRole
    ? job.applications.filter((a: any) => ["STRONG_MATCH", "QUALIFIED"].includes(a.qualificationStatus || "")).length
    : 0;
  const review = isRecruitingRole
    ? job.applications.filter((a: any) => a.qualificationStatus === "NEEDS_REVIEW").length
    : 0;
  const notQualified = isRecruitingRole
    ? job.applications.filter((a: any) => a.qualificationStatus === "NOT_QUALIFIED").length
    : 0;

  return (
    <div className="card mb-6 p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-medium text-accent">{job.organization.name}</p>
          <h1 className="font-display text-2xl font-bold">{job.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {job.location || "Remote"} · {job.employmentType || "Full-time"} ·{" "}
            <span className="uppercase">{job.status}</span>
          </p>
        </div>
        {isRecruitingRole && (
          <div className="flex shrink-0 gap-6 text-center text-sm">
            <MiniStat label="Applications" value={total} />
            <MiniStat label="Qualified" value={qualified} accent="success" />
            <MiniStat label="Needs Review" value={review} accent="warning" />
            <MiniStat label="Not Qualified" value={notQualified} accent="danger" />
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <span className="badge bg-canvas text-muted">
          Qualification threshold: {job.qualificationThreshold}%
        </span>
        <span className="badge bg-canvas text-muted">
          Posted {new Date(job.createdAt).toLocaleDateString()}
        </span>
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="mb-2 font-display text-sm font-semibold text-ink">Full job description</h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/80">{job.description}</p>
      </div>
    </div>
  );
}

/** Recruiter / Hiring Manager management view: requirements editor, bulk
 * upload, and the full candidate list — never shown to applicants (project
 * doc: "candidate list should only be seen by the recruiter, not the applicant").
 * A separate "Shortlisted" tab holds the bulk-email tool for candidates
 * already shortlisted from the Candidates tab. */
function RecruiterView({ job, tab }: { job: any; tab: "candidates" | "shortlisted" }) {
  const shortlisted = job.applications.filter((a: any) => a.status === "SHORTLISTED");

  return (
    <>
      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <RequirementsEditor requirements={job.requirements} />
        <CvUploadWidget jobId={job.id} />
      </div>

      <div className="mb-4 flex gap-2 border-b border-border">
        <Link
          href={`/jobs/${job.id}?tab=candidates`}
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "candidates" ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Candidates
        </Link>
        <Link
          href={`/jobs/${job.id}?tab=shortlisted`}
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "shortlisted" ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Shortlisted {shortlisted.length > 0 && `(${shortlisted.length})`}
        </Link>
      </div>

      {tab === "candidates" ? (
        <div className="card p-5">
          <h3 className="mb-4 font-display font-semibold">Candidates</h3>
          {job.applications.length === 0 ? (
            <p className="text-sm text-muted">No candidates yet. Upload a CV to begin.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {job.applications.map((app: any) => (
                <Link
                  key={app.id}
                  href={`/applications/${app.id}`}
                  className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-center transition-shadow hover:shadow-md"
                >
                  <ScoreDonut score={app.qualificationScore ?? 0} />
                  <span className="truncate text-sm font-medium text-ink" title={app.candidate.name}>
                    {app.candidate.name}
                  </span>
                  {app.qualificationStatus ? (
                    <StatusBadge status={app.qualificationStatus} />
                  ) : (
                    <span className="text-xs text-muted">{app.status}</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        <ShortlistEmailPanel
          jobId={job.id}
          candidates={shortlisted.map((a: any) => ({
            applicationId: a.id,
            candidateName: a.candidate.name,
            hasEmail: !!a.candidate.email,
          }))}
        />
      )}
    </>
  );
}

/** Applicant view: apply once, or — if already applied — jump straight to
 * their own qualification feedback. No requirements editor, no candidate list.
 * Requirement *names* are shown so applicants know what the role is looking
 * for, but never the recruiter-only weighting or mandatory/preferred status
 * (project doc: applicants see what's expected, not how it's scored). */
async function ApplicantView({
  jobId,
  jobStatus,
  userId,
  requirements,
}: {
  jobId: string;
  jobStatus: string;
  userId?: string;
  requirements: { id: string; name: string }[];
}) {
  const existingApplication = userId
    ? await prisma.application.findFirst({
        where: { jobId, candidate: { userId } },
      })
    : null;

  const requirementsList = requirements.length > 0 && (
    <div className="card p-5">
      <h3 className="mb-3 font-display font-semibold">What this role is looking for</h3>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-ink sm:grid-cols-3">
        {requirements.map((r) => (
          <li key={r.id} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {r.name}
          </li>
        ))}
      </ul>
    </div>
  );

  if (existingApplication) {
    return (
      <div className="space-y-6">
        {requirementsList}
        <div className="card p-5">
          <h3 className="mb-1 font-display font-semibold">You've already applied</h3>
          <p className="mb-3 text-sm text-muted">
            Status: <span className="text-ink">{existingApplication.status.replace(/_/g, " ")}</span>
          </p>
          <Link href={`/applications/${existingApplication.id}`} className="btn-primary">
            View your feedback
          </Link>
        </div>
      </div>
    );
  }

  if (jobStatus !== "OPEN") {
    return (
      <div className="space-y-6">
        {requirementsList}
        <div className="card p-5 text-sm text-muted">
          This role isn't currently accepting applications.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {requirementsList}
      <ApplyWidget jobId={jobId} />
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "success" | "warning" | "danger";
}) {
  const colorClass =
    accent === "success"
      ? "text-success"
      : accent === "warning"
      ? "text-warning"
      : accent === "danger"
      ? "text-danger"
      : "text-ink";
  return (
    <div>
      <div className={`font-mono text-lg font-semibold ${colorClass}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
