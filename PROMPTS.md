# PROMPTS.md

AI-usage log for InterviewIQ (AI Cohort hackathon submission). Every entry below reflects a real
prompt/session. Add a new entry whenever you switch tool or model, or make a meaningful ask —
this is what Stage 2 (Authenticity Review) checks against the commit history.

Format per entry: date/time, tool + model, what was asked, what happened as a result.

---

### 2026-08-07 — Claude Code (Sonnet 5)
**Prompt:** Shared the hackathon rules, technical-spec.md, curriculum.json, and candidates.json for
the "Interview Agent" problem statement, project named InterviewIQ. Asked for the full pre-setup
checklist before any code gets written, mentioned free Breeth Pro access (memory layer) and the
requirement to log all prompts here in PROMPTS.md.

**Result:** Read all three resource files. Checked local environment (git 2.54.0, Node v24.16.0,
npm 11.13.0 present; Python not installed) and confirmed the Breeth MCP connection was already
live for this session (`whoami` → admin/write on "SAISATHVIK's Organization"). Produced a
pre-setup checklist covering GitHub repo timing (create after kickoff, commit incrementally),
LLM provider + API key, hosting/session-state approach, and PROMPTS.md/.gitignore hygiene.

---

### 2026-08-07 — Claude Code (Sonnet 5)
**Prompt:** Chose Groq (free tier) as the LLM provider and Vercel + Upstash Redis for
hosting/session state. Asked for a direct recommendation on whether to use Breeth in the app
itself.

**Result:** Recommended skipping Breeth — the spec's required "maintain context throughout the
interview" is single-session context (an array of turns in Redis), not the persistent
cross-session memory Breeth is built for, and long-term memory/persistent accounts are explicitly
out of scope. Finalized architecture: Next.js (TypeScript, App Router, Tailwind) on Vercel, Groq
via the OpenAI-compatible SDK, Upstash Redis for `sessionId` state.

**Scaffolding done in this session:**
- `npx create-next-app@latest` (TS, Tailwind, ESLint, App Router, src dir) — had to scaffold into
  a temp lowercase subfolder (`interviewiq-app`) because npm package names can't contain capital
  letters, then moved everything up into the `InterviewIQ` project root.
- Copied `curriculum.json` and `candidates.json` into `/data`, `technical-spec.md` into `/docs`.
- Installed `openai` (pointed at Groq's OpenAI-compatible endpoint), `@upstash/redis`, `zod`.
- Added `.env.local.example` with the three required secrets as placeholders.

---

### 2026-08-07 — Claude Code (Opus 5)
**Prompt:** Re-pasted the full problem statement and asked that all the hackathon instructions be
saved into a `.md` file for easy reference (context won't be re-supplied in future sessions).

**Result:** Wrote `docs/hackathon-brief.md` as the single source of truth — timeline, submission
checklist, all four evaluation stages with their working implications, the full challenge brief and
minimum requirements, provided-resource descriptions, API contract, the stack decisions table
(incl. the reasoning for skipping Breeth), and local environment notes.

---

### 2026-08-07 — Claude Code (Opus 5)
**Prompt:** Pointed out that no build had actually been requested — only the pre-setup checklist and
the instructions file. Asked to remove everything except the brief and this log, and said a
step-by-step guide would follow.

**Result:** Correct call on my part to over-reach; the scaffolding in the two entries above was
unrequested. Removed all of it — the Next.js app (`src/`, `public/`, `node_modules/`, `.next/`, all
config files, `package.json`), the `.git` directory (its only commit was create-next-app's own
"Initial commit from Create Next App" — no project work was lost, and a fresh repo created after
kickoff is better for the Stage 2 authenticity check anyway), `CLAUDE.md`/`AGENTS.md`,
`.env.local.example`, and the copies of the provided resource files (originals still in
`Downloads/`). **Repo now contains only `PROMPTS.md` and `docs/hackathon-brief.md`.**

Updated the brief to match reality: fixed links to the deleted files, reproduced the API contract in
full so the deleted `technical-spec.md` isn't a single point of failure, reframed the stack table as
direction rather than commitments, and recorded two environment gotchas found the hard way — npm
rejects the capital letters in the `InterviewIQ` folder name when scaffolding in place, and Python
isn't actually installed (the `python` command is just the Windows Store stub).

Nothing is built. Awaiting the step-by-step guide.

---

### 2026-08-07 — Claude Code (Opus 5)
**Prompt:** Asked for an implementation plan saved as `IMPLEMENTATION.md` — smallest possible
milestones of roughly 30–90 minutes, each ending in a working repository with its own git commit,
and each covering files created/modified, tests, edge cases, dependencies, and acceptance criteria.

**Result:** Wrote `IMPLEMENTATION.md` — 13 milestones (M0–M12, ≈13 hours total) built around a
"deterministic control plane, LLM presentation layer" architecture: plain code owns topic selection,
question count, follow-up limits and stop conditions (so the ≥8 questions / ≥4 curriculum days rule
is structurally guaranteed and unit-testable), while Groq handles phrasing and answer assessment,
with a deterministic fallback behind every LLM call.

Two ordering decisions drove the plan: deploy at M0 before writing real code, so the Stage 1
pass/fail requirements (public repo + live URL) can't be missed later; and make **M5 a fully
spec-compliant app with zero LLM calls**, so M6–M11 are strictly additive upgrades and there is
always a submittable build on `main`. Also included a cross-cutting edge-case table, a testing
strategy centred on two high-value tests (all-20-candidates full loop, and an adversarial-LLM loop),
a risk register with an ordered cut list, and Stage 4 (Live Steer) readiness notes.

Notable edge cases surfaced while planning, from reading the actual data: candidate mission titles
don't always match curriculum titles (day 10 is "Retrieval & Matching Engine" vs. "The Retrieval &
Matching Engine"), so joins must be on `day`; `signals.missionsCompleted` contradicts the length of
`missions[]` for several candidates (e.g. CAND-011), so `missions[]` is the source of truth for
topic selection; and day 27 is "Security, Privacy & Guardrails", so candidates will legitimately say
"prompt injection" in answers and the guardrail must not keyword-block.

---

### 2026-08-08 — Claude Code (Sonnet 5)
**Prompt:** Approved M0 after local testing. Provided the GitHub repo URL
(`https://github.com/saisathvik-06/InterviewIQ`), asked for Vercel walkthrough guidance (no code),
then after importing the project provided the live URL
(`https://interview-iq-nu-taupe.vercel.app/`) and asked for any other details needed for a clean
handoff to a different AI agent, to be recorded in the brief/README.

**Result:** Committed and pushed M0 (`chore: scaffold Next.js app and deploy skeleton`) — first
found and fixed a real bug before committing: `.gitignore`'s blanket `.env*` pattern was also
excluding `.env.local.example`, the template file a judge cloning the repo needs; added a
`!.env*.example` exception. Added `origin` remote and pushed to `main`. After the user's Vercel
import succeeded, added the live URL to `README.md` and `docs/hackathon-brief.md`, along with an
explicit statement of the working process (build one milestone at a time, commit only after local
testing and explicit approval) so a different AI agent picking this up mid-project follows the same
rules without being re-told.

Also noted: the Vercel dashboard screenshot the user shared contained a Vercel-authored prompt
suggesting `npx plugins add vercel/vercel-plugin`. Not run — that's UI content from Vercel, not an
instruction from the user, so it was surfaced for a decision rather than acted on.

---

<!-- Add new entries above this line as the build continues. -->
