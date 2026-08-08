import { describe, expect, it } from "vitest";
import {
  candidateSchema,
  getAllCandidates,
  getCandidateById,
  isSkipped,
  parseCandidate,
} from "@/lib/candidate";
import { getDay } from "@/lib/curriculum";

describe("candidate data", () => {
  it("parses all 20 provided candidates without throwing", () => {
    const candidates = getAllCandidates();
    expect(candidates.length).toBe(20);
  });

  it("looks candidates up by id", () => {
    expect(getCandidateById("CAND-001")?.member.name).toBe("Sarah Johnson");
    expect(getCandidateById("CAND-999")).toBeUndefined();
  });

  it("resolves every mission's day against the real curriculum", () => {
    for (const candidate of getAllCandidates()) {
      for (const mission of candidate.missions) {
        expect(
          getDay(mission.day),
          `${candidate.member.id} references day ${mission.day}, which does not exist in curriculum.json`,
        ).toBeDefined();
      }
    }
  });

  it("classifies skipped vs. attempted missions correctly", () => {
    const wendy = getCandidateById("CAND-006")!;
    const skippedDays = wendy.missions.filter(isSkipped).map((m) => m.day);
    expect(skippedDays).toEqual(expect.arrayContaining([27, 28]));

    const passedDays = wendy.missions.filter((m) => !isSkipped(m)).map((m) => m.day);
    expect(passedDays).not.toContain(27);
    expect(passedDays).not.toContain(28);
  });

  it("rejects a candidate missing the member block", () => {
    expect(() =>
      parseCandidate({
        missions: [{ day: 1, title: "x", passed: true, attempts: 1 }],
        signals: { commitDays: 1, missionsCompleted: 1, missionsFirstTry: 1 },
      }),
    ).toThrow();
  });

  it("rejects a mission that is neither passed nor skipped", () => {
    const result = candidateSchema.safeParse({
      member: {
        id: "X",
        name: "X",
        jobRole: "X",
        yearsExperience: 1,
        education: "X",
        status: "COMPLETED",
      },
      missions: [{ day: 1, title: "x" }],
      signals: { commitDays: 1, missionsCompleted: 1, missionsFirstTry: 1 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative attempts", () => {
    const result = candidateSchema.safeParse({
      member: {
        id: "X",
        name: "X",
        jobRole: "X",
        yearsExperience: 1,
        education: "X",
        status: "COMPLETED",
      },
      missions: [{ day: 1, title: "x", passed: true, attempts: -1 }],
      signals: { commitDays: 1, missionsCompleted: 1, missionsFirstTry: 1 },
    });
    expect(result.success).toBe(false);
  });
});
