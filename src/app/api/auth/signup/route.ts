import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendOtp } from "@/lib/dropaphi-otp";
import { isPasswordValid } from "@/lib/password";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  organizationName: z.string().min(2),
  password: z.string(),
});

// Same simple in-memory throttle as request-otp: one code per email per 30s,
// so a stuck submit button can't spray DropAphi. A production deployment
// would move this to Redis so it works across instances.
const lastRequestAt = new Map<string, number>();

/**
 * Step 1 of recruiter self-service sign-up (/signup): validate the form and
 * email a verification code. Deliberately creates nothing — the Organization
 * and User are only written once the code comes back verified, by the
 * "signup" NextAuth provider in lib/auth.ts.
 *
 * Unlike check-user/route.ts, this route does tell the caller when an email
 * already belongs to an organization. That's unavoidable for a sign-up form
 * (it has to refuse duplicates to be usable at all), and the alternative —
 * silently signing them into their existing org after they typed a new org
 * name — is worse. The disclosure is limited to "already attached to an
 * organization": nothing about roles, org names, or whether a password is set.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter your name, work email, and an organization name of at least 2 characters." },
      { status: 400 }
    );
  }

  if (!isPasswordValid(parsed.data.password)) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { organizationId: true, role: true },
  });

  if (existing?.organizationId || existing?.role === "SUPERADMIN") {
    return NextResponse.json(
      {
        error: "That email is already attached to an organization on TalentBridge. Sign in instead.",
        code: "ALREADY_MEMBER",
      },
      { status: 409 }
    );
  }

  const last = lastRequestAt.get(email);
  if (last && Date.now() - last < 30_000) {
    return NextResponse.json(
      { error: "Please wait before requesting another code." },
      { status: 429 }
    );
  }
  lastRequestAt.set(email, Date.now());

  try {
    await sendOtp(email);
  } catch (err) {
    console.error("DropAphi send OTP failed (signup):", err);
    return NextResponse.json(
      { error: "Could not send a verification code right now. Please try again shortly." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
