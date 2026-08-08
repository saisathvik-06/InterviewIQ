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

### 2026-08-08 — Claude Code (Sonnet 5)
**Prompt:** "proceed" — go ahead with M1 (data layer) per `IMPLEMENTATION.md`.

**Result:** Installed `zod`. Copied `curriculum.json`/`candidates.json` into `data/` and
`technical-spec.md` into `docs/` (originals still in Downloads). Wrote `src/lib/curriculum.ts` and
`src/lib/candidate.ts` with zod schemas, static JSON imports, and lookup helpers (`getDay`,
`getModuleForDay`, `getAllCandidates`, `getCandidateById`, `isSkipped`). Deviated from the file list
in `IMPLEMENTATION.md` §M1 by skipping a separate `types.ts` — inferring types directly from the zod
schemas (`z.infer<...>`) in the two lib files avoids maintaining the same shape twice.

Wrote `tests/curriculum.test.ts` and `tests/candidate.test.ts` (14 tests total): 31 contiguous days,
8 contiguous modules covering 1–31 exactly, every mission across all 20 real candidates resolves to
a real curriculum day, skip/attempt classification, and rejection of malformed candidates (missing
member, mission with neither `passed` nor `skipped`, negative attempts).

Also fixed a config gap before the tests could even run: `vitest.config.mts` didn't know about the
`@/*` path alias that `tsconfig.json` defines for Next.js, so `@/lib/...` imports in test files
would have failed to resolve. Added a matching `resolve.alias` entry.

`npm test` → 14/14 pass. `npm run build` → clean. `npm run lint` running.

---

### 2026-08-08 — Claude Code (Sonnet 5)
**Prompt:** "k start with next milestone" — M2 (candidate analysis).

**Result:** Wrote `src/lib/analysis.ts`: `classifyMission` (strong/solid/shaky/failed/skipped per
the attempts thresholds in `IMPLEMENTATION.md` §M2), `classifySeniority` (junior/mid/senior/principal
by years of experience), and `analyseCandidate` producing a `CandidateProfile` with per-topic
signals, `firstTryRate`, and `consistency`, deduping any repeated mission `day` entries (first
record wins).

Hit and fixed a real TypeScript narrowing bug: the initial skip-check
(`"skipped" in mission && mission.skipped`) doesn't narrow the union in the `else` branch, because
negating a `&&` produces an ambiguous `||` that the type checker can't resolve back to a single
excluded branch — `npm run build` caught this at the type-check step (3 errors) before it ever hit a
test. Fixed with an explicit `mission is Extract<Mission, {skipped: true}>` type guard function
instead of the inline compound condition.

Added `tests/analysis.test.ts` (23 new tests, 37 total across the suite): table-driven boundary
tests for the attempts thresholds (3 vs. 4) and seniority tiers, all 20 real candidates classified
with no throws, specific assertions against CAND-018 (first-try-everything → all `strong`), CAND-010
(struggling → correct `failed`/`shaky`/`solid` mix), CAND-011 (5 skipped topics counted correctly),
a zero-`missionsCompleted` guard, and the day-dedupe behaviour.

`npm run build`, `npm test` (37/37), `npm run lint` all clean.

---

### 2026-08-08 — Claude Code (Sonnet 5)
**Prompt:** "alr proceed" — M3 (interview planner), the milestone that structurally guarantees the
≥8 questions / ≥4 curriculum days requirement.

**Result:** Wrote `src/lib/planner.ts`. `buildPlan` selects 5 topics (10 questions) in priority
order per `IMPLEMENTATION.md` §M3 — one `strong` opener, two `solid`/`shaky` middle topics
(preferring distinct modules), one ceiling topic (most advanced passed day), the capstone (day 31)
as closer if passed — then tops up through remaining passed → failed → skipped topics, and as an
absolute last resort pulls untouched curriculum days outright, until 5 topics are reached. Every
topic carries an `intent` string recording *why* it was picked, for later prompt/feedback use.
Selection is entirely sort-order-based (no RNG at all, not even a seeded one) since the plan didn't
actually need randomness to vary between candidates — determinism came for free.

`assertValidPlan` is called at the end of every `buildPlan()`, so an invalid plan can structurally
never leave this module. Since the curriculum always has 31 days to fall back to, this should never
actually fire for real input — it exists as an enforcement point and a thing a judge can point at,
not a plausible runtime error.

`tests/planner.test.ts` (9 new tests, 46 total): the all-20-real-candidates loop (the single
highest-value test in the project so far), three synthetic edge cases (1 passed mission, all
skipped, exactly 4 passed missions), a determinism check, a module-diversity check, and three tests
against `assertValidPlan` directly (too few questions, too few distinct days, valid plan passes).

