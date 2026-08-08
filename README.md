# InterviewIQ

An AI interview agent that conducts a personalized, multi-turn technical interview based on a
candidate's actual progress through a 31-day AI engineering cohort, then produces structured
feedback at the end. Built for the "Interview Agent" hackathon problem statement — see
[`docs/hackathon-brief.md`](docs/hackathon-brief.md) for the full rules and
[`IMPLEMENTATION.md`](IMPLEMENTATION.md) for the build plan.

**Live demo:** https://interview-iq-nu-taupe.vercel.app/

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in what you have. Both are optional for local
dev — the app falls back gracefully without them:

| Variable | Required for | Without it |
|---|---|---|
| `GROQ_API_KEY` | LLM-generated questions/feedback | Falls back to a deterministic, template-based interview (added in a later milestone) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Session state surviving across serverless requests | Falls back to an in-memory store — fine for local dev, not for a multi-instance production deploy |

## Tests

```bash
npm test
```

_Full architecture, API contract, and setup instructions will be filled in as the build progresses._
