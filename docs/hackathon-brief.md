# InterviewIQ — Hackathon Brief

Single source of truth for this project. Everything the organizers gave us, plus the decisions made
so far. Read this first in any new session or when switching AI tools.

Build order and milestone status live in [`../IMPLEMENTATION.md`](../IMPLEMENTATION.md). AI-usage
log (required for submission) is [`../PROMPTS.md`](../PROMPTS.md) — keep it current every milestone.

**Live URL:** https://interview-iq-nu-taupe.vercel.app/
**GitHub repo:** https://github.com/saisathvik-06/InterviewIQ (public, `main` branch, connected to
Vercel — every push to `main` auto-redeploys)

**Working process, agreed with Sai Sathvik:** build one milestone at a time from
`IMPLEMENTATION.md`. Do not commit or push until Sai Sathvik has tested the milestone locally and
explicitly says to commit. Do not start the next milestone until told to.

Source files (`data/curriculum.json`, `data/candidates.json`, `docs/technical-spec.md`) are in the
repo as of Milestone 1, loaded through typed/validated loaders in `src/lib/curriculum.ts` and
`src/lib/candidate.ts`.

---

## 1. Project

**Name:** InterviewIQ
**Problem statement chosen:** The Interview Agent — *"Build the interviewer, not the interview."*

---

## 2. Timeline

| Milestone | When |
|---|---|
| Kickoff | Friday, 7 Aug · 8:00 PM IST |
| Midpoint check-in | Optional pulse check in WhatsApp — share progress, unblock teammates |
| **Deadline** | **Sunday, 9 Aug · 8:00 PM IST** — repos locked |
| Results | Winners announced Friday, 14 Aug |

Team changes closed Tuesday, 4 Aug · 11:59 PM IST (message organizers on WhatsApp if needed).

---

## 3. Submission checklist

Three things must be in place by the deadline. Submissions can be edited as often as you like
until then; each save replaces the last.

- [x] **Public GitHub repo** — full project source, public and cloneable. Private repos won't be judged.
- [x] **Live deployed URL** — something the judges can open (Vercel, Netlify, any reachable host). A README-only demo does not count.
- [x] **AI-usage log** — a `PROMPTS.md` in the repo, or exported chat transcripts. This is how they verify the build was genuinely vibe-coded.

---

## 4. Evaluation process (4 stages)

### Stage 1 — Eligibility verification (automatic, pass/fail)
Checked at submission and re-checked after the deadline. Must satisfy **all**:
- Repository publicly accessible
- Repository URL valid and accessible
- Live demo URL functional, returns a working application
- AI usage log included and accessible
- Submission belongs to a registered team
- Submission received before the deadline

Failing any one of these means the submission does not reach judging.

### Stage 2 — Authenticity review (automated analysis + manual review)
Verifies the project was genuinely created during the hackathon. These trigger manual review or
disqualification:
- Repo created **before** the official kickoff
- First commit already contains most of the project (imported codebase)
- Little/no commit activity during the hackathon, then one large final commit
- AI usage log doesn't reasonably correspond to the implemented features
- Prompt history incomplete, generic, or unrelated to the submitted project

> **Working implication:** create the repo after kickoff, commit incrementally as features land,
> and keep `PROMPTS.md` genuinely in sync with what was actually built.

### Stage 3 — Project judging (two independent judges, 100 points)
- Each judge scores separately; judges don't see each other's scores
- Final score = average of both
- If the two scores differ by more than 15 points, a third judge evaluates and the **median** of the three becomes final
- Published criteria: **originality, polish, and how well you steered the AI**

### Stage 4 — Live Steer Challenge (top 6 teams)
The six highest-scoring teams join a live video call, share their screen throughout, receive the
**same previously unseen feature request**, and implement it within **20 minutes** using their own
repository and whatever AI tools they used during the hackathon.

> **Working implication:** the codebase has to stay legible and fast to extend under time
> pressure. Clever-but-opaque architecture is a liability in round 4.

All verification and judging decisions by the organizers are final.

---

## 5. The challenge

The AI Cohort is a 31-day enterprise AI engineering program covering RAG, vector databases, prompt
engineering, agentic AI, MCP, AI deployment, and production AI systems. After the cohort, learners
should be able to confidently explain the systems they built and the engineering decisions behind
them — but preparing for technical interviews and communicating that knowledge remains a major
challenge.

Build an **AI Interview Agent** that conducts personalized technical interviews based on a
candidate's learning journey through the cohort. The interview should:

- Assess understanding of the concepts the candidate has completed
- Adapt naturally throughout the conversation
- Ask intelligent follow-up questions
- Maintain context across the interview
- Provide actionable feedback at the end

**The experience should resemble a real technical interview, not a scripted questionnaire.**

### Minimum requirements
- Conduct a conversational technical interview
- Ask **at least 8 questions** covering **at least 4 different curriculum days**
- Generate follow-up questions based on previous responses
- Maintain conversation context throughout
- Produce structured feedback at the end
- Expose the HTTP endpoint defined in the technical spec

### Explicitly out of scope
Voice interaction · user authentication · persistent user accounts · long-term conversation
history · mobile apps