`npm run build`, `npm test` (46/46), `npm run lint` all clean.

---

### 2026-08-08 — Claude Code (Sonnet 5)
**Prompt:** M4 (session store). Also given a new standing instruction: after every milestone, report
what was implemented and how to verify it, calling out anything better checked manually.

**Result:** Installed `@upstash/redis`. Wrote `src/lib/session.ts`: `Session`/`Turn`/`Feedback`
types, a `SessionStore` interface with `MemoryStore` and `RedisStore` implementations, and a
`FallbackStore` wrapper that catches any primary-store failure and transparently degrades to the
shared in-memory store rather than throwing. `getStore()` picks Redis-backed (wrapped in the
fallback) when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are set, plain memory otherwise —
checked fresh on every call, so the app runs with zero Redis setup. 2-hour TTL on writes. Deviated
from `IMPLEMENTATION.md` §M4's exact `Session` shape by omitting the `notes: TopicNote[]` field —
`TopicNote`'s shape isn't decided until M7 needs it, so designing it now would be exactly the kind
of speculative-future-field the project's own conventions warn against; it's a cheap additive change
later. Added an "Environment variables" section to `README.md`.

Wrote `tests/session.test.ts` (5 tests, 51 total): round-trip save/load, unknown-session returns
`null`, transcript ordering survives repeated saves, and — using a mocked `@upstash/redis` client
that always rejects, so no real network touches the test run — two tests proving the outage-fallback
actually works (`get()` degrades to `null` instead of throwing; `set()` degrades to the memory store
and a later `get()` finds the data there).

Hit one mocking bug: `vi.fn().mockImplementation(() => ({...}))` fails with "is not a constructor"
when the mocked class is invoked via `new Redis(...)`, because arrow functions have no
`[[Construct]]`. Fixed by mocking with a plain `function` instead — a function that returns an
object still works correctly as a constructor call.

`npm run build`, `npm test` (51/51), `npm run lint` all clean.

---

### 2026-08-08 — Claude Code (Sonnet 5)
**Prompt:** M5 — the pivotal milestone: implement `POST /api/interview` per the technical spec,
fully working with zero LLM calls.

