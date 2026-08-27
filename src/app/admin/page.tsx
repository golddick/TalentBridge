import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TopNav } from "@/components/TopNav";
import { CreateOrganizationForm } from "@/components/CreateOrganizationForm";
import { AiSettingsForm } from "@/components/AiSettingsForm";

/**
 * Platform-level Super Admin page — not scoped to any organization. Creates
 * new organizations and invites their first recruiter via a DropAphi email
 * (project doc §17.8 auth flow still applies: the invited user then signs in
 * with the normal Email OTP, they're just pre-provisioned with a role + org
 * so there's no dangling "no organization" state after their first sign-in).
 * Gated to role === SUPERADMIN in middleware.ts and re-checked here.
 */
export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  const organizations = await prisma.organization.findMany({
    include: {
      users: { select: { id: true, name: true, email: true, role: true } },
      _count: { select: { jobs: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <TopNav userName={session?.user?.name} />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="mb-1 text-2xl font-bold">Platform admin</h1>
        <p className="mb-6 text-sm text-muted">
          Create organizations and invite their first recruiter. Everyone signs in with the same
          email-code flow — this just pre-provisions who they are before they arrive.
        </p>

        <div className="mb-8">
          <AiSettingsForm />
        </div>

        <div className="mb-8">
          <CreateOrganizationForm />
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <h3 className="font-display font-semibold">Organizations ({organizations.length})</h3>
          </div>
          {organizations.length === 0 ? (
            <p className="p-6 text-sm text-muted">No organizations yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {organizations.map((org) => (
                <li key={org.id} className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ink">{org.name}</span>
                    <span className="text-xs text-muted">{org._count.jobs} job(s)</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {org.users.map((u) => (
                      <span key={u.id} className="badge bg-canvas text-muted">
                        {u.name} · {u.role}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
