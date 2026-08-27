import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendOrganizationInviteEmail } from "@/lib/dropaphi-email";

async function requireSuperadmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (role !== "SUPERADMIN") return null;
  return session;
}

export async function GET() {
  const session = await requireSuperadmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const organizations = await prisma.organization.findMany({
    include: {
      users: { select: { id: true, name: true, email: true, role: true } },
      _count: { select: { jobs: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ organizations });
}

const schema = z.object({
  organizationName: z.string().min(2),
  inviteEmail: z.string().email(),
  inviteName: z.string().min(1).optional(),
});

/**
 * Super Admin creates a new organization and invites its first recruiter.
 * The invited user is created immediately (role RECRUITER, attached to the
 * new org) so they land straight in that org's dashboard the moment they
 * sign in with the normal Email OTP flow — there's no separate invite-token
 * step, since DropAphi OTP already re-verifies the email on every sign-in.
 */
export async function POST(req: Request) {
  const session = await requireSuperadmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { organizationName, inviteEmail, inviteName } = parsed.data;
  const email = inviteEmail.toLowerCase().trim();

  const organization = await prisma.organization.create({
    data: { name: organizationName },
  });

  const recruiter = await prisma.user.upsert({
    where: { email },
    update: { organizationId: organization.id, role: "RECRUITER" },
    create: {
      email,
      name: inviteName || email.split("@")[0],
      role: "RECRUITER",
      organizationId: organization.id,
    },
  });

  const signInUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/login`;

  try {
    await sendOrganizationInviteEmail({
      to: email,
      organizationName,
      inviterName: session.user?.name || undefined,
      signInUrl,
    });
  } catch (err) {
    // The organization and recruiter are already created — a failed email
    // shouldn't roll that back, just surface it so the superadmin can resend.
    console.error("Organization invite email failed:", err);
    return NextResponse.json(
      { organization, recruiter, emailSent: false },
      { status: 201 }
    );
  }

  return NextResponse.json({ organization, recruiter, emailSent: true }, { status: 201 });
}
