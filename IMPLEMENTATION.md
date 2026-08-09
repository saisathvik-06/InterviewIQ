# InterviewIQ — Implementation Plan

Companion to [`docs/hackathon-brief.md`](docs/hackathon-brief.md) (rules, API contract, deadline).
This file is the build order. Work top to bottom; each milestone is self-contained.

---

## Guiding architecture

**A deterministic control plane with an LLM presentation layer.**

Plain code owns the *skeleton* of the interview — which curriculum days get covered, how many
questions get asked, when to follow up, when to stop, and what the feedback object looks like. The
LLM owns the *surface* — phrasing questions naturally, reading an answer, and writing prose that
sounds like a person.

Three reasons this shape is worth committing to:

1. **The hard requirements become structurally guaranteed.** "≥8 questions across ≥4 curriculum
   days" is enforced by a planner and a counter, not by hoping the model complies. A judge can read
   `planner.ts` and see the guarantee.
2. **The LLM is never a single point of failure.** Every LLM call has a deterministic fallback. If
   Groq is rate-limited or returns junk mid-demo, the interview degrades to scripted-but-coherent
   instead of collapsing. On a free tier being hit during judging, this matters.
3. **Stage 4 becomes tractable.** A 20-minute live feature add is far easier when behaviour lives in
   small pure functions with obvious names than when it's buried in one giant prompt.

The practical consequence for build order: **Milestone 5 is a complete, spec-passing application
with zero LLM calls.** Everything after it is an upgrade to something that already works. If the
weekend goes sideways, there is always a submittable app on `main`.

### Module map

```
src/lib/
  curriculum.ts   load + index the 31 days; lookup by day
  candidate.ts    zod schema + types for the candidate object
  analysis.ts     candidate profile → per-topic signal (pure)
  planner.ts      profile → ordered interview plan (pure)
  session.ts      SessionStore: Redis in prod, in-memory locally
  interview.ts    the turn state machine (pure given a session)
  llm.ts          Groq client + safe JSON call with retry
  prompts.ts      all prompt text, one place
  feedback.ts     final feedback synthesis + deterministic fallback
```

`analysis`, `planner`, and `interview` are pure and LLM-free, so they're cheap to unit test
exhaustively across all 20 candidates.

---

## Conventions for every milestone

- **Ends green.** `npm run build` and `npm test` both pass before committing. A milestone that
  doesn't build isn't done.
- **Ends committed.** One commit per milestone, conventional-commit style. Push immediately —
  incremental commit history is exactly what Stage 2 looks for.
- **Ends deployable.** `main` is always in a state a judge could open.
- **Ends logged.** Append a `PROMPTS.md` entry covering the AI work done in that milestone, in the
  same commit. Do not batch these up for the end; a log written retroactively in one sitting is the
  pattern Stage 2 flags.

Time estimates assume AI-assisted work and include testing and commit.

---

## Milestone map

**Status key:** ✅ done, pushed, and verified live on the deployed URL · ⬜ not started.
Update this table (and only this table — the sections below stay as the plan, not a diary) at the
end of every milestone, right before committing. Detailed narration of what actually happened lives
in `PROMPTS.md`, per-commit.

