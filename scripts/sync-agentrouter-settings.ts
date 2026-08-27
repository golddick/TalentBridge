/**
 * One-shot maintenance script: re-sync the AgentRouter fields of the AiSettings
 * singleton row from .env.
 *
 * Why this exists: settings saved from the Super Admin /admin page are stored in
 * the database and take precedence over .env (see lib/ai-settings.ts). That
 * means a stale row can silently pin the app to an old key, model, or base URL
 * no matter what .env says — which is exactly how a working .env can appear to
 * have no effect at all.
 *
 * Run with:  npx tsx scripts/sync-agentrouter-settings.ts
 *            npx tsx scripts/sync-agentrouter-settings.ts --dry-run
 *            VERBOSE=1 npx tsx scripts/sync-agentrouter-settings.ts   (keep prisma debug logs)
 */
import { readFileSync } from "node:fs";

// Prisma's `debug` logging is extremely verbose and buries this script's output
// when DEBUG=prisma:* is set in the shell. Suppress it for this diagnostic
// unless VERBOSE=1. Must happen before @prisma/client is imported, hence the
// dynamic import inside main().
if (!process.env.VERBOSE && process.env.DEBUG) {
  const kept = process.env.DEBUG.split(",")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("prisma"));
  process.env.DEBUG = kept.join(",");
}

/** Minimal .env reader — tsx doesn't load .env, and this avoids a dotenv dep. */
function readEnvFile(path = ".env"): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return out;
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/\s+#.*$/, "") // strip trailing comment
      .replace(/^['"]|['"]$/g, ""); // strip surrounding quotes
    out[key] = value;
  }
  return out;
}

function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const env = readEnvFile();

  const { PrismaClient } = await import("@prisma/client");
  const { maskKey } = await import("../src/lib/ai-settings");

  const desired = {
    provider: "agentrouter",
    agentrouterApiKey: env.AGENTROUTER_API_KEY,
    agentrouterModel: env.AGENTROUTER_MODEL || "gpt-5.6-sol",
    agentrouterBaseUrl: normalizeBaseUrl(env.AGENTROUTER_BASE_URL || "https://agentrouter.org"),
  };

  if (!desired.agentrouterApiKey) {
    throw new Error("AGENTROUTER_API_KEY is not set in .env — nothing to sync.");
  }

  const prisma = new PrismaClient();
  try {
    const before = await prisma.aiSettings.findUnique({ where: { id: "singleton" } });

    console.log("BEFORE (database):");
    console.log(
      before
        ? {
            provider: before.provider,
            agentrouterModel: before.agentrouterModel,
            agentrouterBaseUrl: before.agentrouterBaseUrl,
            agentrouterApiKey: maskKey(before.agentrouterApiKey),
          }
        : "(no row — .env was already authoritative)"
    );

    console.log("\nAFTER (from .env):");
    console.log({ ...desired, agentrouterApiKey: maskKey(desired.agentrouterApiKey) });

    const keyChanged = before?.agentrouterApiKey !== desired.agentrouterApiKey;
    if (before && keyChanged) {
      console.log(
        "\n! The stored key differed from .env — the database copy was the one in use."
      );
    }

    if (dryRun) {
      console.log("\n--dry-run: no changes written.");
      return;
    }

    await prisma.aiSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...desired },
      update: desired,
    });

    console.log("\nAiSettings singleton synced from .env.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
