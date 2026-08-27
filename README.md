# TalentBridge AI

AI-powered recruitment qualification and shortlisting platform. Next.js (App
Router) + TypeScript + Prisma/PostgreSQL, with a pluggable OpenAI-compatible
AI provider for job parsing / CV extraction / explanation, a deterministic
rule-based scoring engine, and DropAphi for file storage + email OTP sign-in.

## Stack

- **Framework**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Database**: PostgreSQL via Prisma
- **Auth**: NextAuth (Auth.js) — custom Email OTP provider backed by DropAphi's OTP API, plus optional email/password
- **AI**: any OpenAI-compatible provider — **AgentRouter (default)**, OpenAI, DeepSeek, or OpenRouter — used for job parsing, CV extraction, and explanations, with structured JSON output only. Switchable live from `/admin` (see [AI provider](#ai-provider))
- **Scoring**: a deterministic, non-AI TypeScript scoring engine (`src/lib/scoring.ts`) — the AI never calculates the final score
- **File storage**: DropAphi (`POST /files/upload`, base64 JSON) for CVs and generated documents
- **CV parsing**: `pdf-parse` (PDF) and `mammoth` (DOCX)

## Getting started

```bash
pnpm install
cp .env.example .env       # fill in DATABASE_URL, AGENTROUTER_API_KEY, DROPAPHI_API_KEY, NEXTAUTH_SECRET
pnpm prisma:generate
pnpm prisma:migrate        # creates the schema in your Postgres database
pnpm db:seed                # optional: seeds a demo organization, recruiter, and job
pnpm verify:ai              # optional: confirms the AI provider actually works
pnpm dev
```

Then open http://localhost:3000.

## AI provider

The three AI services (Job Parser, CV Extractor, Explanation) all talk to one
OpenAI-compatible endpoint, resolved fresh on every call by
`src/lib/ai-settings.ts`. Four providers are supported — `agentrouter`
(default), `openai`, `deepseek`, `openrouter` — and switching between them is
just a key/model/base-URL change.

**Configuration precedence:** settings saved from the Super Admin **AI
provider** page at `/admin` are stored in the database and **override every
value in `.env`**. This is the single most common source of confusion here — if
an edit to `.env` appears to have no effect, a stale database row is why. To
force the database row back into agreement with `.env`:

```bash
npx tsx scripts/sync-agentrouter-settings.ts --dry-run   # show what would change
npx tsx scripts/sync-agentrouter-settings.ts             # apply
```

To check the whole chain end to end (config resolution → all three AI services
→ the scoring engine) against fixture data, without writing to the database:

```bash
pnpm verify:ai
```

### AgentRouter specifics

AgentRouter is a gateway that proxies many providers behind one key. Two of its
quirks are handled in code and are worth knowing about:

1. **The base URL must include `/v1`.** The `openai` SDK appends
   `/chat/completions` to whatever base URL it's given, and
   `https://agentrouter.org/chat/completions` returns AgentRouter's *HTML
   console page* with HTTP 200 — which surfaces as a confusing
   `cannot read properties of undefined (reading '0')`. `ai-settings.ts`
   normalises the URL defensively, so a value pasted without `/v1` still works.
2. **AgentRouter allowlists client User-Agents**, rejecting unknown ones with
   `401 unauthorized client detected` *before* it validates the API key — so a
   perfectly good key looks revoked. The `openai` SDK's own User-Agent is not on
   the allowlist, so the app sends an accepted one via `extraHeaders`. Override
   it with `AGENTROUTER_USER_AGENT` if the allowlist ever changes.

**Model choice matters.** Not every model AgentRouter serves can be used here,
because every AI call in this app requires `response_format: json_object`:

| Model | Usable | Notes |
| --- | --- | --- |
| `gpt-5.6-sol` | ✅ | Default |
| `claude-opus-5` | ✅ | Stronger extraction, higher cost |
| `claude-opus-4-8` | ✅ | |
| `glm-5.3` | ❌ | Reasoning-only: spends the whole `max_tokens` budget on `reasoning_content` and returns empty `content` |
| `deepseek-v4-flash` | ❌ | Same as above |

List your account's live catalog with:

```bash
curl -H "Authorization: Bearer $AGENTROUTER_API_KEY" \
     -H "User-Agent: claude-cli/1.0.0 (external, cli)" \
     https://agentrouter.org/v1/models
```

## Environment variables

See `.env.example`. You'll need:

- **`DATABASE_URL`** — a PostgreSQL connection string (Neon, Supabase, or local Postgres all work).
- **`NEXTAUTH_SECRET`** — any long random string (`openssl rand -base64 32`).
- **`AI_PROVIDER`** — `agentrouter` (default), `openai`, `deepseek`, or `openrouter`.
- **`AGENTROUTER_API_KEY`** / `AGENTROUTER_MODEL` / `AGENTROUTER_BASE_URL` — for the default provider. The base URL must end in `/v1`; see [AgentRouter specifics](#agentrouter-specifics).
- **`OPENAI_API_KEY`** / `OPENAI_MODEL` — only when `AI_PROVIDER=openai`. Equivalents exist for DeepSeek and OpenRouter.
- **`DROPAPHI_API_KEY`** / `DROPAPHI_BASE_URL` — used for both file uploads and the OTP sign-in flow.

Remember that anything saved from `/admin` lives in the database and wins over
this file.

## Signing in

TalentBridge supports two sign-in methods, chosen automatically based on the email entered on `/login`:

1. **Email code (default)** — passwordless, delivered by DropAphi:
   - Enter your email → DropAphi emails a 6-digit code (branded "TalentBridge") → enter the code, NextAuth verifies it against DropAphi's `/otp/verify` endpoint and starts a session.
   - This is the only method available until an account sets a password — including every brand-new applicant.
2. **Email + password (optional)** — once a signed-in user sets a password from **`/account`**, that email/password combination becomes available on `/login` going forward. The email code remains available too as a fallback ("Use email code instead" link) — setting a password never disables it.

The seed script (`pnpm db:seed`) sets the demo password `password123` on both seeded accounts (`superadmin@talentbridge.ai`, `recruiter@talentbridge.ai`), so you can test password sign-in immediately.

The first time a brand-new email signs in via OTP, a `User` record is created automatically with the `APPLICANT` role. To try the recruiter flow with your own email instead of the seeded one, sign in once, then flip your own `User.role` to `RECRUITER` (and set an `organizationId`) via `pnpm prisma:studio`.

A real deployment would have an admin/invite flow for provisioning recruiter
and hiring-manager accounts — the Super Admin "Create organization" flow at
`/admin` covers this for the first recruiter of a new org; individual
additional teammates would need a similar invite step, which is intentionally
out of scope for this prototype.

## Core flow

1. **Create a job** (`/jobs/new`) — paste the job description, then either click **"Generate with AI"** to have the Job Parser service turn it into structured, weighted requirements automatically, or add rows manually (same shape as `prisma/seed.ts`). Editable either way before creating the job.
2. **Review/adjust requirements** on the job page — drag weights, see the
   mandatory/preferred badges.
3. **Upload CVs** (multiple at once) — each file is uploaded to DropAphi,
   text-extracted, run through the CV Extractor, scored by the deterministic
   engine, and explained by the Explanation service — synchronously, end to
   end, per file.
4. **Review candidates** — ranked by score, with Confirmed / Unclear / Not
   Found evidence for every requirement, in either List or Card view (`/jobs`
   and `/careers` both support a `?view=list` / `?view=cards` toggle).
5. **Act as a recruiter** — shortlist, request review, or reject; every
   action is written to the audit trail. Recruiters can also view/download
   the original uploaded CV from the application detail page.
6. **Email shortlisted candidates in bulk** — the job page's **Shortlisted**
   tab lists everyone currently shortlisted for that job, with a checkbox
   selection, a **"Generate email"** button that drafts a subject/body
   announcement via AI (editable before sending), and a send action that
   delivers it to each selected candidate via DropAphi's `/email/send`. Every
   send is logged to that application's audit trail.

## Scaling note (hundreds of applications)

The qualification pipeline (`src/lib/pipeline.ts`) currently runs
synchronously inside the upload request, which is fine for a prototype demo
but will not hold up at "hundreds of applications" scale, since it blocks on
AI latency per file. The function is written to be queue-ready (one
`applicationId` in, no shared state) — the intended next step is to enqueue
each file onto a BullMQ + Redis queue instead of awaiting it inline (see the
project document, §17.6).

## Troubleshooting: AI calls failing

Run `pnpm verify:ai` first — it prints the resolved provider/model/base URL
(with the key masked) and then exercises all three AI services, so it separates
"misconfigured" from "provider rejecting us" from "model unusable".

- **`cannot read properties of undefined (reading '0')`** — the base URL isn't
  an OpenAI-compatible endpoint. For AgentRouter this means a missing `/v1`.
- **`401 unauthorized client detected`** — AgentRouter's User-Agent allowlist,
  not your key. See [AgentRouter specifics](#agentrouter-specifics).
- **`Unexpected token '<', "<think>..." is not valid JSON`** — the model
  narrated its reasoning before the JSON. `extractJsonObject` in
  `src/lib/openai.ts` now recovers the object from `<think>` blocks, code
  fences, and surrounding prose, so this should no longer surface; if it does,
  the response was truncated rather than merely wrapped.
- **`Model "X" produced JSON that was cut off`** — the reasoning preamble ate
  the token budget. Raise the relevant `MAX_TOKENS_*` in `src/lib/openai.ts`.
- **`Model "X" returned no usable content`** — X is a reasoning-only model that
  spent its budget on internal reasoning. Pick a model from the usable list.
- **Changes to `.env` having no effect** — a saved `/admin` row is overriding
  them; run `npx tsx scripts/sync-agentrouter-settings.ts`.

## Troubleshooting: OpenAI quota running out quickly

(Only relevant when `AI_PROVIDER=openai`.)

Each processed CV makes 2 OpenAI calls (CV Extractor + Explanation service),
plus 1 more per job creation (Job Parser). By default the app now uses
`gpt-4o-mini` and truncates job descriptions/CV text to a sane max length
before sending them — if you were on an earlier copy of this project using
`gpt-4o` with no truncation, that combination burns through quota much
faster, especially on a low free-tier limit. If quota still runs out fast:

- Check your usage/limits at https://platform.openai.com/usage — a brand-new
  free-tier key often has a very small monthly cap.
- Uploading many CVs in one batch fires that many calls back-to-back
  synchronously (see the scaling note below) — try a smaller batch first.
- You can lower `MAX_CV_CHARS` / `MAX_JD_CHARS` in `src/lib/openai.ts` further
  if your CVs are short and you want to cap cost even more aggressively.

## What's intentionally out of scope for this prototype

- Async/batch processing queue (BullMQ/Redis) — see above.
- CV Builder, blind screening mode, alternative-role matching, interview
  question generation — described in the project document as later-phase
  features; the schema (`CVDocument` / `CVSection` / `CVVersion`) is already
  in place for the CV Builder to be added on top.
- OCR for scanned/image-only PDFs — `extractCvText` throws a clear error for
  these today rather than guessing.
- Malware scanning on uploaded files.

## Design system

- **Colors**: deep teal accent (`#1F6F6F`), navy-ink text (`#16213D`), warm
  off-white canvas (`#F6F5F2`), plus functional status colors for
  Qualified/Needs Review/Not Qualified (green/amber/brick-red) — see
  `tailwind.config.ts` for the full token list.
- **Type**: **Space Grotesk** (headings/brand), **Inter** (body/UI),
  **IBM Plex Mono** (evidence quotes, scores, IDs) — loaded via
  `next/font/google` in `src/app/layout.tsx`.
- **Signature element**: the "evidence card" (`.evidence-card` in
  `globals.css`, `EvidenceCard` component) — a left-border accent block with
  monospaced quoted CV text, used everywhere a conclusion needs to show its
  source.

## Project structure

```
prisma/schema.prisma       Full data model (see project document §18)
scripts/
  verify-ai-provider.ts     End-to-end AI provider check (pnpm verify:ai)
  sync-agentrouter-settings.ts  Re-sync the /admin database row from .env
src/lib/
  scoring.ts                Deterministic rule-based scoring engine
  ai-settings.ts            Resolves the active AI provider (database row over .env)
  openai.ts                 Job Parser / CV Extractor / Explanation (OpenAI-compatible API)
  dropaphi-storage.ts       File upload via DropAphi
  dropaphi-otp.ts           OTP send/verify/resend via DropAphi
  auth.ts                   NextAuth config (Email OTP provider)
  pipeline.ts               Ties extraction -> scoring -> explanation together
  cvText.ts                 PDF/DOCX text extraction
src/app/
  page.tsx                  Public landing page
  login/                    OTP sign-in
  careers/                  Public job board + applicant self-apply
  dashboard/                Job list with funnel counts
  admin/                    Super Admin: create organization, AI provider settings
  account/                  Set an optional password
  jobs/new/, jobs/[id]/     Create job, job detail (requirements, upload, candidates)
  applications/[id]/        Qualification detail, evidence, recruiter actions
  api/                      All REST endpoints described in the project document
```
#   T a l e n t B r i d g e  
 