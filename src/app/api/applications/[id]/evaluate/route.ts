import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scoreCandidate } from "@/lib/scoring";
import { generateExplanation } from "@/lib/openai";
import type { ExtractedCandidateProfile } from "@/lib/types";

/**
 * Re-scores an application using the candidate's already-extracted profile
 * against the job's *current* requirements/weights — e.g. after a recruiter
 * adjusts weighting (project doc §7). Does not re-call the CV Extractor.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const application = await prisma.application.findUnique({
    where: { id: params.id },
    include: { job: { include: { requirements: true } }, candidate: true },
  });
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  if (!application.candidate.profile) {
    return NextResponse.json(
      { error: "This candidate has not been processed yet. Run /process first." },
      { status: 400 }
    );
  }

  const profile = application.candidate.profile as unknown as ExtractedCandidateProfile;
  const scoring = scoreCandidate(application.job.requirements, profile, application.job.qualificationThreshold);
  const explanation = await generateExplanation(application.job.title, scoring).catch(() => ({
    strengths: [],
    gaps: [],
    recommendation: "",
  }));

  const evaluation = await prisma.evaluation.upsert({
    where: { applicationId: application.id },
    create: {
      applicationId: application.id,
      score: scoring.overallScore,
      status: scoring.status,
      reason: scoring.reason,
      strengths: explanation.strengths as any,
      gaps: explanation.gaps as any,
      criteria: {
        create: scoring.criteria.map((c) => ({
          requirementId: c.requirementId,
          score: c.score,
          status: c.status,
          evidence: c.evidence,
          confidence: c.confidence,
        })),
      },
    },
    update: {
      score: scoring.overallScore,
      status: scoring.status,
      reason: scoring.reason,
      strengths: explanation.strengths as any,
      gaps: explanation.gaps as any,
      criteria: {
        deleteMany: {},
        create: scoring.criteria.map((c) => ({
          requirementId: c.requirementId,
          score: c.score,
          status: c.status,
          evidence: c.evidence,
          confidence: c.confidence,
        })),
      },
    },
  });

  await prisma.application.update({
    where: { id: application.id },
    data: { qualificationScore: scoring.overallScore, qualificationStatus: scoring.status },
  });

  return NextResponse.json({ evaluation, scoring });
}
