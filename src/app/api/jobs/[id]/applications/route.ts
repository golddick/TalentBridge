import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadFileToDropAphi } from "@/lib/dropaphi-storage";
import { extractCvText } from "@/lib/cvText";
import { runQualificationPipeline } from "@/lib/pipeline";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const applications = await prisma.application.findMany({
    where: { jobId: params.id },
    include: { candidate: true, evaluation: true },
    orderBy: { qualificationScore: "desc" },
  });
  return NextResponse.json({ applications });
}

/**
 * Recruiters upload one or more CVs at once against a job (case study
 * requirement: "accept multiple candidate CVs"). Each file is:
 *   1. Uploaded to DropAphi -> public URL stored on the Application record
 *   2. Text-extracted (PDF/DOCX)
 *   3. Run through the qualification pipeline (extract -> score -> explain)
 *
 * This runs synchronously per file for the prototype. See lib/pipeline.ts
 * for the note on moving this onto a BullMQ queue at real scale.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const jobId = params.id;
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { requirements: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const formData = await req.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "At least one CV file is required." }, { status: 400 });
  }

  const results: { filename: string; applicationId?: string; error?: string }[] = [];

  for (const [index, file] of files.entries()) {
    try {
      // A short pause between files (after the first) spreads the two
      // OpenAI calls per CV out over time instead of firing a burst of
      // 2x-N calls almost simultaneously, which is what was tripping
      // per-minute rate limits and eating quota before a batch finished.
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, 1200));

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { url } = await uploadFileToDropAphi(
        buffer,
        file.name,
        file.type || "application/octet-stream",
        `cvs/${jobId}`
      );

      const candidate = await prisma.candidate.create({
        data: { name: file.name.replace(/\.(pdf|docx)$/i, "") },
      });

      const application = await prisma.application.create({
        data: {
          jobId,
          candidateId: candidate.id,
          cvUrl: url,
          status: "UPLOADED",
        },
      });

      await prisma.auditLog.create({
        data: { applicationId: application.id, actorId: "recruiter", action: "CV uploaded" },
      });

      const cvText = await extractCvText(buffer, file.name);
      await runQualificationPipeline(application.id, cvText);

      results.push({ filename: file.name, applicationId: application.id });
    } catch (err: any) {
      console.error(`Failed to process ${file.name}:`, err);
      results.push({ filename: file.name, error: err.message || "Processing failed" });
    }
  }

  return NextResponse.json({ results }, { status: 201 });
}
