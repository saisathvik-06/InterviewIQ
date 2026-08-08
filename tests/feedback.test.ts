import { afterEach, describe, expect, it, vi } from "vitest";

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

import { analyseCandidate } from "@/lib/analysis";
import { getAllCandidates, getCandidateById } from "@/lib/candidate";
import { buildDeterministicFeedback, buildFeedback } from "@/lib/feedback";
import { buildPlan } from "@/lib/planner";
import type { Session, TopicNote } from "@/lib/session";

function chatResponse(json: unknown) {
  return { choices: [{ message: { content: JSON.stringify(json) } }] };
}

function makeDoneSession(candidateId: string): Session {
  const candidate = getCandidateById(candidateId)!;
  const profile = analyseCandidate(candidate);
  const plan = buildPlan(profile);
  const askedDays = plan.topics.map((t) => t.day);
  const notes: TopicNote[] = plan.topics.map((t) => ({
    day: t.day,
    correctness: 4,
    depth: 4,
    usedConcreteExample: true,
    note: `Gave a solid, specific answer on day ${t.day}.`,
  }));
  const lastTopic = plan.topics[plan.topics.length - 1];

  return {
    sessionId: `feedback-test-${candidateId}`,
    candidate,
    plan,
    topicIndex: plan.topics.length - 1,
    topicQuestionIndex: lastTopic.questionsAllotted,
    followUpsInTopic: 0,
    redirectedInTopic: false,
    questionsAsked: plan.totalQuestions,
    askedDays,
    transcript: [],
    notes,
    phase: "done",
    createdAt: Date.now(),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  mockCreate.mockReset();
});

describe("buildDeterministicFeedback", () => {
  it("produces spec-shaped feedback for every one of the 20 candidates with no LLM configured", () => {
    for (const candidate of getAllCandidates()) {
      const session = makeDoneSession(candidate.member.id);
      const feedback = buildDeterministicFeedback(session);
      expect(feedback.summary.length).toBeGreaterThan(0);
      expect(feedback.strengths.length).toBeGreaterThan(0);
      expect(feedback.gaps.length).toBeGreaterThan(0);
      expect(feedback.next.length).toBeGreaterThan(0);
    }
  });
});

describe("buildFeedback — LLM-backed synthesis", () => {
  it("returns validated, grounded feedback citing a real covered day", async () => {
    vi.stubEnv("GROQ_API_KEY", "fake-key-for-test");
    const session = makeDoneSession("CAND-013");
    const realDay = session.askedDays[0];
    mockCreate.mockResolvedValue(
      chatResponse({
        summary: `Solid overall performance, particularly strong on day ${realDay}.`,
        strengths: [`Clearly explained the concept on day ${realDay} with a concrete example.`],
        gaps: ["Could go deeper on tradeoffs in a couple of areas."],
        next: [`Revisit day ${realDay} to push past the surface-level explanation.`],
      }),
    );

    const feedback = await buildFeedback(session);

    expect(feedback.summary.length).toBeGreaterThan(0);
    expect(feedback.strengths.length).toBeGreaterThan(0);
    expect(feedback.gaps.length).toBeGreaterThan(0);
    expect(feedback.next.length).toBeGreaterThan(0);
    const mentionsRealDay = [feedback.summary, ...feedback.strengths, ...feedback.next].some((t) =>
      t.includes(`day ${realDay}`),
    );
    expect(mentionsRealDay).toBe(true);
  });

  it("falls back to deterministic feedback on an LLM failure", async () => {
    vi.stubEnv("GROQ_API_KEY", "fake-key-for-test");
    mockCreate.mockRejectedValue(new Error("simulated Groq outage"));
    const session = makeDoneSession("CAND-001");

    const feedback = await buildFeedback(session);
    const expected = buildDeterministicFeedback(session);

    expect(feedback).toEqual(expected);
  });

  it("falls back to deterministic feedback when the model invents a day never discussed", async () => {
    vi.stubEnv("GROQ_API_KEY", "fake-key-for-test");
    const session = makeDoneSession("CAND-013");
    mockCreate.mockResolvedValue(
      chatResponse({
        summary: "Great performance on day 99, a day never actually covered in this interview.",
        strengths: ["Nailed day 99 completely."],
        gaps: ["None found."],
        next: ["Keep it up."],
      }),
    );

    const feedback = await buildFeedback(session);
    const expected = buildDeterministicFeedback(session);

    expect(feedback).toEqual(expected);
  });

  it("falls back to deterministic feedback when the model returns empty arrays", async () => {
    vi.stubEnv("GROQ_API_KEY", "fake-key-for-test");
    const session = makeDoneSession("CAND-001");
    // Always invalid (empty arrays fail schema's min(1)) — exhausts the one retry, then throws.
    mockCreate.mockResolvedValue(
      chatResponse({ summary: "Fine.", strengths: [], gaps: [], next: [] }),
    );

    const feedback = await buildFeedback(session);
    const expected = buildDeterministicFeedback(session);

    expect(feedback).toEqual(expected);
  });

  it("caps oversized arrays at 5 bullets", async () => {
    vi.stubEnv("GROQ_API_KEY", "fake-key-for-test");
    const session = makeDoneSession("CAND-013");
    const realDay = session.askedDays[0];
    const twenty = Array.from({ length: 20 }, (_, i) => `Point ${i + 1} about day ${realDay}.`);
    mockCreate.mockResolvedValue(
      chatResponse({ summary: `Summary about day ${realDay}.`, strengths: twenty, gaps: twenty, next: twenty }),
    );

    const feedback = await buildFeedback(session);

    expect(feedback.strengths.length).toBeLessThanOrEqual(5);
    expect(feedback.gaps.length).toBeLessThanOrEqual(5);
    expect(feedback.next.length).toBeLessThanOrEqual(5);
  });

  it("produces valid feedback for all 20 candidates via the LLM path", async () => {
    vi.stubEnv("GROQ_API_KEY", "fake-key-for-test");
    mockCreate.mockImplementation(async (params: { messages: { content: string }[] }) => {
      const userContent = params.messages[1]?.content ?? "";
      const dayMatch = userContent.match(/Days actually covered.*?:\s*(\d+)/);
      const day = dayMatch ? dayMatch[1] : "1";
      return chatResponse({
        summary: `Covered several topics, including day ${day}.`,
        strengths: [`Handled day ${day} well.`],
        gaps: [`Could improve on day ${day}.`],
        next: [`Revisit day ${day}.`],
      });
    });

    for (const candidate of getAllCandidates()) {
      const session = makeDoneSession(candidate.member.id);
      const feedback = await buildFeedback(session);
      expect(feedback.summary.length).toBeGreaterThan(0);
      expect(feedback.strengths.length).toBeGreaterThan(0);
      expect(feedback.gaps.length).toBeGreaterThan(0);
      expect(feedback.next.length).toBeGreaterThan(0);
    }
  });
});
