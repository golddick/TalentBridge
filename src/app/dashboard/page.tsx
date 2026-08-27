import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TopNav } from "@/components/TopNav";
import { OrgFunnelChart } from "@/components/OrgFunnelChart";
import { ApplicantScoreChart } from "@/components/ApplicantScoreChart";

const RECRUITING_ROLES = ["RECRUITER", "HIRING_MANAGER", "ADMIN"];

/**
 * Organization Dashboard — the landing page after sign-in. Recruiters see
 * the org-wide qualification funnel; applicants see a chart of their own
 * scores across the jobs they've applied to instead (project doc §13 —
 * applicant transparency, distinct from the recruiter-facing dashboard).
 */
export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const role = (session?.user as any)?.role as string | undefined;

  if (role && !RECRUITING_ROLES.includes(role)) {
    return <ApplicantOverview userId={userId} userName={session?.user?.name} />;
  }

  return <RecruiterOverview userId={userId} userName={session?.user?.name} />;
}

async function RecruiterOverview({ userId, userName }: { userId?: string; userName?: string | null }) {
  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;

  if (!user?.organizationId) {
    return (
      <div>
        <TopNav userName={userName} />
        <main className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h1 className="mb-2 text-xl font-bold">You're not attached to an organization yet</h1>
          <p className="text-sm text-muted">
            Ask your platform admin to add you, or check the invite email sent to your address.
          </p>
        </main>
      </div>
    );
  }

  const [organization, jobs] = await Promise.all([
    prisma.organization.findUnique({ where: { id: user.organizationId } }),
    prisma.job.findMany({
      where: { organizationId: user.organizationId },
      include: { applications: { select: { qualificationStatus: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const allApplications = jobs.flatMap((j) => j.applications);
  const totalQualified = allApplications.filter((a) =>
    ["STRONG_MATCH", "QUALIFIED"].includes(a.qualificationStatus || "")
  ).length;
  const totalNeedsReview = allApplications.filter((a) => a.qualificationStatus === "NEEDS_REVIEW").length;
  const totalNotQualified = allApplications.filter((a) => a.qualificationStatus === "NOT_QUALIFIED").length;

  const chartData = jobs
    .filter((j) => j.applications.length > 0)
    .map((j) => ({
      title: j.title.length > 18 ? `${j.title.slice(0, 18)}…` : j.title,
      qualified: j.applications.filter((a) => ["STRONG_MATCH", "QUALIFIED"].includes(a.qualificationStatus || "")).length,
      needsReview: j.applications.filter((a) => a.qualificationStatus === "NEEDS_REVIEW").length,
      notQualified: j.applications.filter((a) => a.qualificationStatus === "NOT_QUALIFIED").length,
    }));

  return (
    <div>
      <TopNav userName={userName} />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{organization?.name}</h1>
            <p className="text-sm text-muted">Qualify first. Hire smarter.</p>
          </div>
          <Link href="/jobs/new" className="btn-primary">
            + New job
          </Link>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
          <SummaryCard label="Jobs" value={jobs.length} />
          <SummaryCard label="Applications" value={allApplications.length} />
          <SummaryCard label="Qualified" value={totalQualified} accent="success" />
          <SummaryCard label="Needs Review" value={totalNeedsReview} accent="warning" />
          <SummaryCard label="Not Qualified" value={totalNotQualified} accent="danger" />
        </div>

        <div className="card mb-6 p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display font-semibold">Qualification breakdown by job</h3>
            <Link href="/jobs" className="text-sm text-accent hover:text-accent-hover">
              View all jobs →
            </Link>
          </div>
          <OrgFunnelChart data={chartData} />
        </div>
      </main>
    </div>
  );
}

async function ApplicantOverview({ userId, userName }: { userId?: string; userName?: string | null }) {
  const applications = userId
    ? await prisma.application.findMany({
        where: { candidate: { userId } },
        include: { job: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const scored = applications.filter((a) => a.qualificationScore !== null);
  const avgScore = scored.length
    ? Math.round(scored.reduce((s, a) => s + (a.qualificationScore || 0), 0) / scored.length)
    : 0;
  const qualifiedCount = applications.filter((a) =>
    ["STRONG_MATCH", "QUALIFIED"].includes(a.qualificationStatus || "")
  ).length;
  const bestScore = scored.length ? Math.max(...scored.map((a) => a.qualificationScore || 0)) : 0;

  const chartData = scored.map((a) => ({
    jobTitle: a.job.title,
    score: a.qualificationScore || 0,
    status: a.qualificationStatus || "NOT_QUALIFIED",
  }));

  return (
    <div>
      <TopNav userName={userName} />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Your applications</h1>
          <p className="text-sm text-muted">Qualify first. Hire smarter.</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <SummaryCard label="Jobs applied to" value={applications.length} />
          <SummaryCard label="Qualified" value={qualifiedCount} accent="success" />
          <SummaryCard label="Average score" value={avgScore} />
          <SummaryCard label="Best match" value={bestScore} accent="success" />
        </div>

        <div className="card mb-6 p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display font-semibold">Your qualification scores</h3>
            <Link href="/jobs" className="text-sm text-accent hover:text-accent-hover">
              Browse open roles →
            </Link>
          </div>
          <ApplicantScoreChart data={chartData} />
        </div>

        {applications.length > 0 && (
          <div className="card overflow-hidden">
            <div className="border-b border-border px-5 py-3">
              <h3 className="font-display font-semibold">Recent applications</h3>
            </div>
            <ul className="divide-y divide-border">
              {applications.map((a) => (
                <li key={a.id}>
                  <Link href={`/applications/${a.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-canvas">
                    <span className="font-medium text-ink">{a.job.title}</span>
                    <span className="font-mono text-sm text-muted">{a.qualificationScore ?? "—"}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "success" | "warning" | "danger";
}) {
  const colorClass =
    accent === "success" ? "text-success" : accent === "warning" ? "text-warning" : accent === "danger" ? "text-danger" : "text-ink";
  return (
    <div className="card p-4">
      <div className={`font-mono text-2xl font-semibold ${colorClass}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
