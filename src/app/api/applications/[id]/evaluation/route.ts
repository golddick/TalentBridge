import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const evaluation = await prisma.evaluation.findUnique({
    where: { applicationId: params.id },
    include: { criteria: { include: { requirement: true } } },
  });
  if (!evaluation) return NextResponse.json({ error: "Not yet evaluated" }, { status: 404 });
  return NextResponse.json({ evaluation });
}
