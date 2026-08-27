import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, isPasswordValid, verifyPassword } from "@/lib/password";

const schema = z.object({
  newPassword: z.string(),
  currentPassword: z.string().optional(), // required only if a password is already set
});

/**
 * Lets a signed-in user set a password for the first time, or change an
 * existing one. Works for any role and any sign-in method used to get here
 * (OTP or password) — setting a password here is what unlocks the
 * password sign-in option going forward; it never disables OTP, which
 * always remains available as a fallback.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  if (!isPasswordValid(parsed.data.newPassword)) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // If a password is already set, require the current one before changing
  // it — otherwise anyone who can sign in via OTP could silently take over
  // password-based access without knowing the existing password.
  if (user.passwordHash) {
    if (!parsed.data.currentPassword) {
      return NextResponse.json({ error: "Enter your current password to change it." }, { status: 400 });
    }
    const isValid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
    if (!isValid) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
