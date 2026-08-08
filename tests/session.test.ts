import { afterEach, describe, expect, it, vi } from "vitest";
import { getStore, type Session } from "@/lib/session";

vi.mock("@upstash/redis", () => {
  return {
    // Must be a real function (not an arrow fn) so `new Redis(...)` works —
    // arrow functions have no [[Construct]] and throw "is not a constructor".
    Redis: vi.fn().mockImplementation(function MockRedis() {
      return {
        get: vi.fn().mockRejectedValue(new Error("simulated network outage")),
        set: vi.fn().mockRejectedValue(new Error("simulated network outage")),
      };
    }),
  };
});

function makeSession(sessionId: string): Session {
  return {
    sessionId,
    candidate: {
      member: {
        id: "CAND-TEST",
        name: "Test Candidate",
        jobRole: "Engineer",
        yearsExperience: 3,
        education: "BS",
        status: "COMPLETED",
      },
      missions: [{ day: 1, title: "x", passed: true, attempts: 1 }],
      signals: { commitDays: 1, missionsCompleted: 1, missionsFirstTry: 1 },
    },
    plan: { topics: [], totalQuestions: 8 },
    topicIndex: 0,
    topicQuestionIndex: 0,
    followUpsInTopic: 0,
    redirectedInTopic: false,
    questionsAsked: 0,
    askedDays: [],
    transcript: [],
    notes: [],
    phase: "questioning",
    createdAt: Date.now(),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getStore — no Redis configured", () => {
  it("round-trips a session through the in-memory store", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const store = getStore();
    const session = makeSession("mem-roundtrip");
    await store.set(session);
    const loaded = await store.get("mem-roundtrip");
    expect(loaded).toEqual(session);
  });

  it("returns null for an unknown sessionId without throwing", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const store = getStore();
    await expect(store.get("does-not-exist")).resolves.toBeNull();
  });

  it("preserves transcript ordering across repeated saves", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const store = getStore();
    const session = makeSession("mem-transcript-order");
    session.transcript.push({ role: "agent", content: "Q1" });
    await store.set(session);
    session.transcript.push({ role: "candidate", content: "A1" });
    session.transcript.push({ role: "agent", content: "Q2" });
    await store.set(session);

    const loaded = await store.get("mem-transcript-order");
    expect(loaded?.transcript.map((t) => t.content)).toEqual(["Q1", "A1", "Q2"]);
  });
});

describe("getStore — Redis configured but unreachable", () => {
  it("falls back to memory on get() without throwing", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fake.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fake-token");
    const store = getStore();
    await expect(store.get("fallback-get-unknown")).resolves.toBeNull();
  });

  it("falls back to memory on set(), and a later get() finds it there", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fake.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fake-token");
    const store = getStore();
    const session = makeSession("fallback-set-then-get");

    await store.set(session); // primary (mocked Redis) rejects -> falls back to shared memory store
    const loaded = await store.get("fallback-set-then-get"); // primary rejects again -> reads the fallback
    expect(loaded).toEqual(session);
  });
});
