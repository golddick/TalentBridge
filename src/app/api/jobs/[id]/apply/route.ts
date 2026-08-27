import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFileToDropAphi } from "@/lib/dropaphi-storage";
import { extractCvText } from "@/lib/cvText";
import { runQualificationPipeline } from "@/lib/pipeline";

/**
 * Applicant self-service apply flow (project doc §5.4 / §21.2) — distinct
 * from /api/jobs/:id/applications, which is the recruiter's bulk-intake path
 * and doesn't attach a userId. Here the Candidate record is tied to the
 * signed-in user, so the applicant can later view their own feedback and
 * TalentBridge can prevent duplicate applications to the same job.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status !== "OPEN") {
    return NextResponse.json({ error: "This job is not currently accepting applications." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const candidate = await prisma.candidate.upsert({
    where: { userId },
    update: {},
    create: { userId, name: user?.name || "Applicant", email: user?.email },
  });

  const existing = await prisma.application.findFirst({
    where: { jobId: job.id, candidateId: candidate.id },
  });
  if (existing) {
    return NextResponse.json({ applicationId: existing.id, alreadyApplied: true });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A CV file is required." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const { url } = await uploadFileToDropAphi(buffer, file.name, file.type, `cvs/${job.id}`);

  const application = await prisma.application.create({
    data: { jobId: job.id, candidateId: candidate.id, cvUrl: url, status: "UPLOADED" },
  });

  await prisma.auditLog.create({
    data: { applicationId: application.id, actorId: userId, action: "CV uploaded" },
  });

  try {
    const cvText = await extractCvText(buffer, file.name);
    await runQualificationPipeline(application.id, cvText);
  } catch (err: any) {
    console.error(`Failed to process application ${application.id}:`, err);
    return NextResponse.json(
      { applicationId: application.id, error: err.message || "Processing failed" },
      { status: 202 }
    );
  }

  return NextResponse.json({ applicationId: application.id }, { status: 201 });
}
