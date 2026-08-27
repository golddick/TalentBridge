import OpenAI from "openai";
import { resolveAiConfig } from "./ai-settings";
import type {
  ExtractedCandidateProfile,
  Explanation,
  ParsedJobDescription,
  ScoringResult,
} from "./types";

// Server-side only. Never import this file from a client component, and never
// expose API keys to the browser.
//
// The active provider/model/key is resolved fresh on every call via
// resolveAiConfig() (src/lib/ai-settings.ts), which checks the Super Admin
// "AI Provider" settings page (/admin) first and falls back to the matching
// environment variables if nothing's been saved there. This means switching
// providers from the UI takes effect immediately — no server restart, and
// no env var required for a first-time setup.
//
// DeepSeek, OpenRouter and AgentRouter all expose an OpenAI-compatible API
// (same request/response shape, same `openai` SDK), so swapping providers is
// just a different baseURL/key/model — plus, for AgentRouter, the User-Agent
// header that resolveAiConfig supplies through `extraHeaders`.
async function getClient(): Promise<{ client: OpenAI; model: string }> {
  const config = await resolveAiConfig();
  return {
    client: new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      defaultHeaders: config.extraHeaders,
    }),
    model: config.model,
  };
}

// Notes on model defaults (set in resolveAiConfig / .env.example):
// - agentrouter is the default provider and defaults to gpt-5.6-sol. Only some
//   of AgentRouter's catalog is usable here: gpt-5.6-sol and claude-opus-5
//   return clean JSON, while glm-5.3 and deepseek-v4-flash are reasoning-only
//   models that return an empty `content` (see the guard in jsonCompletion).
//   AgentRouter also allowlists client User-Agents — ai-settings.ts sends an
//   accepted one via extraHeaders, without which every call 401s.
// - openai defaults to gpt-4o-mini: extraction/parsing/explanation here are
//   well-structured, low-reasoning tasks that don't need a frontier model,
//   and gpt-4o-mini is roughly 15-20x cheaper per token than gpt-4o.
// - deepseek defaults to deepseek-chat, priced similarly cheaply.
// - openrouter defaults to z-ai/glm-5.2:free — of the free (:free) models on
//   OpenRouter, this is one of the few that actually supports enforced
//   structured JSON output via response_format, which every call in this
//   file depends on. Most other free models either ignore response_format or
//   only loosely follow it. Free models are also rate-limited (roughly
//   20 req/min, 50-1,000 req/day depending on account credit history) — fine
//   for development/demo, but the withRetry() backoff below is what keeps a
//   batch upload from failing outright when that limit is hit.

// Hard caps on input size so one unusually long job description or a badly
// OCR'd/garbled CV can't blow through a request's token budget by itself.
// Job ads and CVs are almost never longer than this in practice.
const MAX_JD_CHARS = 6000;
const MAX_CV_CHARS = 12000;

// Output token budgets per service. These are deliberately generous: a model
// that narrates before answering (see extractJsonObject) spends part of the
// budget on prose, and if the JSON is what gets cut off there's nothing to
// recover. A full candidate profile — a dozen skills each with an evidence
// excerpt, plus roles and education — is the largest output here.
const MAX_TOKENS_CV_EXTRACT = 4000;
const MAX_TOKENS_JOB_PARSE = 3000;
const MAX_TOKENS_EXPLANATION = 2000;
const MAX_TOKENS_EMAIL = 800;

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retries transient failures (rate limits, timeouts, 5xx) with exponential
// backoff instead of failing the whole CV mid-scan the first time OpenAI
// pushes back. Quota/billing errors (401/403, insufficient_quota) are NOT
// retried — retrying those just burns more of a quota that's already gone.
async function withRetry<T>(fn: () => Promise<T>, attempts: number = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const status = err?.status ?? err?.response?.status;
      const code = err?.code ?? err?.error?.code;

      const isQuotaExhausted = code === "insufficient_quota" || status === 401 || status === 403;
      if (isQuotaExhausted) throw err;

      const isRetryable = status === 429 || (status && status >= 500);
      if (!isRetryable || attempt === attempts - 1) throw err;

      // Honor OpenAI's Retry-After header when present, otherwise back off
      // exponentially: 1s, 2s, 4s, 8s.
      const retryAfterHeader = err?.headers?.["retry-after"] ?? err?.response?.headers?.["retry-after"];
      const delayMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 2 ** attempt * 1000;
      console.warn(`OpenAI call failed (attempt ${attempt + 1}/${attempts}), retrying in ${delayMs}ms:`, err?.message);
      await sleep(delayMs);
    }
  }
  throw lastError;
}

