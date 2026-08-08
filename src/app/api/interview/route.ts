import { NextResponse } from "next/server";
import { z } from "zod";
import { candidateSchema } from "@/lib/candidate";
import { nextTurn, startInterview } from "@/lib/interview";
import { getStore } from "@/lib/session";

const startRequestSchema = z.object({
  sessionId: z.string().min(1),
  candidate: candidateSchema,
});

const turnRequestSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string(),
});

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
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

  const result = await nextTurn(session, message);
  await store.set(result.session);

  if (result.done) {
    return NextResponse.json({ reply: result.reply, done: true, feedback: result.feedback });
  }
  return NextResponse.json({ reply: result.reply, done: false });
}
