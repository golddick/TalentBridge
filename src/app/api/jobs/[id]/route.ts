import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: {
      requirements: true,
      applications: {
        include: { candidate: true, evaluation: true },
        orderBy: { qualificationScore: "desc" },
      },
    },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({ job });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const job = await prisma.job.update({
    where: { id: params.id },
    data: {
      title: body.title,
      description: body.description,
      status: body.status,
      location: body.location,
      employmentType: body.employmentType,
      qualificationThreshold: body.qualificationThreshold,
    },
  });
  return NextResponse.json({ job });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.job.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
