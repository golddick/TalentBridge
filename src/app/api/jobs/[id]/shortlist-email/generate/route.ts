import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateShortlistEmail } from "@/lib/openai";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: { organization: true },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  try {
    const draft = await generateShortlistEmail(job.title, job.organization.name);
    return NextResponse.json(draft);
  } catch (err: any) {
    console.error("Shortlist email generation failed:", err);
    return NextResponse.json(
      { error: "Couldn't generate a draft right now. Feel free to write the email manually below." },
      { status: 502 }
    );
  }
}
