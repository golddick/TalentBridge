import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const requirement = await prisma.jobRequirement.update({
    where: { id: params.id },
    data: {
      name: body.name,
      description: body.description,
      type: body.type,
      weight: body.weight,
      mandatory: body.mandatory,
    },
  });
  return NextResponse.json({ requirement });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.jobRequirement.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
