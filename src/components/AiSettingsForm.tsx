"use client";

import { useEffect, useState } from "react";

type Settings = {
  provider: "openai" | "deepseek" | "openrouter" | "agentrouter";
  openaiModel: string;
  openaiKeyMasked: string | null;
  deepseekModel: string;
  deepseekBaseUrl: string;
  deepseekKeyMasked: string | null;
  openrouterModel: string;
  openrouterBaseUrl: string;
  openrouterKeyMasked: string | null;
  agentrouterModel: string;
  agentrouterBaseUrl: string;
  agentrouterKeyMasked: string | null;
};

const PROVIDERS: { id: Settings["provider"]; label: string; blurb: string }[] = [
  { id: "openai", label: "OpenAI", blurb: "ChatGPT API — gpt-4o-mini by default." },
  { id: "deepseek", label: "DeepSeek", blurb: "OpenAI-compatible, cheap per-token pricing." },
  {
    id: "openrouter",
    label: "OpenRouter",
    blurb: "Free-tier models available, e.g. z-ai/glm-5.2:free — no card required.",
  },
  {
    id: "agentrouter",
    label: "AgentRouter",
    blurb: "$200 free credit, 30+ providers via one key — less rate-limited than free OpenRouter models.",
  },
];

export function AiSettingsForm() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [provider, setProvider] = useState<Settings["provider"]>("openai");
  const [keys, setKeys] = useState({ openai: "", deepseek: "", openrouter: "", agentrouter: "" });
  const [models, setModels] = useState({ openai: "", deepseek: "", openrouter: "", agentrouter: "" });
  const [urls, setUrls] = useState({ deepseek: "", openrouter: "", agentrouter: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/ai-settings")
      .then((res) => res.json())
      .then((data) => {
        const s: Settings = data.settings;
        setSettings(s);
        setProvider(s.provider);
        setModels({
          openai: s.openaiModel,
          deepseek: s.deepseekModel,
          openrouter: s.openrouterModel,
          agentrouter: s.agentrouterModel,
        });
        setUrls({ deepseek: s.deepseekBaseUrl, openrouter: s.openrouterBaseUrl, agentrouter: s.agentrouterBaseUrl });
        setLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/admin/ai-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        openaiApiKey: keys.openai || undefined,
        openaiModel: models.openai || undefined,
        deepseekApiKey: keys.deepseek || undefined,
        deepseekModel: models.deepseek || undefined,
        deepseekBaseUrl: urls.deepseek || undefined,
        openrouterApiKey: keys.openrouter || undefined,
        openrouterModel: models.openrouter || undefined,
        openrouterBaseUrl: urls.openrouter || undefined,
        agentrouterApiKey: keys.agentrouter || undefined,
        agentrouterModel: models.agentrouter || undefined,
        agentrouterBaseUrl: urls.agentrouter || undefined,
      }),
    });

    setSaving(false);
    setKeys({ openai: "", deepseek: "", openrouter: "", agentrouter: "" }); // clear typed keys after save

    if (!res.ok) {
      setMessage({ type: "error", text: "Something went wrong saving these settings." });
      return;
    }
    setMessage({ type: "success", text: `Active provider is now ${PROVIDERS.find((p) => p.id === provider)?.label}. This takes effect immediately — no restart needed.` });
  }

  if (loading || !settings) {
    return <div className="card p-6 text-sm text-muted">Loading AI provider settings…</div>;
  }

  return (
    <form onSubmit={handleSave} className="card space-y-5 p-6">
      <div>
        <h3 className="font-display font-semibold">AI provider</h3>
        <p className="text-sm text-muted">
          Choose which provider powers job parsing, CV extraction, and explanations. Switching
          here applies immediately across the whole platform.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PROVIDERS.map((p) => (
          <label
            key={p.id}
            className={`cursor-pointer rounded-md border p-3 text-sm transition-colors ${
              provider === p.id ? "border-accent bg-accent-soft" : "border-border hover:bg-canvas"
            }`}
          >
            <input
              type="radio"
              name="provider"
              value={p.id}
              checked={provider === p.id}
              onChange={() => setProvider(p.id)}
              className="sr-only"
            />
            <div className="font-medium text-ink">{p.label}</div>
            <div className="mt-0.5 text-xs text-muted">{p.blurb}</div>
          </label>
        ))}
      </div>

      {provider === "openai" && (
        <ProviderFields
          keyLabel="OpenAI API key"
          keyPlaceholder={settings.openaiKeyMasked ? `Saved: ${settings.openaiKeyMasked}` : "sk-..."}
          keyValue={keys.openai}
          onKeyChange={(v) => setKeys({ ...keys, openai: v })}
          modelValue={models.openai}
          onModelChange={(v) => setModels({ ...models, openai: v })}
        />
      )}

      {provider === "deepseek" && (
        <ProviderFields
          keyLabel="DeepSeek API key"
          keyPlaceholder={settings.deepseekKeyMasked ? `Saved: ${settings.deepseekKeyMasked}` : "sk-..."}
          keyValue={keys.deepseek}
          onKeyChange={(v) => setKeys({ ...keys, deepseek: v })}
          modelValue={models.deepseek}
          onModelChange={(v) => setModels({ ...models, deepseek: v })}
          urlValue={urls.deepseek}
          onUrlChange={(v) => setUrls({ ...urls, deepseek: v })}
        />
      )}

      {provider === "openrouter" && (
        <ProviderFields
          keyLabel="OpenRouter API key"
          keyPlaceholder={
            settings.openrouterKeyMasked ? `Saved: ${settings.openrouterKeyMasked}` : "sk-or-..."
          }
          keyValue={keys.openrouter}
          onKeyChange={(v) => setKeys({ ...keys, openrouter: v })}
          modelValue={models.openrouter}
          onModelChange={(v) => setModels({ ...models, openrouter: v })}
          urlValue={urls.openrouter}
          onUrlChange={(v) => setUrls({ ...urls, openrouter: v })}
          modelHint="Free models end in :free, e.g. z-ai/glm-5.2:free — no card required, but rate-limited (~20 req/min)."
        />
      )}

      {provider === "agentrouter" && (
        <ProviderFields
          keyLabel="AgentRouter API key"
          keyPlaceholder={
            settings.agentrouterKeyMasked ? `Saved: ${settings.agentrouterKeyMasked}` : "sk-..."
          }
          keyValue={keys.agentrouter}
          onKeyChange={(v) => setKeys({ ...keys, agentrouter: v })}
          modelValue={models.agentrouter}
          onModelChange={(v) => setModels({ ...models, agentrouter: v })}
          urlValue={urls.agentrouter}
          onUrlChange={(v) => setUrls({ ...urls, agentrouter: v })}
          modelHint='Use the exact model ID from your AgentRouter catalog (agentrouter.org/console).'
        />
      )}

      {message && (
        <p className={`text-sm ${message.type === "success" ? "text-success" : "text-danger"}`}>
          {message.text}
        </p>
      )}

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Saving…" : "Save AI settings"}
      </button>
    </form>
  );
}

