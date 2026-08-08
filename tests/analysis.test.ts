import { describe, expect, it } from "vitest";
import {
  analyseCandidate,
  classifyMission,
  classifySeniority,
  topicsBySignal,
} from "@/lib/analysis";
import { getAllCandidates, getCandidateById, parseCandidate } from "@/lib/candidate";

describe("classifyMission", () => {
  it.each([
    [{ day: 1, title: "x", passed: true, attempts: 1 }, "strong"],
    [{ day: 1, title: "x", passed: true, attempts: 2 }, "solid"],
    [{ day: 1, title: "x", passed: true, attempts: 3 }, "solid"],
    [{ day: 1, title: "x", passed: true, attempts: 4 }, "shaky"],
    [{ day: 1, title: "x", passed: true, attempts: 10 }, "shaky"],
    [{ day: 1, title: "x", passed: false, attempts: 1 }, "failed"],
    [{ day: 1, title: "x", passed: false, attempts: 5 }, "failed"],
    [{ day: 1, title: "x", skipped: true }, "skipped"],
  ] as const)("classifies %o as %s", (mission, expected) => {
    expect(classifyMission(mission)).toBe(expected);
  });
});

describe("classifySeniority", () => {
  it.each([
    [0, "junior"],
    [2, "junior"],
    [3, "mid"],
    [7, "mid"],
    [8, "senior"],
    [15, "senior"],
    [16, "principal"],
    [28, "principal"],
  ] as const)("years=%i -> %s", (years, expected) => {
    expect(classifySeniority(years)).toBe(expected);
  });
});

describe("analyseCandidate", () => {
  it("classifies every mission for all 20 real candidates without throwing", () => {
    for (const candidate of getAllCandidates()) {
      const profile = analyseCandidate(candidate);
      expect(profile.topics.length).toBeGreaterThan(0);
      for (const topic of profile.topics) {
        expect(["strong", "solid", "shaky", "failed", "skipped"]).toContain(topic.signal);
      }
    }
  });

  it("marks a first-try-everything candidate (CAND-018) entirely strong", () => {
    const profile = analyseCandidate(getCandidateById("CAND-018")!);
    expect(profile.topics.every((t) => t.signal === "strong")).toBe(true);
    expect(profile.firstTryRate).toBe(1);
  });

  it("correctly reads a struggling candidate (CAND-010)", () => {
    const profile = analyseCandidate(getCandidateById("CAND-010")!);
    const byDay = new Map(profile.topics.map((t) => [t.day, t.signal]));
    expect(byDay.get(8)).toBe("failed");
    expect(byDay.get(10)).toBe("failed");
    expect(byDay.get(22)).toBe("failed");
    expect(byDay.get(7)).toBe("shaky");
    expect(byDay.get(31)).toBe("solid");
  });

  it("counts all 5 skipped topics for CAND-011", () => {
    const profile = analyseCandidate(getCandidateById("CAND-011")!);
    expect(topicsBySignal(profile, "skipped").length).toBe(5);
  });

  it("never divides by zero when missionsCompleted is 0", () => {
    const candidate = parseCandidate({
      member: {
        id: "X",
        name: "X",
        jobRole: "X",
        yearsExperience: 1,
        education: "X",
        status: "COMPLETED",
      },
      missions: [{ day: 1, title: "x", skipped: true }],
      signals: { commitDays: 0, missionsCompleted: 0, missionsFirstTry: 0 },
    });
    const profile = analyseCandidate(candidate);
    expect(profile.firstTryRate).toBe(0);
    expect(Number.isFinite(profile.firstTryRate)).toBe(true);
  });

  it("dedupes a duplicate day entry, keeping the first record", () => {
    const candidate = parseCandidate({
      member: {
        id: "X",
        name: "X",
        jobRole: "X",
        yearsExperience: 1,
        education: "X",
        status: "COMPLETED",
      },
      missions: [
        { day: 7, title: "Embeddings Explained", passed: true, attempts: 1 },
        { day: 7, title: "Embeddings Explained", passed: false, attempts: 5 },
      ],
      signals: { commitDays: 1, missionsCompleted: 1, missionsFirstTry: 1 },
    });
    const profile = analyseCandidate(candidate);
    expect(profile.topics.length).toBe(1);
    expect(profile.topics[0].signal).toBe("strong");
  });

  it("computes consistency as commitDays / 31", () => {
    const profile = analyseCandidate(getCandidateById("CAND-001")!);
    expect(profile.consistency).toBeCloseTo(28 / 31);
  });
});
