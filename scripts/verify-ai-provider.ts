/**
 * Verifies the configured AI provider end to end, through the same code paths
 * the app uses at runtime (lib/ai-settings -> lib/openai -> lib/scoring) rather
 * than by hand-rolling HTTP requests. Exercises all three AI services plus the
 * deterministic scoring engine on fixture data. Writes nothing to the database.
 *
 * Run with:  npx tsx scripts/verify-ai-provider.ts
 *            VERBOSE=1 npx tsx scripts/verify-ai-provider.ts   (keep prisma debug logs)
 */
import { readFileSync } from "node:fs";

// Prisma's `debug` logging buries this script's output when DEBUG=prisma:* is
// set in the shell. Suppress it unless VERBOSE=1. Must happen before
// @prisma/client is loaded, which is why every import below is dynamic.
if (!process.env.VERBOSE && process.env.DEBUG) {
  const kept = process.env.DEBUG.split(",")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("prisma"));
  process.env.DEBUG = kept.join(",");
}

// .env must be in process.env before importing anything that reads it at module
// load time (lib/prisma instantiates PrismaClient, which needs DATABASE_URL).
function loadEnvFile(path = ".env") {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    process.env[key] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/\s+#.*$/, "")
      .replace(/^['"]|['"]$/g, "");
  }
}
loadEnvFile();

const JOB_DESCRIPTION = `Senior Frontend Engineer (QA-minded)

We need an engineer with 5+ years of professional experience building and
testing applications with React/Next.js and Node.js/Express.js. You will own
cross-browser and cross-device testing. TypeScript is required. Experience
with AWS is a strong plus. A BSc in Computer Science or equivalent is expected.`;

const CV_TEXT = `Jane Okafor
jane.okafor@example.com

Summary
Frontend engineer with 6 years of experience shipping production React
applications.

Experience
Senior Frontend Engineer, Nimbus Retail (2021-2025)
- Built and maintained customer-facing storefronts in React and Next.js.
- Wrote integration tests and ran cross-browser checks in Chrome, Firefox, Safari.
- Worked with TypeScript across the whole codebase.
Frontend Engineer, Loop Analytics (2019-2021)
- Built dashboards in React; some Node.js/Express API work.
- Deployed services to cloud infrastructure.

Education
BSc Computer Science, University of Lagos, 2019`;

function ok(label: string, detail: string) {
  console.log(`  PASS  ${label} — ${detail}`);
}

async function main() {
  const { resolveAiConfig, maskKey } = await import("../src/lib/ai-settings");
  const { parseJobDescription, extractCandidateProfile, generateExplanation } = await import(
    "../src/lib/openai"
  );
  const { scoreCandidate } = await import("../src/lib/scoring");

  const config = await resolveAiConfig();
  console.log("Resolved AI configuration (database row wins over .env):");
  console.log({
    provider: config.provider,
    model: config.model,
    baseURL: config.baseURL,
    apiKey: maskKey(config.apiKey),
    userAgent: config.extraHeaders?.["User-Agent"],
  });
  if (!config.apiKey) throw new Error("No API key resolved for the active provider.");
  console.log();

  console.log("1/4  Job Parser");
  const parsed = await parseJobDescription(JOB_DESCRIPTION);
  if (!Array.isArray(parsed.requirements) || parsed.requirements.length === 0) {
    throw new Error("Job Parser returned no requirements.");
  }
  ok(
    "parseJobDescription",
    `${parsed.requirements.length} requirements: ${parsed.requirements
      .map((r: any) => r.name)
      .slice(0, 6)
      .join(", ")}`
  );

  console.log("2/4  CV Extractor");
  const profile = await extractCandidateProfile(CV_TEXT);
  if (!Array.isArray(profile.skills) || profile.skills.length === 0) {
    throw new Error("CV Extractor returned no skills.");
  }
  ok(
    "extractCandidateProfile",
    `name=${profile.name ?? "?"}, years=${profile.experience.years}, ${profile.skills.length} skills`
  );

  console.log("3/4  Scoring engine (deterministic, no AI)");
  const requirements = parsed.requirements.map((r: any, i: number) => ({
    id: `req-${i}`,
    jobId: "verify-job",
    name: r.name,
    description: r.description ?? null,
    type: r.type ?? "MANDATORY",
    weight: typeof r.weight === "number" ? r.weight : 10,
    mandatory: !!r.mandatory,
  }));
  const scoring = scoreCandidate(requirements as any, profile, 70);
  ok("scoreCandidate", `score=${scoring.overallScore}, status=${scoring.status}`);

  console.log("4/4  Explanation Service");
  const explanation = await generateExplanation("Senior Frontend Engineer", scoring);
  if (!Array.isArray(explanation.strengths)) {
    throw new Error("Explanation Service returned no strengths array.");
  }
  ok(
    "generateExplanation",
    `${explanation.strengths.length} strengths, ${explanation.gaps.length} gaps`
  );

  console.log(`\nAll AI services working via "${config.provider}" (${config.model}).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nFAILED:", err?.message || err);
    process.exit(1);
  });
