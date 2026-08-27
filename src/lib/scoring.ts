import type { JobRequirement } from "@prisma/client";
import type { CriterionResult, ExtractedCandidateProfile, ScoringResult } from "./types";

/**
 * TalentBridge Rule-Based Scoring Engine
 * ---------------------------------------------------------------------------
 * This is intentionally NOT an LLM call. The AI layer (lib/openai.ts) is only
 * responsible for extracting structured, evidence-tagged data from the CV and
 * job description. This function turns that structured data into a
 * deterministic, reproducible score, so the number a recruiter sees can
 * always be recalculated and audited without depending on model variance.
 */

const YEARS_REQUIREMENT_PATTERN = /(\d+)\s*\+?\s*years?/i;

function normalize(name: string) {
  return name.trim().toLowerCase();
}

/** Matches a single job requirement against the extracted candidate profile. */
function matchRequirement(
  requirement: JobRequirement,
  profile: ExtractedCandidateProfile
): CriterionResult {
  const yearsMatch = requirement.name.match(YEARS_REQUIREMENT_PATTERN);

  // Experience-length requirements ("5+ years experience") are matched against
  // the candidate's extracted total/relevant years rather than the skills list.
  if (yearsMatch) {
    const requiredYears = parseInt(yearsMatch[1], 10);
    const candidateYears =
      profile.experience.relevantYears ?? profile.experience.years ?? 0;

    if (candidateYears >= requiredYears) {
      return {
        requirementId: requirement.id,
        requirementName: requirement.name,
        status: "CONFIRMED",
        score: 100,
        evidence: `Candidate profile shows ${candidateYears} year(s) of relevant experience.`,
        confidence: 0.95,
      };
    }
    if (candidateYears >= requiredYears * 0.6) {
      return {
        requirementId: requirement.id,
        requirementName: requirement.name,
        status: "UNCLEAR",
        score: 50,
        evidence: `Candidate profile shows ${candidateYears} year(s) against a ${requiredYears}-year requirement.`,
        confidence: 0.6,
      };
    }
    return {
      requirementId: requirement.id,
      requirementName: requirement.name,
      status: "NOT_FOUND",
      score: 0,
      evidence: `Candidate profile shows only ${candidateYears} year(s) of relevant experience.`,
      confidence: 0.9,
    };
  }

  // Skill / tool / certification / education requirements are matched by name
  // against the extracted skills list, which already carries an evidence-backed
  // status assigned by the CV Extractor (see lib/openai.ts).
  const target = normalize(requirement.name);
  const match = profile.skills.find((skill) => {
    const skillName = normalize(skill.name);
    return skillName === target || skillName.includes(target) || target.includes(skillName);
  });

  if (!match) {
    return {
      requirementId: requirement.id,
      requirementName: requirement.name,
      status: "NOT_FOUND",
      score: 0,
      confidence: 0.85,
    };
  }

  if (match.status === "confirmed") {
    return {
      requirementId: requirement.id,
      requirementName: requirement.name,
      status: "CONFIRMED",
      score: 100,
      evidence: match.evidence,
      confidence: match.confidence,
    };
  }

  if (match.status === "unclear") {
    return {
      requirementId: requirement.id,
      requirementName: requirement.name,
      status: "UNCLEAR",
      score: 50,
      evidence: match.evidence,
      confidence: match.confidence,
    };
  }

  return {
    requirementId: requirement.id,
    requirementName: requirement.name,
    status: "NOT_FOUND",
    score: 0,
    evidence: match.evidence,
    confidence: match.confidence,
  };
}

export function scoreCandidate(
  requirements: JobRequirement[],
  profile: ExtractedCandidateProfile,
  qualificationThreshold: number = 70
): ScoringResult {
  const criteria = requirements.map((requirement) => matchRequirement(requirement, profile));

  const totalWeight = requirements.reduce((sum, r) => sum + r.weight, 0) || 1;
  const weightedScore = requirements.reduce((sum, requirement, i) => {
    return sum + criteria[i].score * (requirement.weight / totalWeight);
  }, 0);

  const overallScore = Math.round(weightedScore);

  // Mandatory Requirement Override (project doc §7.1 / §15):
  // a candidate can never be presented as a Strong Match or fully Qualified
  // if a mandatory requirement is unresolved, regardless of the weighted score.
  const missingMandatory = requirements.some(
    (requirement, i) => requirement.mandatory && criteria[i].status === "NOT_FOUND"
  );
  const unclearMandatory = requirements.some(
    (requirement, i) => requirement.mandatory && criteria[i].status === "UNCLEAR"
  );

  let status: ScoringResult["status"];
  let reason: string | undefined;

  if (overallScore < 55) {
    status = "NOT_QUALIFIED";
  } else if (missingMandatory) {
    status = overallScore >= 55 ? "NEEDS_REVIEW" : "NOT_QUALIFIED";
    reason = "Candidate does not meet a stated mandatory requirement.";
  } else if (overallScore >= 85 && !unclearMandatory) {
    status = "STRONG_MATCH";
  } else if (overallScore >= 70) {
    status = "QUALIFIED";
  } else {
    status = "NEEDS_REVIEW";
  }

  // Recruiter-configured threshold can additionally gate the Qualified boundary.
  if (status === "QUALIFIED" && overallScore < qualificationThreshold) {
    status = "NEEDS_REVIEW";
  }

  return { overallScore, status, reason, criteria };
}