**Result:** Wrote `src/lib/interview.ts` (pure state machine: `startInterview`, `nextTurn`, and an
internal `advance` step — every function returns a new session rather than mutating the input, so
the whole module is genuinely pure, not just "pure-ish"), `src/lib/feedback.ts`
(`buildDeterministicFeedback`, built from the plan's already-known topic signals rather than reading
transcript content, since there's no LLM yet to judge answer quality), and
`src/app/api/interview/route.ts` (the actual `POST` handler). Added one small additive field to
`Session` from M4 — `awaitingReprompt?: boolean` — needed so a blank answer gets re-prompted exactly
once before the interview moves on, instead of stalling forever.

Deterministic questions are template-generated from curriculum objectives:
`On day {N} ("{title}"), one of the objectives was to {objective}. Walk me through that.` — this is
also the exact fallback a later milestone will use if an LLM call fails.

Route handling: discriminates start vs. turn by checking whether `candidate` or `message` is present
in the body (rejecting 400 if both or neither are), validates each shape with zod, and returns a
uniform `{reply, done}` / `{reply, done, feedback}` shape matching the spec key-for-key. Restarting
an existing `sessionId` is idempotent (just overwrites). An unknown `sessionId` on a turn returns 404
with a plain-language reply rather than crashing. `GET` on the route isn't handled explicitly —
Next.js's App Router auto-returns 405 for any HTTP method without an exported handler, so no code
was needed for that edge case (verified by inspection of Next's routing docs, not a dedicated
automated test — doing so would require running an actual server rather than a unit-level import).

`tests/interview.test.ts` (16 tests): the full-loop-across-all-20-real-candidates test (the one that
actually proves the ≥8/≥4 spec claim end to end, not just at the planning stage), plus behavioural
tests — first question bundled into the welcome reply, `done` flips exactly once, transcript
alternates agent/candidate, blank-answer re-prompt-then-advance, cached feedback replay after
completion, long-answer truncation.

`tests/route.contract.test.ts` (10 tests): drives the real exported `POST` function with constructed
`Request` objects (no server process, no mocking of Next internals) — start/turn/full-completion
response shapes match the spec exactly including "no extra top-level keys", plus every 400/404 edge
case (both fields present, neither present, non-string message, invalid candidate shape, malformed
JSON, unknown session).

**Manual verification beyond the automated suite:** ran `npm run dev` and hit the live local server
with `curl` for a real start request and a real turn — confirmed actual HTTP responses, not just
in-process function calls. Killed the dev server afterward.

`npm run build` (now shows `/api/interview` as a registered dynamic route), `npm test` (87/87),
`npm run lint` all clean.

---

### 2026-08-08 — Claude Code (Sonnet 5)
**Prompt:** M6 — Groq integration for real, naturally-phrased questions on top of M5's guaranteed
skeleton, with the deterministic fallback staying intact.

**Result:** Installed `openai` (pointed at Groq's OpenAI-compatible endpoint,
`llama-3.3-70b-versatile`). Wrote `src/lib/llm.ts` (`callJSON<T>`: requests JSON mode, strips
markdown fences defensively, validates against a zod schema, retries once telling the model what was
wrong, then throws a typed `LlmError` — every failure mode funnels through one exception type so
callers have exactly one thing to catch) and `src/lib/prompts.ts` (all prompt text, isolated per the
implementation plan's own reasoning: "how well you steered the AI" is easier to judge when the
steering is readable in one file).

Updated `src/lib/interview.ts`: `startInterview`/`nextTurn`/`advance` are now `async` and call Groq
for question phrasing, falling back to the exact M5 deterministic template on *any* failure —
missing key, network error, or a Jaccard-similarity check (≥0.6 word overlap) catching a question
too similar to one already asked, which gets one retry with the prior questions listed before
falling back rather than risking a loop. Updated `src/app/api/interview/route.ts` to `await` the now
asynchronous calls.

`tests/llm.test.ts` (9 new tests): valid JSON, code-fence stripping, invalid-JSON retry-then-recover,
invalid-JSON-twice throws, schema-mismatch retry-then-recover, schema-mismatch-twice throws,
network/429-style failure throws without a second attempt, and the missing-key fast-path never
touches the mocked client at all. `tests/interview.test.ts` gained a test with `GROQ_API_KEY` stubbed
but the `openai` client mocked to always reject — full interview still completes and still meets
≥8/≥4 via fallback. All existing `interview.test.ts` assertions updated to `await` the now-async
functions.

**Manual verification against the real Groq API** (using the credentials already in `.env.local`,
not mocks): ran the dev server and sent a real start request for CAND-010 — got back an actual
Groq-generated question referencing his name, seniority ("extensive experience as an IT Support
Specialist"), and day 1 specifically (correctly the one topic in his profile that isn't failed or
skipped). First request took 3.7s, but that included Next dev-mode compiling the route on first hit;
a warm follow-up turn came back in 0.885s — comfortably under the ~3s target.

`npm run build`, `npm test` (97/97), `npm run lint` all clean.

---

### 2026-08-08 — Claude Code (Sonnet 5)
**Prompt:** A friend will take over from M7 onward, using Claude on the same account but a separate
session/device. Asked for the handoff procedure.

**Result:** Explained that Claude Code sessions aren't shared live across devices even on one
account, but that's fine by design — `CLAUDE.md` → `docs/hackathon-brief.md` already carries full
context for a cold session. Closed one real gap before handoff: `IMPLEMENTATION.md`'s milestone
table had no status tracking, so a new session would've had to cross-reference git log to figure out
what was done. Added a status column (✅/⬜) with a commit link per finished milestone, a "known
deviations from this plan" list (the `types.ts` skip from M1, the deferred `notes` field from M4,
and the Vercel Framework Preset bug — a real infra issue found and fixed outside any milestone, with
no corresponding commit since it was a dashboard setting, not code), and a restated one-paragraph
version of the working process (build → report → wait for approval → commit, never unprompted) so
a different person driving a different AI session follows the same rules without being re-told.

---

### 2026-08-08 — Claude Code (Sonnet 5)
**Prompt:** M7 — adaptive follow-ups, so answers actually steer the interview instead of walking a
fixed script. Continuing from a fresh session picking up the handoff (M0–M6 already done); read
`CLAUDE.md` → `docs/hackathon-brief.md` → `IMPLEMENTATION.md` → `PROMPTS.md` for context first.

**Result:** Added one LLM call per turn (`decideNextAction` in `src/lib/interview.ts`, prompts in
`src/lib/prompts.ts`) that scores the candidate's answer (`correctness`, `depth`,
`usedConcreteExample`, `note`) and proposes `follow_up` / `advance` / `redirect` plus the actual
reply text — a single round-trip rather than assess-then-separately-generate. The model proposes;
the code disposes: hard caps enforced regardless of what it returns — at most 2 follow-ups per
topic, at most 1 redirect per topic, and a forced advance on the interview's final planned question
so a chatty model can never extend past the natural end. `Session` (in `src/lib/session.ts` — no
standalone `types.ts` exists in this repo, M1 already deviated from the plan there, so the new
`TopicNote` type lives alongside the other session types instead) gained `topicQuestionIndex`,
`followUpsInTopic`, `redirectedInTopic`, and `notes: TopicNote[]`. `topicQuestionIndex` is now
tracked explicitly rather than derived from the cumulative question count, since follow-ups and
redirects add extra turns without advancing the plan — deriving it the old way would have
miscounted which planned question a topic was on.

