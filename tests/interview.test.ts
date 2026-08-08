import { afterEach, describe, expect, it, vi } from "vitest";

// Only exercised by the "LLM configured but unreachable" suite below — every
// other test in this file has no GROQ_API_KEY stubbed, so isLlmConfigured()
// short-circuits before this mock is ever reached.
vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(function MockOpenAI() {
      return {
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(new Error("simulated Groq outage")),
          },
        },
      };
    }),
  };
});

import { getAllCandidates, getCandidateById, type Candidate } from "@/lib/candidate";
import { nextTurn, startInterview } from "@/lib/interview";
import type { Session } from "@/lib/session";

const DEFAULT_ANSWER =
  "This is my detailed answer explaining the concept with a concrete example from my own project.";

async function runFullInterview(candidate: Candidate, answer = DEFAULT_ANSWER) {
  let { session, reply, done, feedback } = await startInterview(candidate, `test-${candidate.member.id}`);
  const replies = [reply];
  let guard = 0;
  while (!done) {
    if (++guard > 100) throw new Error("Interview did not terminate — possible infinite loop");
    const result = await nextTurn(session, answer);
    session = result.session;
    reply = result.reply;
    done = result.done;
    feedback = result.feedback;
    replies.push(reply);
  }
  return { session, replies, feedback };
}

describe("interview state machine — full loop across all 20 real candidates", () => {
  for (const candidate of getAllCandidates()) {
    it(`completes a spec-valid interview for ${candidate.member.id} (${candidate.member.name})`, async () => {
      const { session, feedback } = await runFullInterview(candidate);

      expect(session.phase).toBe("done");
      expect(session.questionsAsked).toBeGreaterThanOrEqual(8);
      expect(new Set(session.askedDays).size).toBeGreaterThanOrEqual(4);

      expect(feedback).toBeDefined();
      expect(feedback!.summary.length).toBeGreaterThan(0);
      expect(feedback!.strengths.length).toBeGreaterThan(0);
      expect(feedback!.gaps.length).toBeGreaterThan(0);
      expect(feedback!.next.length).toBeGreaterThan(0);
    });
  }
});

describe("interview state machine — behaviour", () => {
  const candidate = getCandidateById("CAND-013")!;

  it("bundles the first question into the start reply", async () => {
    const { reply, done } = await startInterview(candidate, "s1");
    expect(reply).toContain("Welcome");
    expect(reply.length).toBeGreaterThan(20);
    expect(done).toBe(false);
  });

  it("flips done exactly once, at the end", async () => {
    let session: Session = (await startInterview(candidate, "s2")).session;
    let done = false;
    let doneCount = 0;
    let guard = 0;
    while (!done) {
      if (++guard > 100) throw new Error("no termination");
      const result = await nextTurn(session, DEFAULT_ANSWER);
      session = result.session;
      done = result.done;
      if (done) doneCount++;
    }
    expect(doneCount).toBe(1);
  });

  it("preserves alternating agent/candidate transcript ordering", async () => {
    const { session: s0 } = await startInterview(candidate, "s3");
    const r1 = await nextTurn(s0, "answer one");
    const r2 = await nextTurn(r1.session, "answer two");
    const roles = r2.session.transcript.map((t) => t.role);
    expect(roles[0]).toBe("agent");
    for (let i = 1; i < roles.length; i++) {
      expect(roles[i]).not.toBe(roles[i - 1]);
    }
  });

  it("treats a blank answer as a non-answer, re-prompts once, then advances", async () => {
    const { session: s0 } = await startInterview(candidate, "s4");
    const questionsBefore = s0.questionsAsked;

    const r1 = await nextTurn(s0, "   ");
    expect(r1.session.awaitingReprompt).toBe(true);
    expect(r1.session.questionsAsked).toBe(questionsBefore);

    const r2 = await nextTurn(r1.session, "   ");
    expect(r2.session.awaitingReprompt).toBe(false);
    expect(r2.session.questionsAsked).toBeGreaterThan(questionsBefore);
  });

  it("returns cached feedback and does not advance on a turn after completion", async () => {
    let session: Session = (await startInterview(candidate, "s5")).session;
    let done = false;
    let guard = 0;
    while (!done) {
      if (++guard > 100) throw new Error("no termination");
      const result = await nextTurn(session, DEFAULT_ANSWER);
      session = result.session;
      done = result.done;
    }
    const feedbackAfterCompletion = session.feedback;
    const questionsAskedAfterCompletion = session.questionsAsked;

    const again = await nextTurn(session, "anything at all");
    expect(again.done).toBe(true);
    expect(again.feedback).toEqual(feedbackAfterCompletion);
    expect(again.session.questionsAsked).toBe(questionsAskedAfterCompletion);
  });

  it("truncates an extremely long answer before storing it", async () => {
    const { session: s0 } = await startInterview(candidate, "s6");
    const huge = "x".repeat(10_000);
    const r1 = await nextTurn(s0, huge);
    const stored = r1.session.transcript.find((t) => t.role === "candidate");
    expect(stored!.content.length).toBeLessThan(10_000);
  });
});

describe("interview state machine — LLM configured but unreachable", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("still completes a spec-valid interview via deterministic fallback", async () => {
    vi.stubEnv("GROQ_API_KEY", "fake-key-for-test");
    const candidate = getCandidateById("CAND-001")!;
    const { session } = await runFullInterview(candidate);
    expect(session.phase).toBe("done");
    expect(session.questionsAsked).toBeGreaterThanOrEqual(8);
    expect(new Set(session.askedDays).size).toBeGreaterThanOrEqual(4);
  });
});
