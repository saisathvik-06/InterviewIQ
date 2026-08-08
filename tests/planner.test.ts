import { describe, expect, it } from "vitest";
import { analyseCandidate } from "@/lib/analysis";
import { getAllCandidates, getCandidateById, parseCandidate } from "@/lib/candidate";
import { getModuleForDay } from "@/lib/curriculum";
import { assertValidPlan, buildPlan, type InterviewPlan } from "@/lib/planner";

function distinctDays(plan: InterviewPlan): number {
  return new Set(plan.topics.map((t) => t.day)).size;
}

function makeCandidate(missions: unknown[], signals?: Partial<Record<string, number>>) {
  return parseCandidate({
    member: {
      id: "SYNTH",
      name: "Synthetic Candidate",
      jobRole: "Engineer",
      yearsExperience: 3,
      education: "BS",
      status: "COMPLETED",
    },
    missions,
    signals: {
      commitDays: 10,
      missionsCompleted: missions.length,
      missionsFirstTry: 1,
      ...signals,
    },
  });
}

describe("buildPlan — the core guarantee", () => {
  it("produces a valid plan (>=8 questions, >=4 distinct days) for all 20 real candidates", () => {
    for (const candidate of getAllCandidates()) {
      const profile = analyseCandidate(candidate);
      const plan = buildPlan(profile);
      expect(
        plan.totalQuestions,
        `${candidate.member.id}: only ${plan.totalQuestions} questions`,
      ).toBeGreaterThanOrEqual(8);
      expect(
        distinctDays(plan),
        `${candidate.member.id}: only ${distinctDays(plan)} distinct days`,
      ).toBeGreaterThanOrEqual(4);
      expect(() => assertValidPlan(plan)).not.toThrow();
    }
  });

  it("handles a candidate with only 1 passed mission (rest skipped)", () => {
    const candidate = makeCandidate([
      { day: 7, title: "Embeddings Explained", passed: true, attempts: 1 },
      { day: 8, title: "Vector Databases Overview", skipped: true },
      { day: 12, title: "Prompt Engineering Fundamentals", skipped: true },
    ]);
    const plan = buildPlan(analyseCandidate(candidate));
    expect(plan.totalQuestions).toBeGreaterThanOrEqual(8);
    expect(distinctDays(plan)).toBeGreaterThanOrEqual(4);
  });

  it("handles a candidate whose missions are entirely skipped", () => {
    const candidate = makeCandidate([
      { day: 7, title: "Embeddings Explained", skipped: true },
      { day: 8, title: "Vector Databases Overview", skipped: true },
      { day: 12, title: "Prompt Engineering Fundamentals", skipped: true },
    ]);
    const plan = buildPlan(analyseCandidate(candidate));
    expect(plan.totalQuestions).toBeGreaterThanOrEqual(8);
    expect(distinctDays(plan)).toBeGreaterThanOrEqual(4);
  });

  it("handles a candidate with exactly 4 passed missions and nothing else", () => {
    const candidate = makeCandidate([
      { day: 1, title: "VS Code & Python Environment Setup", passed: true, attempts: 1 },
      { day: 4, title: "Reading & Processing Structured Data", passed: true, attempts: 2 },
      { day: 7, title: "Embeddings Explained", passed: true, attempts: 3 },
      { day: 12, title: "Prompt Engineering Fundamentals", passed: true, attempts: 5 },
    ]);
    const plan = buildPlan(analyseCandidate(candidate));
    expect(plan.totalQuestions).toBeGreaterThanOrEqual(8);
    expect(distinctDays(plan)).toBeGreaterThanOrEqual(4);
  });

  it("is deterministic for a given candidate", () => {
    const profile = analyseCandidate(getCandidateById("CAND-013")!);
    const planA = buildPlan(profile);
    const planB = buildPlan(profile);
    expect(planA).toEqual(planB);
  });

  it("spreads across at least 3 distinct modules when the candidate's history allows it", () => {
    const profile = analyseCandidate(getCandidateById("CAND-013")!);
    const plan = buildPlan(profile);
    const modules = new Set(plan.topics.map((t) => getModuleForDay(t.day)?.n));
    expect(modules.size).toBeGreaterThanOrEqual(3);
  });
});

describe("assertValidPlan", () => {
  it("throws on a plan with too few questions", () => {
    const badPlan: InterviewPlan = {
      topics: [
        { day: 1, title: "a", objectives: ["x"], tools: ["y"], signal: "strong", intent: "i", questionsAllotted: 2 },
        { day: 2, title: "a", objectives: ["x"], tools: ["y"], signal: "strong", intent: "i", questionsAllotted: 2 },
        { day: 3, title: "a", objectives: ["x"], tools: ["y"], signal: "strong", intent: "i", questionsAllotted: 2 },
      ],
      totalQuestions: 6,
    };
    expect(() => assertValidPlan(badPlan)).toThrow(/questions/);
  });

  it("throws on a plan with too few distinct days", () => {
    const badPlan: InterviewPlan = {
      topics: [
        { day: 1, title: "a", objectives: ["x"], tools: ["y"], signal: "strong", intent: "i", questionsAllotted: 4 },
        { day: 2, title: "a", objectives: ["x"], tools: ["y"], signal: "strong", intent: "i", questionsAllotted: 4 },
      ],
      totalQuestions: 8,
    };
    expect(() => assertValidPlan(badPlan)).toThrow(/distinct curriculum days/);
  });

  it("does not throw on a valid hand-built plan", () => {
    const goodPlan: InterviewPlan = {
      topics: [1, 2, 3, 4].map((day) => ({
        day,
        title: "a",
        objectives: ["x"],
        tools: ["y"],
        signal: "strong" as const,
        intent: "i",
        questionsAllotted: 2,
      })),
      totalQuestions: 8,
    };
    expect(() => assertValidPlan(goodPlan)).not.toThrow();
  });
});
