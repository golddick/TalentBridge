import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const recruiterId = (session?.user as any)?.id || "unknown-recruiter";
  const { note } = await req.json().catch(() => ({ note: "" }));

  if (!note || typeof note !== "string") {
    return NextResponse.json({ error: "Note text is required." }, { status: 400 });
  }

  const log = await prisma.auditLog.create({
    data: {
      applicationId: params.id,
      actorId: recruiterId,
      action: "Recruiter note",
      metadata: { note },
    },
  });

  return NextResponse.json({ log }, { status: 201 });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const notes = await prisma.auditLog.findMany({
    where: { applicationId: params.id, action: "Recruiter note" },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ notes });
}
