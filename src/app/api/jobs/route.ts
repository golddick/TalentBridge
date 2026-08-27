import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJobDescription } from "@/lib/openai";

const createJobSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(20),
  location: z.string().optional(),
  employmentType: z.string().optional(),
  qualificationThreshold: z.number().min(0).max(100).optional(),
  autoGenerateRequirements: z.boolean().optional(),
  requirements: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.enum(["MANDATORY", "PREFERRED", "INFORMATIONAL"]).default("MANDATORY"),
        weight: z.number().min(0).max(100).default(10),
        mandatory: z.boolean().default(false),
        description: z.string().optional(),
      })
    )
    .optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.organizationId) return NextResponse.json({ jobs: [] });

  const jobs = await prisma.job.findMany({
    where: { organizationId: user.organizationId },
    include: { requirements: true, applications: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ jobs });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ensure the recruiter has an organization to attach jobs to (prototype
  // convenience — a full build would have an explicit org-creation flow).
  let organizationId = user.organizationId;
  if (!organizationId) {
    const org = await prisma.organization.create({ data: { name: `${user.name}'s Organization` } });
    await prisma.user.update({ where: { id: user.id }, data: { organizationId: org.id } });
    organizationId = org.id;
  }

  const body = await req.json().catch(() => null);
  const parsed = createJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const job = await prisma.job.create({
    data: {
      organizationId,
      title: data.title,
      description: data.description,
      location: data.location,
      employmentType: data.employmentType,
      qualificationThreshold: data.qualificationThreshold ?? 70,
      status: "OPEN",
    },
  });

  // Requirements can come from three places, in priority order:
  //   1. Manually entered rows from the "New job" form (same shape as
  //      prisma/seed.ts) — used as-is, no AI call at all.
  //   2. AI Service — Job Parser, if the recruiter left "auto-generate" on
  //      and didn't type any rows manually.
  //   3. Neither — the job is created with zero requirements and the
  //      recruiter can add them later from the job page.
  if (data.requirements && data.requirements.length > 0) {
    await prisma.jobRequirement.createMany({
      data: data.requirements.map((r) => ({
        jobId: job.id,
        name: r.name,
        description: r.description,
        type: r.type,
        weight: r.weight,
        mandatory: r.mandatory,
      })),
    });
  } else if (data.autoGenerateRequirements !== false) {
    try {
      const parsedJd = await parseJobDescription(data.description);
      if (parsedJd.requirements?.length) {
        await prisma.jobRequirement.createMany({
          data: parsedJd.requirements.map((r) => ({
            jobId: job.id,
            name: r.name,
            description: r.description,
            type: r.type,
            weight: r.weight,
            mandatory: r.mandatory,
          })),
        });
      }
    } catch (err) {
      // Non-fatal: the recruiter can add/edit requirements manually if the
      // AI parsing step fails (e.g. missing OPENAI_API_KEY in a dev environment).
      console.error("Job parsing failed:", err);
    }
  }

  const jobWithRequirements = await prisma.job.findUnique({
    where: { id: job.id },
    include: { requirements: true },
  });

  return NextResponse.json({ job: jobWithRequirements }, { status: 201 });
}
