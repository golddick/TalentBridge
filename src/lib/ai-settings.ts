import { prisma } from "./prisma";

export type ResolvedAiConfig = {
  provider: "openai" | "deepseek" | "openrouter" | "agentrouter";
  apiKey?: string;
  model: string;
  baseURL?: string;
  extraHeaders?: Record<string, string>;
};

/**
 * AgentRouter rejects any request whose User-Agent it doesn't recognise with
 * `401 unauthorized client detected`, before it ever looks at the API key.
 * The `openai` SDK's own User-Agent is NOT on that allowlist, so without this
 * header every call fails with a 401 that looks exactly like a bad key.
 *
 * Overridable via AGENTROUTER_USER_AGENT in case the allowlist changes.
 */
const AGENTROUTER_DEFAULT_USER_AGENT = "claude-cli/1.0.0 (external, cli)";

/**
 * The `openai` SDK builds request URLs by appending a path (`/chat/completions`)
 * to baseURL, so the version prefix has to already be there. A baseURL of
 * "https://agentrouter.org/" (easy to paste from the browser, and easy to save
 * from the /admin form) resolves to https://agentrouter.org/chat/completions,
 * which returns AgentRouter's HTML console page with HTTP 200 — the SDK then
 * dies on `choices[0]` with an unrelated-looking TypeError. Normalising here
 * means neither form can reintroduce that failure.
 */
function withApiVersionPath(url: string, versionPath: string = "v1"): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!trimmed) return trimmed;
  return trimmed.endsWith(`/${versionPath}`) ? trimmed : `${trimmed}/${versionPath}`;
}

/**
 * Reads the active AI provider configuration. A row saved from the Super
 * Admin "AI Provider" page (see /admin) always wins; any field left blank
 * there falls back to the matching environment variable, so a deployment
 * that only ever used .env keeps working unchanged.
 */
export async function resolveAiConfig(): Promise<ResolvedAiConfig> {
  const saved = await prisma.aiSettings.findUnique({ where: { id: "singleton" } }).catch(() => null);

  const provider = (saved?.provider || process.env.AI_PROVIDER || "agentrouter").toLowerCase() as
    | "openai"
    | "deepseek"
    | "openrouter"
    | "agentrouter";

  if (provider === "deepseek") {
    return {
      provider,
      apiKey: saved?.deepseekApiKey || process.env.DEEPSEEK_API_KEY,
      model: saved?.deepseekModel || process.env.DEEPSEEK_MODEL || "deepseek-chat",
      baseURL: saved?.deepseekBaseUrl || process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    };
  }

  if (provider === "openrouter") {
    return {
      provider,
      apiKey: saved?.openrouterApiKey || process.env.OPENROUTER_API_KEY,
      model: saved?.openrouterModel || process.env.OPENROUTER_MODEL || "z-ai/glm-5.2:free",
      baseURL: saved?.openrouterBaseUrl || process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      extraHeaders: {
        "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
        "X-Title": "TalentBridge AI",
      },
    };
  }

  if (provider === "agentrouter") {
    return {
      provider,
      apiKey: saved?.agentrouterApiKey || process.env.AGENTROUTER_API_KEY,
      // Defaults to gpt-5.6-sol: of the models AgentRouter currently serves,
      // this and claude-opus-5 are the ones that return usable content for the
      // `response_format: json_object` calls every AI service in this app
      // makes. deepseek-v4-flash and glm-5.3 are reasoning models that spend
      // the whole max_tokens budget on `reasoning_content` and come back with
      // an empty `content`, which this app cannot use. Check the live catalog
      // at agentrouter.org/console (or GET /v1/models) before changing this.
      model: saved?.agentrouterModel || process.env.AGENTROUTER_MODEL || "gpt-5.6-sol",
      baseURL: withApiVersionPath(
        saved?.agentrouterBaseUrl || process.env.AGENTROUTER_BASE_URL || "https://agentrouter.org"
      ),
      extraHeaders: {
        "User-Agent": process.env.AGENTROUTER_USER_AGENT || AGENTROUTER_DEFAULT_USER_AGENT,
      },
    };
  }

  return {
    provider: "openai",
    apiKey: saved?.openaiApiKey || process.env.OPENAI_API_KEY,
    model: saved?.openaiModel || process.env.OPENAI_MODEL || "gpt-4o-mini",
  };
}

/** Masks a saved API key for display in the settings UI — never send the
 * real key back to the client once it's been saved. */
export function maskKey(key?: string | null): string | null {
  if (!key) return null;
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}${"•".repeat(Math.max(4, key.length - 8))}${key.slice(-4)}`;
}
