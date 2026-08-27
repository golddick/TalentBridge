import { prisma } from "./prisma";
import { extractCandidateProfile, generateExplanation } from "./openai";
import { scoreCandidate } from "./scoring";
import type { ExtractedCandidateProfile } from "./types";

/**
 * Runs the full CV Processing Pipeline for one application (project doc §9):
 *   Text Extraction (already done by the caller) -> AI Information Extraction
 *   -> Structured Candidate Profile -> Requirement Matching
 *   -> Qualification Score -> Explanation Generation
 *
 * NOTE: for this prototype the pipeline runs synchronously inside the API
 * request. At the "hundreds of applications" scale described in the case
 * study, this step should be pushed onto a BullMQ/Redis queue (project doc
 * §17.6) so uploads don't block on AI latency — the function is written to
 * be queue-ready (single applicationId in, no shared state).
 */
export async function runQualificationPipeline(applicationId: string, cvText: string) {
  const application = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { job: { include: { requirements: true } }, candidate: true },
  });

  await prisma.application.update({
    where: { id: applicationId },
    data: { status: "PROCESSING" },
  });

  // AI Service — CV Extractor
  let profile: ExtractedCandidateProfile;
  try {
    profile = await extractCandidateProfile(cvText);
  } catch (err) {
    await prisma.application.update({
      where: { id: applicationId },
      data: { status: "UPLOADED" },
    });
    throw err;
  }

  await prisma.candidate.update({
    where: { id: application.candidateId },
    data: {
      name: profile.name || application.candidate.name,
      email: profile.email || application.candidate.email,
      profile: profile as any,
      skills: {
        deleteMany: {},
        create: profile.skills.map((s) => ({
          skill: s.name,
          confidence: s.confidence,
          evidence: s.evidence,
        })),
      },
    },
  });

  await prisma.application.update({
    where: { id: applicationId },
    data: { status: "EXTRACTED" },
  });

  // Rule-Based Scoring Engine (deterministic, not an LLM call)
  await prisma.application.update({ where: { id: applicationId }, data: { status: "EVALUATING" } });
  const scoring = scoreCandidate(application.job.requirements, profile, application.job.qualificationThreshold);

  // AI Service — Explanation Service
  let explanation = { strengths: [] as string[], gaps: [] as string[], recommendation: "" };
  try {
    explanation = await generateExplanation(application.job.title, scoring);
  } catch (err) {
    console.error("Explanation generation failed:", err);
  }

  await prisma.evaluation.upsert({
    where: { applicationId },
    create: {
      applicationId,
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

  const finalStatus =
    scoring.status === "NOT_QUALIFIED" ? "NOT_QUALIFIED" : scoring.status === "NEEDS_REVIEW" ? "REVIEW_REQUIRED" : "QUALIFIED";

  await prisma.application.update({
    where: { id: applicationId },
    data: {
      status: finalStatus,
      qualificationScore: scoring.overallScore,
      qualificationStatus: scoring.status,
    },
  });

  await prisma.auditLog.create({
    data: {
      applicationId,
      actorId: "system-ai",
      action: "AI qualification completed",
      metadata: { score: scoring.overallScore, status: scoring.status },
    },
  });

  return { profile, scoring, explanation };
}
