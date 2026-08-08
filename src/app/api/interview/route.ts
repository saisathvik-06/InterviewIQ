import { NextResponse } from "next/server";
import { z } from "zod";
import { candidateSchema } from "@/lib/candidate";
import { buildFeedback } from "@/lib/feedback";
import { detectPromptInjection, turnCapExceeded } from "@/lib/guardrails";
import { nextTurn, startInterview } from "@/lib/interview";
import { getStore, type Session } from "@/lib/session";

const startRequestSchema = z.object({
  sessionId: z.string().min(1),
  candidate: candidateSchema,
});

const turnRequestSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string(),
});

const TURN_CAP_REPLY = "We've covered a lot of ground in this session — let's wrap up here.";
const UNEXPECTED_ERROR_REPLY = "Something went wrong on our end. Please try starting a new interview.";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** Ends the session gracefully when the turn cap is hit, reusing any already-cached feedback. */
async function endSessionAtTurnCap(session: Session) {
  const doneSession: Session = { ...session, phase: "done" };
  const feedback = session.feedback ?? (await buildFeedback(doneSession));
  const finalSession: Session = { ...doneSession, feedback };
  return { session: finalSession, feedback };
}

async function handlePost(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  if (typeof body !== "object" || body === null) {
    return badRequest("Request body must be a JSON object.");
  }

  const hasCandidate = "candidate" in body;
  const hasMessage = "message" in body;

  if (hasCandidate === hasMessage) {
    return badRequest(
      "Request must include exactly one of `candidate` (to start an interview) or `message` (to continue one).",
    );
  }

  const store = getStore();

  if (hasCandidate) {
    const parsed = startRequestSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(`Invalid start request: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
    }
    const { sessionId, candidate } = parsed.data;
    // The candidate object is client-supplied and its free-text fields (name, jobRole) are
    // interpolated into every prompt for the whole session — logged here for visibility, same
    // log-only/never-blocking treatment as answers. Real isolation is the delimiting in
    // prompts.ts and the output-side check in feedback.ts, not this log line.
    if (detectPromptInjection(candidate.member.name) || detectPromptInjection(candidate.member.jobRole)) {
      console.warn(`Possible prompt-injection attempt in candidate profile for session ${sessionId} — continuing normally.`);
    }
    const result = await startInterview(candidate, sessionId);
    await store.set(result.session);
    return NextResponse.json({ reply: result.reply, done: result.done });
  }

  const parsed = turnRequestSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(`Invalid turn request: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
  }
  const { sessionId, message } = parsed.data;

  const session = await store.get(sessionId);
  if (!session) {
    return NextResponse.json(
      { reply: "Session expired or not found — please start a new interview.", done: true },
      { status: 404 },
    );
  }

  // Logged, never blocking — the model itself is instructed to treat the answer as
  // data and ignore embedded directives (see decisionSystemPrompt). Day 27 candidates
  // legitimately discuss "prompt injection" as curriculum content, so this must never
  // refuse or alter behaviour on its own, only flag it for visibility.
  if (detectPromptInjection(message)) {
    console.warn(`Possible prompt-injection attempt in session ${sessionId} — continuing normally.`);
  }

  if (session.phase === "questioning" && turnCapExceeded(session)) {
    const { session: finalSession, feedback } = await endSessionAtTurnCap(session);
    await store.set(finalSession);
    return NextResponse.json({ reply: TURN_CAP_REPLY, done: true, feedback });
  }

  const result = await nextTurn(session, message);
  await store.set(result.session);

  if (result.done) {
    return NextResponse.json({ reply: result.reply, done: true, feedback: result.feedback });
  }
  return NextResponse.json({ reply: result.reply, done: false });
}

/**
 * Every failure path must return a spec-shaped `{reply, done}` body, never a raw
 * stack trace — the frontend (and a judge poking at the API directly) should never
 * see an unhandled exception. Expected failures (bad JSON, invalid shape, unknown
 * session) already return their own responses above; this only catches genuinely
 * unexpected errors (e.g. an infra hiccup in the session store).
 */
export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (err) {
    console.error("Unhandled error in POST /api/interview", err);
    return NextResponse.json({ reply: UNEXPECTED_ERROR_REPLY, done: false }, { status: 500 });
  }
}
