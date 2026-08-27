import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TopNav } from "@/components/TopNav";
import { ViewToggle } from "@/components/ViewToggle";

const RECRUITING_ROLES = ["RECRUITER", "HIRING_MANAGER", "ADMIN"];

export default async function JobsPage({
  searchParams,
}: {
  searchParams: { view?: string };
}) {
  const view = searchParams.view === "cards" ? "cards" : "list";
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const role = (session?.user as any)?.role as string | undefined;
  const isRecruitingRole = !!role && RECRUITING_ROLES.includes(role);

  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;

  return (
    <div>
      <TopNav userName={session?.user?.name} />
      <main className="mx-auto max-w-6xl px-6 py-8">
        {isRecruitingRole ? (
          <RecruiterJobsList organizationId={user?.organizationId} view={view} />
        ) : (
          <ApplicantJobsBrowser view={view} />
        )}
      </main>
    </div>
  );
}

async function RecruiterJobsList({
  organizationId,
  view,
}: {
  organizationId?: string | null;
  view: "list" | "cards";
}) {
  const jobs = organizationId
    ? await prisma.job.findMany({
        where: { organizationId },
        include: { applications: { select: { qualificationStatus: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Jobs</h1>
          <p className="text-sm text-muted">All vacancies for your organization.</p>
        </div>
        <div className="flex items-center gap-3">
          {jobs.length > 0 && <ViewToggle current={view} basePath="/jobs" />}
          <Link href="/jobs/new" className="btn-primary">
            + New job
          </Link>
        </div>
      </div>

      {!organizationId ? (
        <EmptyState
          title="You're not attached to an organization yet."
          body="Ask your platform admin to add you, or check the invite email sent to your address."
        />
      ) : jobs.length === 0 ? (
        <EmptyState title="No jobs yet." body="Create your first vacancy to start receiving applications.">
          <Link href="/jobs/new" className="btn-primary mt-4 inline-flex">
            + New job
          </Link>
        </EmptyState>
      ) : view === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => {
            const total = job.applications.length;
            const qualified = job.applications.filter((a) =>
              ["STRONG_MATCH", "QUALIFIED"].includes(a.qualificationStatus || "")
            ).length;

            return (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="card flex flex-col gap-2 p-5 transition-shadow hover:shadow-md"
              >
                <h2 className="font-display text-lg font-semibold text-ink">{job.title}</h2>
                <p className="text-sm text-muted">
                  {job.location || "Remote"} · {job.employmentType || "Full-time"} · {job.status}
                </p>
                <div className="mt-2 flex gap-4 text-sm">
                  <Stat label="Applications" value={total} />
                  <Stat label="Qualified" value={qualified} accent="success" />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => {
            const total = job.applications.length;
            const qualified = job.applications.filter((a) =>
              ["STRONG_MATCH", "QUALIFIED"].includes(a.qualificationStatus || "")
            ).length;
            const review = job.applications.filter((a) => a.qualificationStatus === "NEEDS_REVIEW").length;
            const notQualified = job.applications.filter(
              (a) => a.qualificationStatus === "NOT_QUALIFIED"
            ).length;

            return (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="card flex items-center justify-between p-5 transition-shadow hover:shadow-md"
              >
                <div>
                  <h2 className="font-display text-lg font-semibold text-ink">{job.title}</h2>
                  <p className="text-sm text-muted">
                    {job.location || "Remote"} · {job.employmentType || "Full-time"} · {job.status}
                  </p>
                </div>
                <div className="flex gap-6 text-center text-sm">
                  <Stat label="Applications" value={total} />
                  <Stat label="Qualified" value={qualified} accent="success" />
                  <Stat label="Needs Review" value={review} accent="warning" />
                  <Stat label="Not Qualified" value={notQualified} accent="danger" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

/** Applicants aren't scoped to an organization, so they browse every OPEN
 * role across the whole platform (project doc §21.2 — "apply for a job"). */
async function ApplicantJobsBrowser({ view }: { view: "list" | "cards" }) {
  const jobs = await prisma.job.findMany({
    where: { status: "OPEN" },
    include: { organization: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Open roles</h1>
          <p className="text-sm text-muted">Browse open positions and apply directly.</p>
        </div>
        {jobs.length > 0 && <ViewToggle current={view} basePath="/jobs" />}
      </div>

      {jobs.length === 0 ? (
        <EmptyState title="No open roles right now." body="Check back soon — new roles are added regularly." />
      ) : view === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="card flex flex-col gap-2 p-5 transition-shadow hover:shadow-md"
            >
              <p className="text-sm font-medium text-accent">{job.organization.name}</p>
              <h2 className="font-display text-lg font-semibold text-ink">{job.title}</h2>
              <p className="text-sm text-muted">
                {job.location || "Remote"} · {job.employmentType || "Full-time"}
              </p>
              <span className="mt-2 text-sm font-medium text-accent">View & apply →</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="card flex items-center justify-between p-5 transition-shadow hover:shadow-md"
            >
              <div>
                <p className="text-sm font-medium text-accent">{job.organization.name}</p>
                <h2 className="font-display text-lg font-semibold text-ink">{job.title}</h2>
                <p className="text-sm text-muted">
                  {job.location || "Remote"} · {job.employmentType || "Full-time"}
                </p>
              </div>
              <span className="btn-secondary shrink-0">View & apply →</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function EmptyState({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="card p-10 text-center">
      <p className="text-ink">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
      {children}
    </div>
  );
}

function Stat({
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
      <div className={`font-mono text-xl font-semibold ${colorClass}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
