# InterviewIQ

An AI interview agent that conducts a personalized, multi-turn technical interview based on a
candidate's actual progress through a 31-day AI engineering cohort — then produces structured,
evidence-grounded feedback at the end. Built for the "Interview Agent" hackathon problem statement:
*"Build the interviewer, not the interview."*

**Live demo:** https://interview-iq-nu-taupe.vercel.app/
**Repo:** https://github.com/saisathvik-06/InterviewIQ

## 30-second demo

Open the live URL and pick **Diane Foster (CAND-018)** — 31/31 missions passed first try. Notice
the interview opens on her strongest topic and pushes for tradeoffs and failure modes rather than
textbook definitions.

Then restart and pick **Gerald Combs (CAND-010)** — 5 passed, 3 failed, 2 skipped, 1/23 first-try.
The questions, framing, and eventual feedback are visibly different: gentler probing on known weak
spots, and gaps that are honestly reported rather than glossed over. That contrast is the whole
point of the personalisation — same interviewer, different candidate, genuinely different interview.

The progress bar above the chat shows the curriculum days covered as they happen, so you can watch
the "≥8 questions across ≥4 days" requirement get satisfied live instead of taking it on faith.

## Architecture

**A deterministic control plane with an LLM presentation layer.**

Plain code owns the *skeleton* of the interview — which curriculum days get covered, how many
questions get asked, when to follow up, when to stop, and what the feedback object looks like. The
LLM owns the *surface* — phrasing questions naturally, reading an answer, and writing prose that
sounds like a person. Concretely:

```
src/lib/
  curriculum.ts   load + index the 31 days; lookup by day
  candidate.ts    zod schema + types for the candidate object
  analysis.ts     candidate profile → per-topic signal (pure)
  planner.ts      profile → ordered interview plan (pure) — the >=8/>=4 guarantee lives here
  session.ts      SessionStore: Redis in prod, in-memory locally
  interview.ts    the turn state machine (pure given a session)
  llm.ts          Groq client + safe JSON call with retry + a daily-quota circuit breaker
  prompts.ts      all prompt text, in one place
  feedback.ts     final feedback synthesis + deterministic fallback
  guardrails.ts   prompt-injection detection, turn cap
```

Two consequences of this shape, worth knowing before reading the code:

1. **Every LLM call has a deterministic fallback.** If Groq is rate-limited, out of daily quota, or
   returns junk, the interview degrades to scripted-but-coherent questions instead of collapsing.
   `src/lib/interview.ts`'s `generateQuestion` and `decideNextAction` both catch and fall back;
   nothing propagates an LLM failure to the user as an error.
2. **The model proposes, the code disposes.** Each turn, the LLM returns an `assessment` and a
   proposed `action` (`follow_up` / `advance` / `redirect`), but `interview.ts` enforces hard limits
   on top of it — at most 2 follow-ups per topic, always advance on the final planned question. A
   stubbed LLM that always says `follow_up` still can't break the day-coverage guarantee (see
   `tests/interview.test.ts`, the adversarial-LLM test).

## How the ≥8 questions / ≥4 days guarantee is enforced

`src/lib/planner.ts` builds a plan of 5 topics × 2 questions before any LLM call happens, and
`assertValidPlan()` throws unless the plan has at least 8 total questions and at least 4 distinct
curriculum days — called at the end of every `buildPlan()`, so an invalid plan can never leave that
module. `tests/planner.test.ts` runs this across **all 20 real candidates plus synthetic edge
cases** (a candidate with only 1 passed mission, one entirely skipped, one with exactly 4 passed
missions) and asserts `assertValidPlan` never throws for any of them.

That guarantee holds even with full LLM adaptivity turned on: follow-ups and redirects never touch
topic progression, only the planned advance-to-next-topic step does, and `interview.ts` forces an
advance rather than another follow-up once the plan requires it.

The running total is also exposed at runtime — every in-progress `/api/interview` response includes
a `progress: {questionsAsked, questionsTarget, daysCovered}` field, which is what powers the
progress bar in the UI and what `scripts/smoke.mjs` checks against a live deployment.

## API contract

A single endpoint, no authentication, state keyed by a client-generated `sessionId`:

```
POST /api/interview
```

**Start an interview** — first request for a `sessionId`, carries the full candidate object:

```bash
curl -s https://interview-iq-nu-taupe.vercel.app/api/interview \
  -H 'content-type: application/json' \
  -d '{
    "sessionId": "demo-1",
    "candidate": { "...": "see data/candidates.json for the full shape" }
  }'
# { "reply": "Welcome, ...", "done": false, "progress": { "questionsAsked": 1, "questionsTarget": 10, "daysCovered": [7] } }
```

**Continue the interview** — every subsequent request for that `sessionId`:

```bash
curl -s https://interview-iq-nu-taupe.vercel.app/api/interview \
  -H 'content-type: application/json' \
  -d '{ "sessionId": "demo-1", "message": "my answer to the last question" }'
# { "reply": "...", "done": false, "progress": { ... } }
```

**Completion** — once the plan is exhausted:

```json
{
  "reply": "Interview completed. Thanks for walking me through all of that.",
  "done": true,
  "feedback": { "summary": "...", "strengths": ["..."], "gaps": ["..."], "next": ["..."] }
}
```

The `progress` field only appears on in-progress responses; the final `done:true` payload is kept
exactly spec-shaped (`{reply, done, feedback}`, nothing more — see the "no extra keys" assertion in
`tests/route.contract.test.ts`).

Full resource listing (`GET /api/candidates`, curriculum/candidate JSON schemas) is in
[`docs/technical-spec.md`](docs/technical-spec.md) and [`docs/hackathon-brief.md`](docs/hackathon-brief.md).

## Local setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Copy `.env.local.example` to `.env.local`. **Both are optional** — the app is fully runnable and
testable with neither set:

| Variable | Required for | Without it |
|---|---|---|
| `GROQ_API_KEY` | LLM-generated questions, follow-ups, and feedback | Falls back to a deterministic, template-based interview — still spec-compliant, just mechanical |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Session state surviving across serverless requests | Falls back to an in-memory store — fine for local dev and single-instance demos, not for multi-instance production |

## Tests, build, lint, smoke

```bash
npm test          # vitest — 130+ tests, no network calls, LLM client is mocked/stubbed
npm run build     # next build — type-checks the whole project
npm run lint      # eslint
npm run smoke     # hits the live URL and drives a full interview through the real HTTP contract
```

`npm run smoke` takes an optional URL argument to point at a local server instead:

```bash
npm run dev &
npm run smoke -- http://localhost:3000
```

It asserts the response shapes match the spec key-for-key and that the ≥8 questions / ≥4 days
minimum actually held for the interview it just drove — a fast, dependency-free pre-submission
check.

## Out of scope (per the problem statement)

Voice interaction, user authentication, persistent user accounts, long-term conversation history,
mobile apps. All curriculum and candidate data is synthetic, provided for the hackathon.

## More detail

- [`docs/hackathon-brief.md`](docs/hackathon-brief.md) — the full hackathon rules, evaluation
  stages, and the stack decisions with their rationale
- [`IMPLEMENTATION.md`](IMPLEMENTATION.md) — the milestone-by-milestone build plan, with a status
  table linking every milestone to the commit that shipped it
- [`PROMPTS.md`](PROMPTS.md) — the full AI-usage log for this project
