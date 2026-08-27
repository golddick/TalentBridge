import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const application = await prisma.application.findUnique({
    where: { id: params.id },
    include: {
      candidate: { include: { skills: true } },
      job: { include: { requirements: true } },
      evaluation: { include: { criteria: { include: { requirement: true } } } },
      decisions: { orderBy: { createdAt: "desc" } },
      auditLogs: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  return NextResponse.json({ application });
}