/**
 * Recovers a JSON object from a model response that isn't bare JSON.
 *
 * Even with `response_format: { type: "json_object" }` set, models reached
 * through a gateway (AgentRouter, OpenRouter) don't reliably comply. The
 * failure that actually broke CV processing in this app was a response
 * beginning `<think>**Considering the CV**...` — a reasoning model narrating
 * before emitting its JSON. Others wrap the object in a code fence, or add a
 * sentence of commentary either side of it.
 *
 * Strategy: drop known reasoning/fence wrappers, then scan for the first
 * brace-balanced object and parse that. Brace counting is string-aware so a
 * `}` inside a quoted CV excerpt doesn't end the object early.
 *
 * Returns null when nothing parseable is found, so the caller can raise an
 * error that includes the offending text.
 */
export function extractJsonObject(raw: string): unknown | null {
  let text = raw.trim();

  // <think>...</think>, <thinking>...</thinking>, and the unclosed variant a
  // truncated response leaves behind.
  text = text.replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, "");
  text = text.replace(/^<(think|thinking|reasoning)>[\s\S]*?(?=\{)/i, "");

  // ```json ... ``` or ``` ... ```
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1];

  text = text.trim();

  // Fast path once the wrappers are gone.
  try {
    return JSON.parse(text);
  } catch {
    // fall through to brace scanning
  }

  // Scan for the first balanced { ... }, ignoring braces inside string literals.
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null; // unbalanced — response was almost certainly truncated
}

async function jsonCompletion<T>(system: string, user: string, maxTokens: number = 1500): Promise<T> {
  const { client, model } = await getClient();

  const response = await withRetry(() =>
    client.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    })
  );

  // A gateway misconfiguration (e.g. a baseURL missing its /v1 path) can return
  // HTTP 200 with an HTML page, which deserialises into an object with no
  // `choices` at all. Reporting that as a config problem beats the bare
  // "cannot read properties of undefined (reading '0')" it otherwise produces.
  const choice = (response as any)?.choices?.[0];
  if (!choice) {
    throw new Error(
      `AI provider returned a response with no choices for model "${model}". ` +
        `This usually means the configured base URL isn't an OpenAI-compatible ` +
        `API endpoint — check the provider's base URL in /admin or .env.`
    );
  }

  const content = choice.message?.content;
  if (!content) {
    // Reasoning models (e.g. glm-5.3, deepseek-v4-flash on AgentRouter) can
    // consume the entire max_tokens budget emitting `reasoning_content` and
    // return an empty `content`. That's a model-choice problem, not a
    // transient failure, so say so rather than reporting a generic blank reply.
    const spentOnReasoning = !!choice.message?.reasoning_content;
    if (spentOnReasoning || choice.finish_reason === "length") {
      throw new Error(
        `Model "${model}" returned no usable content (finish_reason=${choice.finish_reason}` +
          `${spentOnReasoning ? ", budget spent on internal reasoning" : ""}). ` +
          `This app needs a model that emits JSON directly — either raise max_tokens ` +
          `or switch to a non-reasoning model in /admin.`
      );
    }
    throw new Error(`AI provider returned an empty response for model "${model}"`);
  }

  try {
    return JSON.parse(content) as T;
  } catch {
    // Models routed through a gateway don't reliably honour response_format.
    // Observed failure modes, all of which extractJsonObject() handles:
    //   - a <think>...</think> reasoning block prefixed to the JSON
    //   - the JSON wrapped in a ```json ... ``` fence
    //   - a sentence of prose before or after the object
    const extracted = extractJsonObject(content);
    if (extracted !== null) {
      console.warn(
        `Model "${model}" did not return bare JSON; recovered the object from its response.`
      );
      return extracted as T;
    }

    // Nothing salvageable. A truncated response is the most likely cause when
    // the model spent part of its budget "thinking" out loud, so call that out
    // specifically instead of just dumping the unparseable text.
    if (choice.finish_reason === "length") {
      throw new Error(
        `Model "${model}" produced JSON that was cut off by the ${maxTokens}-token limit ` +
          `(finish_reason=length), likely because it emitted reasoning text before the JSON. ` +
          `Raise max_tokens or switch to a model that answers directly. ` +
          `Response began: ${content.slice(0, 200)}`
      );
    }
    throw new Error(
      `Model "${model}" returned a response with no parseable JSON object. ` +
        `Response began: ${content.slice(0, 200)}`
    );
  }
}

