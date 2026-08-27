import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["MANDATORY", "PREFERRED", "INFORMATIONAL"]).default("MANDATORY"),
  weight: z.number().min(0).max(100).default(10),
  mandatory: z.boolean().default(false),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const requirements = await prisma.jobRequirement.findMany({ where: { jobId: params.id } });
  return NextResponse.json({ requirements });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const requirement = await prisma.jobRequirement.create({
    data: { jobId: params.id, ...parsed.data },
  });
  return NextResponse.json({ requirement }, { status: 201 });
}
