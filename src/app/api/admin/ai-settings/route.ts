import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { maskKey } from "@/lib/ai-settings";

async function requireSuperadmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  return role === "SUPERADMIN";
}

export async function GET() {
  if (!(await requireSuperadmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.aiSettings.findUnique({ where: { id: "singleton" } });

  // Never send real keys back to the client — only masked previews so the
  // form can show "a key is already saved" without exposing it.
  // Defaults here must stay in sync with resolveAiConfig() in lib/ai-settings.ts,
  // otherwise the form shows a value the server wouldn't actually use.
  return NextResponse.json({
    settings: {
      provider: settings?.provider || process.env.AI_PROVIDER || "agentrouter",
      openaiModel: settings?.openaiModel || process.env.OPENAI_MODEL || "gpt-4o-mini",
      openaiKeyMasked: maskKey(settings?.openaiApiKey) || (process.env.OPENAI_API_KEY ? "(from .env)" : null),
      deepseekModel: settings?.deepseekModel || process.env.DEEPSEEK_MODEL || "deepseek-chat",
      deepseekBaseUrl: settings?.deepseekBaseUrl || process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
      deepseekKeyMasked: maskKey(settings?.deepseekApiKey) || (process.env.DEEPSEEK_API_KEY ? "(from .env)" : null),
      openrouterModel: settings?.openrouterModel || process.env.OPENROUTER_MODEL || "z-ai/glm-5.2:free",
      openrouterBaseUrl:
        settings?.openrouterBaseUrl || process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      openrouterKeyMasked:
        maskKey(settings?.openrouterApiKey) || (process.env.OPENROUTER_API_KEY ? "(from .env)" : null),
      agentrouterModel: settings?.agentrouterModel || process.env.AGENTROUTER_MODEL || "gpt-5.6-sol",
      agentrouterBaseUrl:
        settings?.agentrouterBaseUrl || process.env.AGENTROUTER_BASE_URL || "https://agentrouter.org/v1",
      agentrouterKeyMasked:
        maskKey(settings?.agentrouterApiKey) || (process.env.AGENTROUTER_API_KEY ? "(from .env)" : null),
    },
  });
}

const schema = z.object({
  provider: z.enum(["openai", "deepseek", "openrouter", "agentrouter"]),
  openaiApiKey: z.string().optional(),
  openaiModel: z.string().optional(),
  deepseekApiKey: z.string().optional(),
  deepseekModel: z.string().optional(),
  deepseekBaseUrl: z.string().optional(),
  openrouterApiKey: z.string().optional(),
  openrouterModel: z.string().optional(),
  openrouterBaseUrl: z.string().optional(),
  agentrouterApiKey: z.string().optional(),
  agentrouterModel: z.string().optional(),
  agentrouterBaseUrl: z.string().optional(),
});

/**
 * Saves the platform's AI provider settings. Blank key fields are left
 * untouched (so re-saving the form without retyping a key doesn't wipe it) —
 * only non-empty values overwrite what's stored.
 */
export async function POST(req: Request) {
  if (!(await requireSuperadmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const existing = await prisma.aiSettings.findUnique({ where: { id: "singleton" } });

  const merged = {
    provider: data.provider,
    openaiApiKey: data.openaiApiKey || existing?.openaiApiKey,
    openaiModel: data.openaiModel || existing?.openaiModel,
    deepseekApiKey: data.deepseekApiKey || existing?.deepseekApiKey,
    deepseekModel: data.deepseekModel || existing?.deepseekModel,
    deepseekBaseUrl: data.deepseekBaseUrl || existing?.deepseekBaseUrl,
    openrouterApiKey: data.openrouterApiKey || existing?.openrouterApiKey,
    openrouterModel: data.openrouterModel || existing?.openrouterModel,
    openrouterBaseUrl: data.openrouterBaseUrl || existing?.openrouterBaseUrl,
    agentrouterApiKey: data.agentrouterApiKey || existing?.agentrouterApiKey,
    agentrouterModel: data.agentrouterModel || existing?.agentrouterModel,
    agentrouterBaseUrl: data.agentrouterBaseUrl || existing?.agentrouterBaseUrl,
  };

  await prisma.aiSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...merged },
    update: merged,
  });

  return NextResponse.json({ ok: true });
}
