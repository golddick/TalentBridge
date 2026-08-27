import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/SiteHeader";
import { ViewToggle } from "@/components/ViewToggle";

/**
 * Public job board — no authentication required. Anyone visiting the site
 * can browse every OPEN role in card or list view. Clicking through to a
 * specific job still requires signing in (handled by middleware.ts), which
 * is where the actual apply flow lives.
 */
export default async function CareersPage({
  searchParams,
}: {
  searchParams: { view?: string };
}) {
  const view = searchParams.view === "list" ? "list" : "cards";

  const jobs = await prisma.job.findMany({
    where: { status: "OPEN" },
    include: { organization: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <SiteHeader active="jobs" />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Open roles</h1>
            <p className="text-sm text-muted">
              Browse every open position across TalentBridge organizations. Sign in to apply.
            </p>
          </div>
          {jobs.length > 0 && <ViewToggle current={view} basePath="/careers" />}
        </div>

        {jobs.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-ink">No open roles right now.</p>
            <p className="mt-1 text-sm text-muted">Check back soon — new roles are added regularly.</p>
          </div>
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
                <p className="mt-1 line-clamp-3 text-sm text-ink/70">{job.description}</p>
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
      </main>
    </div>
  );
}