/** Pulls a requirements array out of the parsed response even if the model
 * didn't use the exact top-level key we asked for (weaker/free models are
 * inconsistent about this) — checks the documented key first, then a few
 * common variants, then falls back to "the response itself is the array". */
function extractRequirementsArray(parsed: any): any[] {
  if (Array.isArray(parsed?.requirements)) return parsed.requirements;
  if (Array.isArray(parsed?.Requirements)) return parsed.Requirements;
  if (Array.isArray(parsed?.result?.requirements)) return parsed.result.requirements;
  if (Array.isArray(parsed?.job_requirements)) return parsed.job_requirements;
  if (Array.isArray(parsed?.jobRequirements)) return parsed.jobRequirements;
  if (Array.isArray(parsed)) return parsed;
  return [];
}

/**
 * AI Service — Job Parser
 * Converts an unstructured job description into structured, weighted,
 * classified requirements (project doc §5.2 / §15).
 */
export async function parseJobDescription(description: string): Promise<ParsedJobDescription> {
  const system = `You are the Job Parser service for an AI recruitment platform.
Convert the job description into structured requirements. Return ONLY JSON matching:
{
  "requirements": [
    { "name": string, "type": "MANDATORY" | "PREFERRED" | "INFORMATIONAL", "weight": number, "mandatory": boolean, "description"?: string }
  ]
}
Rules:
- Extract every named skill, technology, framework, tool, or platform mentioned or clearly implied by the role — e.g. a description mentioning "testing applications built with React/Next.js and Node.js/Express.js" implies separate requirements for React, Next.js, Node.js, and Express.js, even though it never uses the word "required."
- Also extract implied responsibilities as requirements where relevant (e.g. "cross-browser testing", "cross-device testing", "QA/testing experience") — these are real, checkable requirements even without an explicit years-of-experience number attached.
- If minimum years of experience, education, or certifications are stated, phrase them as their own requirement (e.g. "5+ years experience").
- Weights across all requirements should sum to approximately 100.
- Mark a requirement "mandatory": true only if the description clearly states or strongly implies it's required for the role, not merely a nice-to-have.
- Every job description that mentions any technology, responsibility, or skill has SOMETHING extractable — only return an empty array if the text truly contains no job-relevant detail at all (e.g. a single sentence with no skills or duties named). A real job posting like the ones this is used for should almost always yield at least 3-6 requirements.`;

  const truncated = truncate(description, MAX_JD_CHARS);
  const first = await jsonCompletion<any>(system, truncated, MAX_TOKENS_JOB_PARSE);
  let requirements = extractRequirementsArray(first);

  if (requirements.length === 0) {
    // One retry with a more forceful nudge — this is what actually fixed the
    // case of a valid, detail-bearing description (mentioning React/Next.js,
    // Node.js/Express.js, and QA responsibilities) coming back with zero
    // requirements: weaker/free models sometimes under-extract on the first
    // pass when a description reads more like prose than a bulleted list.
    console.warn("Job parser returned 0 requirements on first pass, retrying with a stronger prompt.");
    const retrySystem = `${system}\n\nIMPORTANT: Your previous attempt returned an empty requirements array for a description that does mention specific technologies and/or responsibilities. Re-read the text and list every technology, tool, framework, and responsibility it names or clearly implies as a separate requirement row. Do not return an empty array unless the input is truly empty of any job-relevant detail.`;
    const retry = await jsonCompletion<any>(retrySystem, truncated, MAX_TOKENS_JOB_PARSE);
    requirements = extractRequirementsArray(retry);
  }

  return { requirements };
}

/**
 * AI Service — CV Extractor
 * Extracts structured candidate information from raw CV text. Every skill
 * must be evidence-gated: "confirmed" only when the CV text directly
 * supports it, "unclear" when related-but-insufficient text exists, and
 * "not_found" otherwise. The extractor must not invent qualifications
 * (project doc §4.3 / §11).
 */