| # | Milestone | Est. | Ends with | Status |
|---|---|---|---|---|
| 0 | Repo, skeleton, first deploy | 45 min | Live URL serving a placeholder | ✅ [`64bff56`](https://github.com/saisathvik-06/InterviewIQ/commit/64bff56) |
| 1 | Data layer + typed loaders | 45 min | Curriculum and candidates parsed and validated | ✅ [`4ab1414`](https://github.com/saisathvik-06/InterviewIQ/commit/4ab1414) |
| 2 | Candidate analysis | 60 min | Profile → per-topic signals, tested on all 20 | ✅ [`4520f37`](https://github.com/saisathvik-06/InterviewIQ/commit/4520f37) |
| 3 | Interview planner | 75 min | Guaranteed-valid plan for every candidate | ✅ [`7952ed5`](https://github.com/saisathvik-06/InterviewIQ/commit/7952ed5) |
| 4 | Session store | 45 min | State survives across requests, Redis + memory | ✅ [`427412b`](https://github.com/saisathvik-06/InterviewIQ/commit/427412b) |
| 5 | **API route, deterministic** | 90 min | **Full spec compliance, no LLM** | ✅ [`bccce17`](https://github.com/saisathvik-06/InterviewIQ/commit/bccce17) |
| 6 | Groq integration | 60 min | Real questions, fallback intact | ✅ [`b6a2286`](https://github.com/saisathvik-06/InterviewIQ/commit/b6a2286) |
| 7 | Adaptive follow-ups | 75 min | Answers actually steer the interview | ✅ [`eefcb25`](https://github.com/saisathvik-06/InterviewIQ/commit/eefcb25) |
| 8 | LLM feedback synthesis | 60 min | Personalised structured feedback | ✅ [`92fb48e`](https://github.com/saisathvik-06/InterviewIQ/commit/92fb48e) |
| 9 | Guardrails + resilience | 60 min | Survives abuse, rate limits, junk input | ✅ [`d046ba6`](https://github.com/saisathvik-06/InterviewIQ/commit/d046ba6) |
| 10 | Chat frontend | 75 min | Usable UI at `/` | ✅ [`1ff7577`](https://github.com/saisathvik-06/InterviewIQ/commit/1ff7577) |
| 11 | Polish pass | 75 min | Something judges enjoy looking at | ✅ [`5358e46`](https://github.com/saisathvik-06/InterviewIQ/commit/5358e46) |
| 12 | Docs + submission | 45 min | Submitted | ✅ [`PENDING`](https://github.com/saisathvik-06/InterviewIQ/commit/PENDING) |

Total ≈ 13 hours of focused work against a ~48-hour window. The slack is deliberate — see
[Risk register](#risk-register).

**Known deviations from this plan so far**, for anyone picking this up cold — full detail in
`PROMPTS.md`, dated entries:
- M1 skipped a standalone `types.ts`; types are inferred directly from the zod schemas in
  `curriculum.ts`/`candidate.ts` instead.
- M4's `Session` type omitted the `notes: TopicNote[]` field from the original plan — not needed
  until M7, shape wasn't decided yet, added when M7 actually needs it.
- A real infra bug was found and fixed outside any milestone: the Vercel project's Framework Preset
  was set to "Other" instead of "Next.js" (likely stuck from an early import), which made the entire
  live site 404 despite successful builds. Fixed in the Vercel dashboard directly — no code change,
  so no commit for it.

**Working process, agreed with Sai Sathvik** (also in `docs/hackathon-brief.md`): build one
milestone, report what changed and how to verify/test it (calling out anything better checked
manually), wait for local testing + explicit approval, *then* commit and push — never commit
unprompted, never start the next milestone unprompted.

---

## Milestone 0 — Repo, skeleton, first deploy

**Goal:** a public repo and a working live URL, before any real code exists. Front-loading the two
Stage 1 pass/fail requirements means the rest of the weekend can't fail eligibility.

**Dependencies**
- GitHub repo `InterviewIQ`, public, **created after kickoff** (Fri 7 Aug 8:00 PM IST)
- Vercel account linked to that repo
- `npx create-next-app@latest` — TypeScript, Tailwind, App Router, `src/` dir, ESLint

**Files created**
- Whole Next.js scaffold: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`,
  `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- `.gitignore` — verify `.env*` is ignored **before** the first commit; the repo is public
- `.env.local.example` — `GROQ_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `README.md` — one-paragraph stub, fleshed out in M12
- `vitest.config.ts` and a trivial passing test, so `npm test` exists from day one

**Notes**
- Scaffolding into `InterviewIQ/` directly **will fail** — npm rejects capital letters in a package
  name. Scaffold into a lowercase subfolder and move the files up, or pass `--name interviewiq`.
- Set `"name": "interviewiq"` in `package.json` regardless.

**Tests:** `npm test` runs and passes (one placeholder assertion). This exists to prove the harness
works, not to test anything.

**Edge cases**
- `.env.local` committed by accident → check `git status` before the first `git add`; if a key ever
  lands in a public repo, rotate it rather than just deleting the file, since the commit persists.
- Vercel build fails on a warning-as-error → confirm the deploy is green before moving on.

**Acceptance criteria**
- [ ] Repo is public and cloneable; creation timestamp is after kickoff
- [ ] Vercel URL loads without error
- [ ] `npm run build` and `npm test` pass locally
- [ ] `.env.local` is gitignored and absent from `git log`

**Commit:** `chore: scaffold Next.js app and deploy skeleton to Vercel`

---

## Milestone 1 — Data layer + typed loaders

**Goal:** the provided JSON is in the repo, parsed, and type-safe at the boundary.

**Dependencies:** `zod`. Source files from `C:\Users\Sai Sathvik\Downloads\`.

**Files created**
- `data/curriculum.json`, `data/candidates.json` — copied in verbatim, never hand-edited
- `docs/technical-spec.md` — copied in for completeness
- `src/lib/types.ts` — `Day`, `Module`, `Mission`, `Candidate`, `Signals`
- `src/lib/candidate.ts` — zod `candidateSchema`, exported `parseCandidate()`
- `src/lib/curriculum.ts` — loads curriculum, builds a `Map<number, Day>`, exports `getDay(n)`,
  `getModuleForDay(n)`, `allDays()`

**Files modified:** `docs/hackathon-brief.md` — drop the "source files still to be brought in" note.

**Notes**
- Import the JSON statically (`import curriculum from '@/../data/curriculum.json'`) so it's bundled
  at build time. Reading from disk at runtime is a classic serverless failure — the file may not be
  in the lambda bundle.
- Be strict in `candidateSchema` about the mission union: a mission has **either** `passed` +
  `attempts` **or** `skipped: true`. Model it as a union, not all-optional fields, so `analysis.ts`
  can't silently mishandle a shape.

**Tests** — `tests/curriculum.test.ts`, `tests/candidate.test.ts`
- Curriculum has exactly 31 days, numbered 1–31 with no gaps
- Every day has non-empty `title`, `tools`, `objectives`
- Every module's day range is contiguous and the 8 ranges cover 1–31 exactly
- All 20 candidates in `candidates.json` parse against the schema
- Malformed candidates are rejected: missing `member`, mission with neither `passed` nor `skipped`,
  negative `attempts`

**Edge cases**
- Day 6 in the source JSON has irregular indentation — cosmetic, but confirm it parses
- Mission titles don't always match curriculum titles exactly (e.g. mission "Retrieval & Matching
  Engine" vs. curriculum day 10 "The Retrieval & Matching Engine"). **Always join on `day`, never on
  title.** Add a test asserting every mission `day` across all 20 candidates resolves to a real
  curriculum day.
- A mission referencing a day outside 1–31 → loader throws with a clear message

**Acceptance criteria**
- [ ] All 20 candidates parse; invalid fixtures rejected
- [ ] Every mission day resolves against the curriculum
- [ ] No runtime file I/O for the JSON

**Commit:** `feat: add curriculum and candidate data with typed zod loaders`

---

## Milestone 2 — Candidate analysis

**Goal:** turn a raw candidate into an interview-relevant read of what they know. This is the piece
that makes the interview *personalised* rather than generic, so it's worth doing carefully.

**Dependencies:** M1.

**Files created**
- `src/lib/analysis.ts` — `analyseCandidate(candidate): CandidateProfile`

**Design**

Classify each mission into a `TopicSignal`:

| Signal | Rule | Interview intent |
|---|---|---|
| `strong` | `passed`, `attempts === 1` | Probe for depth; push past the textbook answer |
| `solid` | `passed`, `attempts` 2–3 | Standard depth |
| `shaky` | `passed`, `attempts >= 4` | Check the fundamentals actually landed |
| `failed` | `passed === false` | Probe gently; a known weak spot, not a gotcha |
| `skipped` | `skipped === true` | Not assessable as knowledge — see below |

Plus a candidate-level read: `firstTryRate = missionsFirstTry / missionsCompleted`,
`consistency = commitDays / 31`, and `seniority` from `yearsExperience` + `jobRole`.

Seniority should shape *framing*, not difficulty of fact recall — a Distinguished Engineer with 28
years (CAND-008) and an intern with 0 (CAND-007) who both passed day 22 first try get the same
concept probed, but the senior gets asked about tradeoffs and failure modes while the intern gets
asked to explain the mechanism. This is where "resembles a real interview" is won or lost.

**Tests** — `tests/analysis.test.ts`
- Table-driven over the signal rules, including the 3/4 attempts boundary
- Runs across **all 20 real candidates** asserting no throws and every mission classified
- CAND-018 (31/31 first try) → all `strong`; CAND-010 (1 first try, 3 failures) → mostly
  `shaky`/`failed`; CAND-011 (5 skipped) → correct `skipped` count
- `firstTryRate` never exceeds 1 and never divides by zero

**Edge cases**
- `missionsCompleted === 0` → guard the division
- `signals` inconsistent with `missions[]` (the data is synthetic; e.g. CAND-011 lists 14
  `missionsCompleted` but only 10 missions) → **trust `missions[]` for topic selection and treat
  `signals` as a coarse overall read only.** Worth a code comment; it's a real trap.
- A candidate with zero passed missions → analysis must still return a usable profile; the planner
  handles the consequences

**Acceptance criteria**
- [ ] All 20 candidates produce a profile with no throws
- [ ] Boundary attempts values classify correctly
- [ ] Zero-division and empty-missions guarded

**Commit:** `feat: derive per-topic signals and seniority read from candidate profile`

---

## Milestone 3 — Interview planner

**Goal:** the piece that structurally guarantees the "≥8 questions across ≥4 curriculum days" rule.

**Dependencies:** M2.

**Files created**
- `src/lib/planner.ts` — `buildPlan(profile): InterviewPlan`

**Design**

Produce **5 topics × 2 questions = 10 questions**, comfortably clearing the ≥8 floor with room for
an early exit if a candidate stalls badly.

Selection, in priority order:
1. One `strong` topic — open on something they'll do well on. Real interviews build rapport first.
2. Two `solid`/`shaky` topics from **different modules** — the substantive middle.
3. One topic from the candidate's most advanced completed module — tests their ceiling.
4. Day 31 (Capstone) if passed — "walk me through what you built" is the natural closer and the
   single best question for the stated goal of *explaining the systems they built*.

Diversity constraint: prefer topics from distinct modules so the interview doesn't spend all 10
questions inside vector search.

`InterviewPlan` carries, per topic: `day`, `title`, `objectives`, `tools`, `signal`, and an
`intent` string explaining *why this topic was chosen* — which later feeds both the question prompt
and the final feedback, and makes the agent's reasoning inspectable.

**Validation:** export `assertValidPlan(plan)` throwing unless `questions >= 8` and
`distinctDays >= 4`. Call it at plan construction. Make the guarantee impossible to regress.

**Tests** — `tests/planner.test.ts`
- **Loop all 20 candidates; assert `assertValidPlan` passes for every one.** The highest-value test
  in the project.
- Synthetic edge candidates: only 1 passed mission; all skipped; exactly 4 passed missions
- Determinism: same candidate in → identical plan out (no `Math.random()`; seed any shuffle from the
  candidate id, so demos are reproducible)
- Module diversity: ≥3 distinct modules where the candidate's history allows

**Edge cases**
- **Fewer than 4 passed missions** (the constraint-breaking case): fall back in order — failed
  topics, then skipped topics framed as "you skipped this, talk me through what you'd expect", then
  adjacent days from completed modules. Never emit an invalid plan.
- Candidate whose only passed missions are `SETUP` days (1–3) → still valid, questions pitched at
  environment/tooling
- Duplicate day entries in `missions[]` → dedupe by day before planning
- All missions in one module → diversity is a preference, not a hard constraint; don't deadlock

**Acceptance criteria**
- [ ] Valid plan for all 20 candidates and all synthetic edge cases
- [ ] ≥10 questions, ≥5 distinct days in the normal path
- [ ] Deterministic for a given candidate
- [ ] `assertValidPlan` throws on a hand-built invalid plan

**Commit:** `feat: build interview plan guaranteeing >=8 questions across >=4 days`

---

## Milestone 4 — Session store

**Goal:** state that survives between serverless invocations, keyed by `sessionId`.

**Dependencies:** `@upstash/redis`; an Upstash database with REST URL + token.

**Files created**
- `src/lib/session.ts` — `SessionStore` interface, `RedisStore`, `MemoryStore`, `getStore()`

**Files modified:** `.env.local.example`, `README.md` (env var docs)

**Design**

```ts
type Session = {
  sessionId: string
  candidate: Candidate
  plan: InterviewPlan
  topicIndex: number          // which plan topic we're on
  questionsAsked: number      // total, drives the >=8 guarantee
  askedDays: number[]         // drives the >=4 guarantee
  transcript: Turn[]          // { role, content, day? }
  notes: TopicNote[]          // running per-topic assessment, feeds feedback
  phase: 'questioning' | 'done'
  feedback?: Feedback         // cached once generated
  createdAt: number
}
```

`getStore()` returns `RedisStore` when the Upstash env vars are present, otherwise `MemoryStore`.
This makes the app **runnable and testable with no Redis account at all** — worth it for local dev
speed and so a judge cloning the repo can run it with only a Groq key.

Set a **2-hour TTL** on session keys. Interviews are bounded and the free tier is finite.

**Tests** — `tests/session.test.ts`
- Round-trip save/load against `MemoryStore`
- Loading an unknown `sessionId` returns `null`, does not throw
- `getStore()` selects correctly based on env presence
- Transcript ordering preserved across saves

Redis is exercised manually in M12 against the deployed URL, not in unit tests — no live network in
CI.

**Edge cases**
- **Session not found** on a turn request (expired, or a cold Redis) → the most likely real failure.
  Return HTTP 404 with a clear "session expired, please start a new interview" reply rather than a
  500 or a crash.
- Redis unreachable at runtime → catch, log, fall back to `MemoryStore` for that request so the
  interview limps on rather than dying
- Candidate object is large; store it **once at session start**, never re-send per turn
- Two concurrent requests on one session → last-write-wins is acceptable here; note it in a comment
  rather than building locking for a single-user demo

**Acceptance criteria**
- [ ] App runs fully with no Redis env vars set
- [ ] Unknown session returns `null` cleanly
- [ ] TTL set on write
- [ ] No candidate re-transmission per turn

**Commit:** `feat: add session store with Redis backend and in-memory fallback`

---

## Milestone 5 — API route, deterministic

**The pivotal milestone.** At its end the app **fully satisfies the technical spec** — ≥8 questions,
≥4 days, multi-turn context, structured feedback — with **zero LLM calls**. Questions come from
curriculum objectives via templates. It will read a bit mechanical; that's the point. Everything
after this replaces mechanical with natural, on top of something already correct and already
deployed.

**Dependencies:** M1–M4.

**Files created**
- `src/app/api/interview/route.ts` — the `POST` handler
- `src/lib/interview.ts` — `nextTurn(session, message): { session, reply, done, feedback? }`, pure
- `src/lib/feedback.ts` — `buildDeterministicFeedback(session): Feedback`
- `tests/interview.test.ts`, `tests/route.contract.test.ts`

**Request handling**

Discriminate on payload shape: `candidate` present → start; `message` present → turn. Validate with
a zod union and reject anything else with 400.

**Flow**
- **Start:** parse candidate → analyse → plan → create session → reply is a short greeting **plus
  question 1**. Bundling Q1 into the welcome keeps request count and question count aligned, so the
  ≥8 guarantee is simple arithmetic rather than off-by-one bookkeeping.
- **Turn:** append answer to transcript → record a note → advance (follow-up within topic, or next
  topic) → increment counters → return the next question.
- **End:** once `questionsAsked >= 10` and the plan is exhausted, set `phase: 'done'`, generate
  feedback, cache it on the session, return `done: true` with the feedback object.

Deterministic questions come from templates over day objectives, e.g.
`"On day {day} you worked on {title}. Walk me through {objective}."` — sufficient, never gibberish,
and the exact fallback used later when an LLM call fails.

**Tests**
- `interview.test.ts` — drive a full scripted interview for several candidates via `nextTurn` only
  (pure, no HTTP, no network). Assert: ≥8 questions asked, ≥4 distinct days, `done` flips exactly
  once, transcript ordering, feedback shape matches the spec exactly.
- `route.contract.test.ts` — import the `POST` handler and call it with constructed `Request`
  objects. Assert response bodies match the spec **key-for-key**: `{reply, done}` mid-interview;
  `{reply, done, feedback:{summary, strengths, gaps, next}}` at the end; correct types
  (`summary` string, other three `string[]`).
- **Full-loop test across all 20 candidates:** run every candidate end to end with canned answers
  and assert the minimum requirements hold for each. This is the test that proves the spec claim.

**Edge cases**
- Unknown `sessionId` on turn → 404, clear reply, no crash
- Start called twice with the same `sessionId` → reset the session (idempotent restart) rather than
  erroring; simpler for a judge re-running a demo
- **Turn after `done`** → return the cached feedback again with `done: true`; never advance past the
  end or regenerate
- Empty/whitespace-only `message` → treat as a non-answer: don't count it as a scored response,
  re-prompt once, then move on
- Missing both `candidate` and `message`, or both present → 400 with a useful error
- Non-string `message` (number, object, null) → 400 via zod
- Extremely long `message` → truncate to a character budget before storing
- Malformed JSON body → 400, not 500
- `GET` on the route → 405

**Acceptance criteria**
- [ ] Full interview completes over HTTP with no LLM configured
- [ ] All 20 candidates pass the full-loop test
- [ ] Response shapes match the spec key-for-key
- [ ] Every edge case above has a test or an explicit guard
- [ ] Deployed and manually exercised with `curl` against the live URL

**Commit:** `feat: implement /api/interview with deterministic interview engine`

---

## Milestone 6 — Groq integration

**Goal:** real, naturally-phrased questions. Fallback stays intact.

**Dependencies:** `openai` (pointed at Groq's OpenAI-compatible endpoint); `GROQ_API_KEY`.
Model: `llama-3.3-70b-versatile`.

**Files created**
- `src/lib/llm.ts` — client, `callJSON<T>(prompt, schema)` with one retry and zod validation
- `src/lib/prompts.ts` — all prompt text in one file

**Files modified:** `src/lib/interview.ts` (call the LLM, keep templates as fallback), `.env.local.example`

**Design**

`callJSON` requests JSON mode, parses, validates against a zod schema, retries **once** on failure,
then **throws a typed error the caller handles by falling back to the deterministic path**. No LLM
failure should ever surface to the user as an error.

Prompts get: the candidate's role/seniority, the target day's title + objectives + tools, why the
topic was chosen (`intent`), the signal (`strong`/`shaky`/...), and the recent transcript. Keeping
all prompt text in `prompts.ts` matters for Stage 3 — "how well you steered the AI" is easier to
judge when the steering is readable in one file.

**Tests** — `tests/llm.test.ts`
- Mock the client: valid JSON → parsed; malformed JSON → retried; malformed twice → typed throw
- Schema-mismatched-but-valid JSON → rejected
- `interview.test.ts` extended: with a **stubbed failing LLM**, the full interview still completes
  via fallback and still meets ≥8/≥4. This test is the whole safety-net argument, in code.

**Edge cases**
- Missing `GROQ_API_KEY` → deterministic mode, logged once at startup, app still works
- 429 rate limit → exponential backoff, one retry, then fallback
- Timeout → hard cap (~10s) so a hung request can't stall the demo
- Model returns markdown-fenced JSON → strip fences before parsing (common with Llama models)
- Model returns a question nearly identical to a previous one → dedupe against `transcript`; retry
  once with the previous questions listed as exclusions

**Acceptance criteria**
- [ ] Questions are LLM-generated and reference the candidate's actual missions
- [ ] Interview completes with a deliberately broken API key
- [ ] All prompt text lives in `prompts.ts`
- [ ] p95 turn latency under ~3s

**Commit:** `feat: generate interview questions with Groq, deterministic fallback intact`

---

## Milestone 7 — Adaptive follow-ups

**Goal:** the answer actually changes what happens next. This is the difference between "multi-turn
questionnaire" and "interview", and it's the heart of the problem statement.

**Dependencies:** M6.

**Files modified:** `src/lib/interview.ts`, `src/lib/prompts.ts`, `src/lib/types.ts`

**Design**

One LLM call per turn returning a structured decision:

```ts
{
  assessment: { correctness: 1-5, depth: 1-5, usedConcreteExample: boolean, note: string },
  action: 'follow_up' | 'advance' | 'redirect',
  reply: string
}
```

Single round-trip keeps latency down. The `assessment` accumulates into `session.notes` and becomes
the raw material for M8's feedback, so feedback is grounded in per-answer judgements rather than a
re-read of the transcript.

**The code, not the model, owns control flow.** The model *proposes* an action; `interview.ts`
*disposes*, subject to hard limits: at most 2 follow-ups per topic, and always advance if remaining
questions are needed to hit the plan. Otherwise a chatty model could burn all 10 questions on one
topic and break the ≥4-days guarantee.

Behaviour by assessment:
- Strong answer → follow up with a harder probe (tradeoffs, failure modes, "why not X instead")
- Vague answer → follow up asking for a concrete example from their own build
- "I don't know" → acknowledge, advance immediately, note the gap. **Never badger.** A real
  interviewer moves on, and this also protects the question budget.
- Off-topic → one redirect, then advance

**Tests** — `tests/interview.test.ts` extended
- Stubbed LLM returning each action; assert transitions
- **Follow-up cap:** LLM always says `follow_up` → code still advances and still hits ≥4 days. The
  key adversarial test.
- "I don't know" → advances on the same turn, note recorded
- Notes accumulate one entry per scored answer
- Full-loop across all 20 candidates still passes with the adaptive path enabled

**Edge cases**
- Model returns an invalid `action` string → default to `advance` (safe direction: always terminates)
- Model returns `follow_up` on the final planned question → force `advance` to end cleanly
- Candidate answers every question with "I don't know" → interview still completes, feedback
  honestly reflects it rather than inventing strengths
- Very long rambling answer → truncate before sending to the model, keep the full text in transcript
- Transcript outgrows the context window → send only the last N turns plus a running summary; the
  plan and notes carry the long-range context

**Acceptance criteria**
- [ ] Follow-ups demonstrably reference the candidate's own words
- [ ] Follow-up cap holds under an adversarial stub
- [ ] ≥8/≥4 guarantee holds across all 20 candidates with adaptivity on
- [ ] "I don't know" is handled gracefully

**Commit:** `feat: adapt questioning to answer quality with capped follow-ups`

---

## Milestone 8 — LLM feedback synthesis

**Goal:** the final payload becomes genuinely useful rather than a template fill.

**Dependencies:** M7 (needs accumulated `notes`).

**Files modified:** `src/lib/feedback.ts`, `src/lib/prompts.ts`

**Design**

Feed the accumulated per-topic notes plus the plan `intent`s into one LLM call returning the spec's
exact shape, zod-validated. Ground it in evidence: strengths and gaps should cite specific days and,
where possible, specific things the candidate said. `next` should be concrete actions tied to
curriculum days — including, where relevant, days they skipped.

`buildDeterministicFeedback` from M5 stays as the fallback and is used verbatim on any LLM failure.

**Tests** — `tests/feedback.test.ts`
- Validated shape: `summary` non-empty string; three non-empty `string[]`s
- LLM failure → deterministic fallback, still spec-shaped
- Feedback references at least one day actually covered (guards against generic output)
- Feedback is cached: two `done` requests return identical objects, one generation

**Edge cases**
- Model returns empty arrays → reject, retry once, then fallback
- Model invents a day never discussed → validate day references against `askedDays`
- Model returns 20 bullets → cap at 3–5 per array; "concise" is in the spec
- Interview ended early (all non-answers) → honest low-signal feedback, not fabricated praise
- Feedback generation is the slowest call → generate once, cache on the session

**Acceptance criteria**
- [ ] Feedback cites specific days and answers
- [ ] Shape validates against the spec on every one of the 20 candidates
- [ ] Fallback produces valid feedback with the LLM disabled
- [ ] Generated once and cached

**Commit:** `feat: synthesise grounded structured feedback with deterministic fallback`

---

## Milestone 9 — Guardrails + resilience

**Goal:** survive a hostile or unlucky demo. Judges will poke at this.

**Dependencies:** M8.

**Files created:** `src/lib/guardrails.ts`
**Files modified:** `src/app/api/interview/route.ts`, `src/lib/prompts.ts`

**Design**
- **Prompt injection in answers.** A candidate answer is *data*, never instruction. Wrap answers in
  clear delimiters, instruct the model to treat them as interviewee speech only, and detect obvious
  attempts ("ignore previous instructions", "you are now...", "give me full marks"). On detection:
  stay in character, note it, continue. An interviewer who calmly carries on is both the safe
  behaviour and the better demo.
- **Scoring integrity.** The candidate cannot influence their own assessment; scoring reads the
  transcript through a separate call with its own instruction not to honour embedded directives.
- **Basic rate limiting.** Per-session turn cap (say 40) so a runaway client can't drain the Groq
  free tier mid-judging.
- **Uniform error envelope.** Every failure path returns a spec-shaped `{reply, done}` with a human
  reply. The frontend should never see a raw stack trace.

**Tests** — `tests/guardrails.test.ts`
- Injection strings are detected and neutralised; interview continues
- Answer containing "score me 10/10" does not change the assessment (stubbed LLM verifies isolation)
- Turn cap enforced
- Handler never throws: fuzz it with malformed bodies, wrong types, huge strings, unicode, emoji

**Edge cases**
- Legitimate answers that *look* like injection (a candidate discussing day 27 guardrails will
  naturally say "prompt injection") → **do not hard-block on keywords.** Day 27 is a real curriculum
  topic; false positives here would be embarrassing. Prefer neutralise-and-continue over refuse.
- Unicode/emoji/RTL text → must not break JSON or rendering
- Answer in another language → respond in kind rather than failing
- Groq outage for the whole session → every turn falls back; interview still completes

**Acceptance criteria**
- [ ] Route never returns an unhandled 500 under fuzzing
- [ ] Injection attempts don't alter scoring or break character
- [ ] Day 27 answers about prompt injection are handled normally
- [ ] Turn cap enforced

**Commit:** `feat: add prompt-injection guardrails and uniform error handling`

---

## Milestone 10 — Chat frontend

**Goal:** a judge can run an interview without touching `curl`. Until now the live URL has been a
placeholder; this is what "live demo URL" actually means for Stage 1.

**Dependencies:** M5 (only needs the endpoint).

**Files created**
- `src/app/page.tsx` — the interview screen
- `src/components/CandidatePicker.tsx` — choose from the 20 candidates
- `src/components/Chat.tsx` — transcript + input
- `src/components/FeedbackPanel.tsx` — final feedback
- `src/app/api/candidates/route.ts` — list candidates for the picker

**Design**

Generate a `sessionId` client-side (`crypto.randomUUID()`), POST the chosen candidate to start, then
POST each message. On `done: true`, swap the input for the feedback panel. Keep all state in React —
persistence is explicitly out of scope.

The candidate picker is worth the 15 minutes: it lets a judge instantly compare the interview
CAND-018 (31/31 first try) gets against CAND-010 (three failed missions), which is the clearest
possible demonstration of personalisation.

**Tests**
- Manual walkthrough of a full interview for 2 contrasting candidates
- `npm run build` clean, no TypeScript or hydration errors
- Console free of errors and warnings

**Edge cases**
- Double-submit / Enter mashing → disable input while a request is in flight
- Network failure mid-interview → inline error with a retry, don't lose the transcript
- Session expiry (404) → clear message offering a restart
- Refresh mid-interview → state is lost; say so plainly rather than showing a broken screen
- Long replies → transcript scrolls, auto-scrolls to newest
- Slow turn → typing indicator; never a dead-looking UI

**Acceptance criteria**
- [ ] Full interview completable in the browser, start to feedback
- [ ] Candidate picker works for all 20
- [ ] No console errors; build clean
- [ ] Deployed and verified on the live URL

**Commit:** `feat: add chat UI with candidate picker and feedback panel`

---

## Milestone 11 — Polish pass

**Goal:** Stage 3 names **polish** as one of three criteria. This milestone is not optional garnish;
it's a third of the rubric.

**Dependencies:** M10.

**Files modified:** components, `globals.css`, `layout.tsx`
**Files created:** `src/components/ProgressBar.tsx`, `src/components/CandidateBrief.tsx`

**Scope**
- Progress indicator: "Question 4 of 10" plus which curriculum days have been covered — makes the
  ≥8/≥4 compliance *visible to a judge without reading code*, which is worth real points
- A candidate brief panel: role, experience, missions passed/skipped, first-try rate — shows the
  agent's inputs and makes personalisation legible
- Feedback panel with clear visual separation of summary / strengths / gaps / next
- Empty, loading, and error states that look deliberate
- Sensible typography and spacing; dark mode if cheap (Tailwind `dark:` is)
- `<title>`, favicon, meta description
- Responsive enough not to break on a laptop at a different resolution — mobile is out of scope, but
  a judge on a 13" screen isn't

**Tests:** manual pass at 1280px and 1440px; Lighthouse sanity check; full run-through re-verified.

**Edge cases**
- Very long feedback strings → wrap, don't overflow
- Candidate with 0 skipped missions → don't render an empty section
- Progress bar when the plan runs long → cap at 100%

**Acceptance criteria**
- [ ] Progress and day coverage visible during the interview
- [ ] Loading/error/empty states all styled
- [ ] No layout breaks at common laptop widths
- [ ] Live URL reflects all of it

**Commit:** `feat: polish interview UI with progress, candidate brief, and states`

---

## Milestone 12 — Docs + submission

**Goal:** submit, and make the work legible to a judge in five minutes.

**Dependencies:** M11.

**Files modified:** `README.md`, `PROMPTS.md`, `docs/hackathon-brief.md`
**Files created:** `scripts/smoke.mjs` — hits a deployed URL through a full interview and asserts the
contract; a fast pre-submission check and a nice thing for a judge to run

**README contents**
- What it is, live URL, 30-second demo path ("pick CAND-010, then CAND-018, compare")
- Architecture: the deterministic-control-plane idea and *why*
- How the ≥8/≥4 guarantee is enforced, with a pointer to `planner.ts` and its test
- API contract with a working `curl` example
- Local setup, env vars, how to run without Redis
- How to run the tests

**Final checks**
- [ ] `npm run build`, `npm test`, `npm run lint` all clean
- [ ] `scripts/smoke.mjs` passes against the **live** URL
- [ ] Repo public; no secrets in history (`git log -p | grep -i "gsk_\|api.key"`)
- [ ] `PROMPTS.md` complete, chronological, and corresponds to the commits
- [ ] Commit history shows steady activity across the weekend
- [ ] Live URL loads in a fresh incognito window (catches "works because I'm logged into Vercel")
- [ ] Submit repo URL + live URL on the submission page **before Sun 9 Aug 8:00 PM IST**

**Commit:** `docs: add README, smoke test script, and finalise AI usage log`

---

## Testing strategy

**Vitest**, run in CI-less local mode. Deliberately weighted toward the pure functions:

| Layer | Approach | Why |
|---|---|---|
| `analysis`, `planner` | Exhaustive over all 20 candidates + synthetic edges | Pure, fast, and where the spec guarantees live |
| `interview` | Scripted full interviews with a stubbed LLM | Verifies state machine and guarantees without network |
| `route` | Direct handler invocation with `Request` objects | Contract conformance, no server needed |
| `llm`, `feedback` | Mocked client, incl. failure paths | Proves fallbacks actually work |
| UI | Manual | Not worth automating in a weekend |

Two tests carry disproportionate weight and should be written carefully:
1. **All-20-candidates full loop** — every candidate gets ≥8 questions across ≥4 days.
2. **Adversarial-LLM loop** — with a stub that always fails or always says `follow_up`, the
   interview still completes and still meets the minimums.

No live network in tests; the LLM client is injected so it can be stubbed.

---

## Dependency summary

**Runtime:** `next`, `react`, `react-dom`, `zod`, `openai` (Groq-pointed), `@upstash/redis`
**Dev:** `typescript`, `@types/*`, `vitest`, `eslint`, `eslint-config-next`, `tailwindcss`,
`@tailwindcss/postcss`

**External accounts:** GitHub (public repo, post-kickoff) · Vercel · Groq API key · Upstash Redis

**Env vars:** `GROQ_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — all three
optional for local dev; absent Redis falls back to memory, absent Groq falls back to deterministic.

---

## Cross-cutting edge cases

Tracked here so they don't fall between milestones:

| Case | Handled in | Approach |
|---|---|---|
| Serverless loses in-memory state | M4 | Redis; memory only as dev fallback |
| Session expired / unknown id | M4, M5 | 404 + clear restart message |
| Turn after interview ends | M5 | Return cached feedback, idempotent |
| Mission/curriculum title mismatch | M1 | Join on `day`, never title |
| `signals` contradicts `missions[]` | M2 | Trust `missions[]`; signals are coarse only |
| Fewer than 4 assessable topics | M3 | Documented fallback ladder |
| LLM down / rate-limited / malformed | M6, M8 | Retry once, then deterministic path |
| Model burns budget on one topic | M7 | Follow-up cap enforced in code |
| Prompt injection via answers | M9 | Delimited data, isolated scoring, stay in character |
| Legit answers *about* injection (day 27) | M9 | Neutralise, never keyword-block |
| Transcript exceeds context window | M7 | Last-N turns + running summary |
| Secrets in a public repo | M0, M12 | Gitignore first, grep history before submitting |

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Groq free tier throttled during judging | Medium | Deterministic fallback means it degrades, never dies |
| Upstash misconfigured on Vercel | Medium | Memory fallback keeps single-instance demos working |
| Scope creep on UI | High | M11 is timeboxed; M10 already satisfies Stage 1 |
| Deploy breaks late | Medium | Deployed from M0; every milestone pushed and verified |
| Running out of time | Medium | M5 is submittable on its own; M6–M11 are strictly additive |

**Cut list, in order, if time runs short:** M11 polish → M9 guardrails → M8 LLM feedback (keep
deterministic) → M7 adaptivity. **Never cut M0–M5** — that's the eligible, spec-compliant core.

---

## Stage 4 readiness

The Live Steer Challenge is a 20-minute unseen feature add. Three habits during the build make that
survivable, and all three are cheap:

- **Small named modules.** "Add a new question type" should mean touching `planner.ts` and
  `prompts.ts`, not hunting through a 600-line route handler.
- **All prompts in one file.** Most plausible live feature requests are prompt-level.
- **Fast test loop.** `npm test` in seconds gives confidence to change things under time pressure.

A likely live request is something like "add a difficulty setting" or "make it ask about a specific
module" — both are small changes against `planner.ts` if the planner stays a pure function of
profile → plan. Protecting that boundary is worth the discipline.
