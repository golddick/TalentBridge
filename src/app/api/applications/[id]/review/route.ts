import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const recruiterId = (session?.user as any)?.id || "unknown-recruiter";
  const { reason } = await req.json().catch(() => ({ reason: undefined }));

  await prisma.application.update({
    where: { id: params.id },
    data: { status: "REVIEW_REQUIRED" },
  });

  await prisma.recruiterDecision.create({
    data: { applicationId: params.id, recruiterId, decision: "REQUEST_REVIEW", reason },
  });

  await prisma.auditLog.create({
    data: { applicationId: params.id, actorId: recruiterId, action: "Recruiter requested further review" },
  });

  return NextResponse.json({ ok: true });
}