export async function extractCandidateProfile(
  cvText: string
): Promise<ExtractedCandidateProfile> {
  const system = `You are the CV Extractor service for an AI recruitment platform.
Extract ONLY job-relevant information from the CV text below. Ignore age, gender,
photograph, marital status, nationality, race, religion or any other personal
attribute not relevant to job qualification. Return ONLY JSON matching:
{
  "name"?: string,
  "email"?: string,
  "experience": { "years": number, "relevantYears"?: number, "roles": [{ "title": string, "company": string, "duration"?: string, "responsibilities"?: string }] },
  "skills": [{ "name": string, "status": "confirmed" | "unclear" | "not_found", "confidence": number, "evidence"?: string }],
  "education": [{ "degree": string, "institution"?: string, "field"?: string, "graduationYear"?: number }],
  "certifications": [{ "name": string, "issuer"?: string, "expiry"?: string }],
  "projects"?: [{ "name": string, "technologies"?: string[], "outcome"?: string }]
}
Rules:
- A skill is only "confirmed" when the CV text directly names it or clearly implies it through a specific tool/technology mention.
- If the CV only mentions a broader category (e.g. "cloud experience") without naming the specific requirement (e.g. "AWS"), mark it "unclear" and explain why in "evidence".
- "evidence" must be a short direct excerpt or close paraphrase from the CV, not an invented quote.
- Never fabricate a skill, employer, role or qualification that is not present in the text.`;

  const result = await jsonCompletion<any>(
    system,
    truncate(cvText, MAX_CV_CHARS),
    MAX_TOKENS_CV_EXTRACT
  );

  // Defensive normalization: some models omit fields entirely rather than
  // returning empty arrays for them, which would otherwise crash the
  // scoring engine's array operations (e.g. profile.skills.find(...)).
  return {
    name: result?.name,
    email: result?.email,
    experience: {
      years: result?.experience?.years ?? 0,
      relevantYears: result?.experience?.relevantYears,
      roles: Array.isArray(result?.experience?.roles) ? result.experience.roles : [],
    },
    skills: Array.isArray(result?.skills) ? result.skills : [],
    education: Array.isArray(result?.education) ? result.education : [],
    certifications: Array.isArray(result?.certifications) ? result.certifications : [],
    projects: Array.isArray(result?.projects) ? result.projects : undefined,
  };
}

/**
 * AI Service — Explanation Service
 * Converts the deterministic scoring result into a recruiter-readable
 * strengths/gaps summary (project doc §9 / §15). This step never changes
 * the score — it only explains the score that scoring.ts already produced.
 */
export async function generateExplanation(
  jobTitle: string,
  scoring: ScoringResult
): Promise<Explanation> {
  const system = `You are the Explanation service for an AI recruitment platform.
You are given a deterministic scoring result for one candidate against one job.
Write a short, evidence-grounded explanation. Return ONLY JSON matching:
{ "strengths": string[], "gaps": string[], "recommendation": string }
Rules:
- Base every strength and gap only on the criteria provided — do not introduce new claims.
- Keep each strength/gap to one sentence.
- "recommendation" is one sentence describing whether this candidate is worth recruiter review, not a hiring decision.`;

  const user = JSON.stringify({ jobTitle, scoring });
  return jsonCompletion<Explanation>(system, user, MAX_TOKENS_EXPLANATION);
}

/**
 * AI-assisted draft for the bulk email a recruiter sends to shortlisted
 * candidates. Purely a writing aid — the recruiter can edit the subject and
 * body freely before sending, and nothing here is sent automatically
 * (project doc principle: recruiter decisions and outbound communication
 * stay under human control).
 */
export async function generateShortlistEmail(
  jobTitle: string,
  organizationName: string
): Promise<{ subject: string; body: string }> {
  const system = `You are a recruiting assistant drafting an email for a recruiter to send to
candidates they've just shortlisted for a role. Return ONLY JSON matching:
{ "subject": string, "body": string }
Rules:
- Warm, professional, concise tone — this is good news for the candidate.
- "body" is plain text (use blank lines between paragraphs, no HTML/markdown).
- Mention the job title and company name naturally.
- Say they've been shortlisted and a recruiter will follow up soon with next steps (interview scheduling, etc.) — do not invent specific dates, times, or interviewers.
- Sign off generically (e.g. "The {organizationName} Hiring Team") rather than a specific person's name, since the recruiter can personalize it after generation.
- Do not make any promises about the job offer or salary.`;

  const user = `Job title: ${jobTitle}\nCompany: ${organizationName}`;
  return jsonCompletion<{ subject: string; body: string }>(system, user, MAX_TOKENS_EMAIL);
}
