import { afterEach, describe, expect, it, vi } from "vitest";

// A single controllable mock shared by every test in this file. Tests that
// don't stub GROQ_API_KEY never reach it at all (isLlmConfigured() short-
// circuits first); tests that do stub it set mockCreate's behaviour
// per-test and reset it in afterEach.
const mockCreate = vi.fn();

vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(function MockOpenAI() {
      return {
        chat: {
          completions: {
            create: mockCreate,
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

/** Builds a Groq-shaped chat-completion response wrapping arbitrary JSON. */
function chatResponse(json: unknown) {
  return { choices: [{ message: { content: JSON.stringify(json) } }] };
}

/** The decision system prompt contains this phrase; the question one doesn't — used to route the mock. */
function isDecisionCall(messages: { content: string }[]): boolean {
  return (messages[0]?.content ?? "").includes("evaluating a candidate's spoken answer");
}

/** Routes mockCreate by call kind: every "assess the answer" call gets `action`, every "ask a question" call gets a unique question. */
function installAdaptiveMock(action: "follow_up" | "advance" | "redirect", assessment: Record<string, unknown> = {}) {
  let questionCounter = 0;
  mockCreate.mockImplementation(async (params: { messages: { content: string }[] }) => {
    if (isDecisionCall(params.messages)) {
      return chatResponse({
        assessment: { correctness: 4, depth: 4, usedConcreteExample: true, note: "assessed", ...assessment },
        action,
        reply: `Mocked ${action} reply #${questionCounter}`,
      });
    }
    questionCounter++;
    return chatResponse({ question: `Mocked generated question #${questionCounter}` });
  });
}

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
    mockCreate.mockReset();
  });

  it("still completes a spec-valid interview via deterministic fallback", async () => {
    vi.stubEnv("GROQ_API_KEY", "fake-key-for-test");
    mockCreate.mockRejectedValue(new Error("simulated Groq outage"));
    const candidate = getCandidateById("CAND-001")!;
    const { session } = await runFullInterview(candidate);
    expect(session.phase).toBe("done");
    expect(session.questionsAsked).toBeGreaterThanOrEqual(8);
    expect(new Set(session.askedDays).size).toBeGreaterThanOrEqual(4);
  });
});

describe("interview state machine — adaptive follow-ups (M7)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    mockCreate.mockReset();
  });

  it("follow_up keeps the same topic and question, and records a note", async () => {
    vi.stubEnv("GROQ_API_KEY", "fake-key-for-test");
    installAdaptiveMock("follow_up");
    const candidate = getCandidateById("CAND-013")!;
    const { session: s0 } = await startInterview(candidate, "adaptive-follow-up");

    const r1 = await nextTurn(s0, DEFAULT_ANSWER);

    expect(r1.done).toBe(false);
    expect(r1.reply).toContain("Mocked follow_up reply");
    expect(r1.session.topicIndex).toBe(0);
    expect(r1.session.topicQuestionIndex).toBe(s0.topicQuestionIndex); // unchanged — still same planned question
    expect(r1.session.followUpsInTopic).toBe(1);
    expect(r1.session.notes).toHaveLength(1);
    expect(r1.session.notes[0].day).toBe(s0.plan.topics[0].day);
  });

  it("advance moves to the next planned question or topic", async () => {
    vi.stubEnv("GROQ_API_KEY", "fake-key-for-test");
    installAdaptiveMock("advance");
    const candidate = getCandidateById("CAND-013")!;
    const { session: s0 } = await startInterview(candidate, "adaptive-advance");

    const r1 = await nextTurn(s0, DEFAULT_ANSWER);

    expect(r1.done).toBe(false);
    expect(r1.session.followUpsInTopic).toBe(0);
    expect(r1.session.questionsAsked).toBe(s0.questionsAsked + 1);
    expect(r1.session.notes).toHaveLength(1);
    // Either the next planned question within the same topic, or the first
    // question of the next topic — either way progression happened.
    const progressed =
      r1.session.topicQuestionIndex > s0.topicQuestionIndex || r1.session.topicIndex > s0.topicIndex;
    expect(progressed).toBe(true);
  });

  it("redirect keeps the same topic once, then a repeated redirect proposal is forced to advance", async () => {
    vi.stubEnv("GROQ_API_KEY", "fake-key-for-test");
    installAdaptiveMock("redirect");
    const candidate = getCandidateById("CAND-013")!;
    const { session: s0 } = await startInterview(candidate, "adaptive-redirect");

    const r1 = await nextTurn(s0, "let's talk about something else entirely");
    expect(r1.done).toBe(false);
    expect(r1.session.redirectedInTopic).toBe(true);
    expect(r1.session.topicIndex).toBe(0);
    expect(r1.session.topicQuestionIndex).toBe(s0.topicQuestionIndex);

    // Model proposes redirect again on the same topic — code overrides to advance.
    const r2 = await nextTurn(r1.session, "still off topic");
    const progressed =
      r2.session.topicQuestionIndex > r1.session.topicQuestionIndex || r2.session.topicIndex > r1.session.topicIndex;
    expect(progressed).toBe(true);
  });

  it('"I don\'t know" advances immediately and records an honest low-signal note', async () => {
    vi.stubEnv("GROQ_API_KEY", "fake-key-for-test");
    installAdaptiveMock("advance", { correctness: 1, depth: 1, usedConcreteExample: false, note: "candidate did not know" });
    const candidate = getCandidateById("CAND-013")!;
    const { session: s0 } = await startInterview(candidate, "adaptive-idk");

    const r1 = await nextTurn(s0, "I don't know");

    expect(r1.session.followUpsInTopic).toBe(0);
    expect(r1.session.notes).toHaveLength(1);
    expect(r1.session.notes[0].correctness).toBe(1);
    const progressed =
      r1.session.topicQuestionIndex > s0.topicQuestionIndex || r1.session.topicIndex > s0.topicIndex;
    expect(progressed).toBe(true);
  });

  it("notes accumulate one entry per scored answer, not per turn", async () => {
    vi.stubEnv("GROQ_API_KEY", "fake-key-for-test");
    installAdaptiveMock("advance");
    const candidate = getCandidateById("CAND-013")!;
    let session: Session = (await startInterview(candidate, "adaptive-notes")).session;

    for (let i = 0; i < 3; i++) {
      const result = await nextTurn(session, DEFAULT_ANSWER);
      session = result.session;
    }

    expect(session.notes).toHaveLength(3);
  });

  it("adversarial: a model that always proposes follow_up is still capped at 2 per topic and the full ≥8/≥4 guarantee holds across all 20 candidates", async () => {
    vi.stubEnv("GROQ_API_KEY", "fake-key-for-test");
    installAdaptiveMock("follow_up");

    for (const candidate of getAllCandidates()) {
      const { session } = await runFullInterview(candidate);
      expect(session.phase).toBe("done");
      expect(session.questionsAsked).toBeGreaterThanOrEqual(8);
      expect(new Set(session.askedDays).size).toBeGreaterThanOrEqual(4);
    }
  });
});