`tests/interview.test.ts` gained 6 tests: follow_up/advance/redirect state transitions against a
stubbed decision, one note recorded per scored answer (not per turn), "I don't know" advancing
immediately with an honest low-score note, and the highest-value one — an adversarial stub that
*always* proposes `follow_up`, run across **all 20 real candidates**, still capped correctly and
still meeting ≥8 questions/≥4 days for every one. `npm test`: 103/103 (up from 97). `npm run build`
and `npm run lint` both clean.

**Manual verification against the real Groq API**, driven end-to-end myself rather than trusting
mocks: started an interview for CAND-010 (1/23 first-try — a real struggler), then deliberately
tested each behavior — a vague one-liner correctly got a follow-up asking for specifics rather than
advancing; three strong, detailed answers in a row on the same topic correctly got capped at the
follow-up limit and forced onto a new topic by the third; a full interview driven to completion took
21 turns (longer than the 10-question baseline, because strong answers kept earning follow-ups up to
the cap on almost every topic — expected, not a bug) and produced valid feedback citing 5 real
curriculum days (1, 7, 31, 12, 16) with non-empty `strengths`/`gaps`/`next`. Ran the server via the
Bash tool directly (`npm run build && npm run start`, backgrounded) rather than asking the user to
paste output back and forth — faster feedback loop, and avoided a local environment quirk on this
machine where `npm run dev`'s Turbopack file watcher hits an OS inotify-instance limit (unrelated to
the app; `next start` sidesteps it since it doesn't watch files).

---

### 2026-08-08 — Claude Code (Sonnet 5)
**Prompt:** M8 — LLM feedback synthesis, so the final payload becomes genuinely useful instead of a
template fill. Build on M7's accumulated per-answer notes.

**Result:** Added `buildFeedback(session)` in `src/lib/feedback.ts` — one LLM call fed the M7 notes
(correctness, depth, concrete-example flag, per-answer note) plus each plan topic's `intent`,
instructed to be honest about weak performance rather than invent praise and to cap each array at
3-5 bullets. New prompts in `src/lib/prompts.ts` (`feedbackSystemPrompt`/`feedbackUserPrompt`/
`feedbackResponseSchema`). The one edge case worth real engineering: a model can cite a day that was
never actually discussed, which would be worse than generic-but-honest fallback feedback — so every
returned string is regex-scanned for "day N" mentions and checked against `session.askedDays`; if
anything doesn't match, the whole result is discarded in favour of `buildDeterministicFeedback`
(M5's fallback, unchanged) rather than risk fabrication reaching the candidate. Same fallback on any
LLM failure or empty-array response. `src/lib/interview.ts` changed by one line: the completion
branch now awaits `buildFeedback` instead of calling the deterministic version directly; caching was
already structurally guaranteed by M5 (`session.feedback` set once at the `done` transition, replayed
on subsequent turns) so no change was needed there.

`tests/feedback.test.ts` (new, 7 tests): spec-shape validation, grounded-day-citation check, fallback
on LLM failure, fallback specifically on an invented-day response, fallback on empty arrays, bullet
capping at 5, and all 20 real candidates producing valid feedback through the mocked LLM path.
`tests/interview.test.ts` gained one test asserting the feedback-generating call fires exactly once
even across two `done`-turns. `npm test`: 111/111 (up from 103). `npm run build` and `npm run lint`
both clean.

**Manual verification against the real Groq API**, driven end-to-end myself: ran CAND-010 (a real
struggler, 1/23 first-try) through a 16-turn interview with a deliberate mix of "I don't know" and
vague non-answers. The resulting feedback correctly cited only real curriculum days actually covered
(1, 7, 31, 12, 16) and was honest about the weak performance — "struggled with providing concrete
examples and specificity in answers across all topics" — rather than inventing strengths. Repeating
the same `done` request afterward returned byte-identical feedback, confirming the cache. Server run
via the Bash tool directly (`npm run build && npm run start`, backgrounded), same as M7, for the same
Turbopack/inotify reason.

**Clarification from Sai Sathvik:** the hackathon rubric's "how well you steered the AI" criterion
refers to how well the *builder* directs their AI coding assistant (i.e. this Claude Code session),
not to the prompt-engineering quality of the interview agent's own LLM calls. Noted for how the
project gets framed/discussed at submission, not a code change.

---

<!-- Add new entries above this line as the build continues. -->
