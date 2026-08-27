import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TopNav } from "@/components/TopNav";
import { SetPasswordForm } from "@/components/SetPasswordForm";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;

  return (
    <div>
      <TopNav />
      <main className="mx-auto max-w-md px-6 py-8">
        <h1 className="mb-1 text-2xl font-bold">Account</h1>
        <p className="mb-6 text-sm text-muted">Signed in as {session?.user?.email}</p>
        <SetPasswordForm hasPassword={!!user?.passwordHash} />
      </main>
    </div>
  );
}
