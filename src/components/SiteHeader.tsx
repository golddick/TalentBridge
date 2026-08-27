import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";


export async function SiteHeader({ active }: { active?: "jobs" }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  const dashboardHref = role === "SUPERADMIN" ? "/admin" : "/dashboard";

  return (
    <header className="mx-auto flex w-full items-center justify-between px-6 py-6">
      <div className="flex items-center gap-8">
        <Link href="/" className="font-display text-lg font-bold text-ink">
          TalentBridge
        </Link>
        <nav className="hidden sm:block">
          <Link
            href="/careers"
            className={`text-sm ${active === "jobs" ? "font-medium text-ink" : "text-muted hover:text-ink"}`}
          >
            Jobs
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <Link href="/careers" className="text-sm text-muted hover:text-ink sm:hidden">
          Jobs
        </Link>
        {session ? (
          <Link href={dashboardHref} className="btn-primary">
            Go to dashboard
          </Link>
        ) : (
          <>
            <Link href="/login" className="text-sm text-muted hover:text-ink">
              Sign in
            </Link>
            {/* Recruiters self-serve from here — /signup creates their
                organization as part of sign-up. */}
            <Link href="/signup" className="btn-primary">
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