function ProviderFields({
  keyLabel,
  keyPlaceholder,
  keyValue,
  onKeyChange,
  modelValue,
  onModelChange,
  urlValue,
  onUrlChange,
  modelHint,
}: {
  keyLabel: string;
  keyPlaceholder: string;
  keyValue: string;
  onKeyChange: (v: string) => void;
  modelValue: string;
  onModelChange: (v: string) => void;
  urlValue?: string;
  onUrlChange?: (v: string) => void;
  modelHint?: string;
}) {
  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-ink">{keyLabel}</label>
        <input
          type="password"
          className="input"
          placeholder={keyPlaceholder}
          value={keyValue}
          onChange={(e) => onKeyChange(e.target.value)}
        />
        <p className="mt-1 text-xs text-muted">Leave blank to keep the currently saved key.</p>
      </div>
      <div className={onUrlChange ? "grid grid-cols-2 gap-3" : ""}>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Model</label>
          <input
            className="input"
            value={modelValue}
            onChange={(e) => onModelChange(e.target.value)}
          />
          {modelHint && <p className="mt-1 text-xs text-muted">{modelHint}</p>}
        </div>
        {onUrlChange && (
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Base URL</label>
            <input className="input" value={urlValue} onChange={(e) => onUrlChange(e.target.value)} />
          </div>
        )}
      </div>
    </div>
  );
}
