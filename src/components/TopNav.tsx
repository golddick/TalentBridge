import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "./SignOutButton";
import { PasswordReminderToast } from "./PasswordReminderToast";

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: "Super Admin",
  RECRUITER: "Recruiter",
  HIRING_MANAGER: "Hiring Manager",
  APPLICANT: "Applicant",
  ADMIN: "Admin",
};

export async function TopNav({ userName }: { userName?: string | null }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  const userId = (session?.user as any)?.id as string | undefined;
  const isSuperadmin = role === "SUPERADMIN";
  const name = userName ?? session?.user?.name;

  // If they don't have a password set, they must have gotten in via the
  // email-code flow (password sign-in requires one to already exist) — that's
  // exactly the moment to nudge them toward setting one for next time.
  const user = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } }) : null;
  const hasPassword = !!user?.passwordHash;

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex w-full items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-4 sm:gap-8">
          <Link href="/dashboard" className="shrink-0 font-display text-lg font-bold text-ink">
            TalentBridge
          </Link>
          {!isSuperadmin && (
            <nav className="flex items-center gap-3 text-sm text-muted sm:gap-5">
              {/* <Link href="/dashboard" className="hover:text-ink">
                Overview
              </Link> */}
              <Link href="/jobs" className="hover:text-ink">
                Jobs
              </Link>
            </nav>
          )}
          {isSuperadmin && (
            <nav className="flex items-center gap-3 text-sm text-muted sm:gap-5">
              <Link href="/admin" className="hover:text-ink">
                Organizations
              </Link>
            </nav>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          {role && (
            <span className="badge hidden shrink-0 bg-accent-soft text-accent-hover sm:inline-flex">
              {ROLE_LABELS[role] || role}
            </span>
          )}
          {name && (
            <span className="hidden max-w-[10rem] truncate text-sm text-muted md:inline">
              {name}
            </span>
          )}
          {role && (
            <span className="badge shrink-0 bg-accent-soft text-accent-hover sm:hidden">
              {ROLE_LABELS[role] || role}
            </span>
          )}
          <Link href="/account" className="hidden text-sm text-muted hover:text-ink sm:inline">
            Account
          </Link>
          <SignOutButton />
        </div>
      </div>
      {session && <PasswordReminderToast hasPassword={hasPassword} />}
    </header>
  );
}