### Free choice
AI models, frameworks, agent orchestration strategy, retrieval pipeline, system architecture.
Creativity in interview flow, reasoning, interaction design, and overall UX is highly encouraged.

### Notes from organizers
All curriculum and candidate data is synthetic, for the hackathon only.

---

## 6. Provided resources

1. **Curriculum** (`curriculum.json`) — 31 days across 8 modules; each day has a title, type
   (`SETUP` / `BUILD` / `LEARN` / `AI_CORE` / `SHIP_IT` / `OPTIMIZE` / `CAPSTONE`), tools, and
   learning objectives. Modules: 1 Environment & Tooling (d1–3), 2 Data Foundations (d4–6),
   3 Embeddings & Vector Search (d7–10), 4 LLM Core, Prompting & Fine-Tuning (d11–15),
   5 Chatbot Application Build (d16–20), 6 Agentic AI & MCP (d21–24),
   7 Evaluation, Security & Deployment (d25–28), 8 Production & Capstone (d29–31).
2. **Candidate profiles** (`candidates.json`) — 20 candidates (`CAND-001`…`CAND-020`). Each has
   `member` (id, name, jobRole, yearsExperience, education, status), `missions[]` (day, title, and
   either `passed` + `attempts` or `skipped: true`), and `signals` (commitDays, missionsCompleted,
   missionsFirstTry). Profiles vary widely — from first-try-everything AI engineers to career
   switchers who skipped core topics or failed missions — so the agent has to adapt to real spread.
3. **Technical specification** (`technical-spec.md`) — the API contract, reproduced in full next.

---

## 7. Required API contract

From `technical-spec.md`, reproduced in full. The agent must expose a **single endpoint**, with
**no authentication**, that maintains interview state using the provided `sessionId`:

```
POST /api/interview
```

**1. Start interview** — the first request initializes a new session:

```json
{ "sessionId": "abc-123", "candidate": { "...": "candidate.json" } }
```
```json
{ "reply": "Welcome. Let's begin your interview.", "done": false }
```

**2. Conversation turn** — every subsequent request carries the candidate's latest response:

```json
{ "sessionId": "abc-123", "message": "..." }
```
```json
{ "reply": "...", "done": false }
```

This continues until the interview is complete.

**3. End interview:**

```json
{
  "reply": "Interview completed.",
  "done": true,
  "feedback": {
    "summary": "...",
    "strengths": [],
    "gaps": [],
    "next": []
  }
}
```

Feedback field types: `summary` is a `string`; `strengths`, `gaps`, and `next` are `string[]`. Each
array should contain concise, actionable points.

Spec notes: use the supplied `sessionId` throughout; the interview should remain conversational
across multiple requests; the candidate object follows the `candidate.json` schema; teams are free
to choose any frontend, backend, LLM, framework, or architecture.

---

## 8. Decisions so far

Chosen by Sai Sathvik and implemented as described below — see [`IMPLEMENTATION.md`](../IMPLEMENTATION.md)'s
status table for the commit that shipped each milestone.

| Area | Decision | Rationale |
|---|---|---|
| LLM | **Groq** free tier (OpenAI-compatible API) | Free during judging, very fast |
| Hosting | **Vercel** | Free, trivial GitHub integration |
| Session state | **Upstash Redis** | Vercel is serverless — in-memory state does not survive between requests, so per-`sessionId` state must live outside the process |
| **Breeth** | **Not used** | Its value is long-term cross-session memory + user patterns, which the spec puts explicitly out of scope. One interview = one bounded session. Revisit only if there's spare time. |

### Accounts / keys needed
- **Groq API key** — console.groq.com → API Keys (free)
- **Upstash Redis** — console.upstash.com → create a Redis DB (free tier) → REST URL + REST token
- **Public GitHub repo** named `InterviewIQ`, created *after* kickoff (Stage 2 checks repo creation time)
- **Vercel account** linked to that repo

Whatever holds these secrets must be gitignored before the first commit — the repo is public.

### Standing working rules
- **Log every AI interaction in `PROMPTS.md`** — including work done in other tools/models (ChatGPT, Copilot, Cline, etc.). Stage 2 checks this against commit history.
- **Commit incrementally**, never one big dump at the end.
- Keep the code legible and quick to extend — Stage 4 is a 20-minute live feature add.

---

## 9. Local environment

Windows 11 · PowerShell · git 2.54.0 · Node v24.16.0 · npm 11.13.0 · **Python not installed** (the
`python` command only triggers the Windows Store stub — a Python stack would need a real install first).

Project root: `C:\Users\Sai Sathvik\OneDrive\Desktop\InterviewIQ`. Two gotchas seen already:

- It lives under **OneDrive** — if `npm install` ever gets strangely slow, OneDrive syncing
  `node_modules` is the likely cause. Fix by excluding the folder from sync, not by moving the project.
- The folder name has **capital letters**, which npm rejects in a package name. Anything running
  `create-next-app .` (or similar) in the project root fails; scaffold into a lowercase-named
  subfolder and move the files up, or set the package name explicitly.
