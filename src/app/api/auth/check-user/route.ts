import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({ email: z.string().email() });

/**
 * Deliberately minimal disclosure: only ever returns whether a password is
 * set for this email, never whether the account exists at all — a brand
 * new email and an OTP-only existing account both come back
 * { hasPassword: false }, so both are indistinguishable and simply proceed
 * to the OTP flow (which itself creates the account on first verified code).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase().trim() },
    select: { passwordHash: true },
  });

  return NextResponse.json({ hasPassword: !!user?.passwordHash });
}
