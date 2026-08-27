// Structured shapes returned by the OpenAI-backed services (Job Parser,
// CV Extractor, Explanation Service). These are validated before being
// persisted — see lib/openai.ts.

export type ParsedRequirement = {
  name: string;
  type: "MANDATORY" | "PREFERRED" | "INFORMATIONAL";
  weight: number;
  mandatory: boolean;
  description?: string;
};

export type ParsedJobDescription = {
  requirements: ParsedRequirement[];
};

export type ExtractedSkill = {
  name: string;
  status: "confirmed" | "unclear" | "not_found";
  confidence: number; // 0-1
  evidence?: string;
};

export type ExtractedCandidateProfile = {
  name?: string;
  email?: string;
  experience: {
    years: number;
    relevantYears?: number;
    roles: {
      title: string;
      company: string;
      duration?: string;
      responsibilities?: string;
    }[];
  };
  skills: ExtractedSkill[];
  education: {
    degree: string;
    institution?: string;
    field?: string;
    graduationYear?: number;
  }[];
  certifications: {
    name: string;
    issuer?: string;
    expiry?: string;
  }[];
  projects?: {
    name: string;
    technologies?: string[];
    outcome?: string;
  }[];
};

export type CriterionResult = {
  requirementId: string;
  requirementName: string;
  status: "CONFIRMED" | "UNCLEAR" | "NOT_FOUND";
  score: number; // 0-100 for this criterion
  evidence?: string;
  confidence: number;
};

export type ScoringResult = {
  overallScore: number; // 0-100
  status: "STRONG_MATCH" | "QUALIFIED" | "NEEDS_REVIEW" | "NOT_QUALIFIED";
  reason?: string;
  criteria: CriterionResult[];
};

export type Explanation = {
  strengths: string[];
  gaps: string[];
  recommendation: string;
};
