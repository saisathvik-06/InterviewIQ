import { z } from "zod";
import rawCandidates from "../../data/candidates.json";

const passedMissionSchema = z.object({
  day: z.number().int().min(1).max(31),
  title: z.string().min(1),
  passed: z.boolean(),
  attempts: z.number().int().positive(),
});

const skippedMissionSchema = z.object({
  day: z.number().int().min(1).max(31),
  title: z.string().min(1),
  skipped: z.literal(true),
});

export const missionSchema = z.union([passedMissionSchema, skippedMissionSchema]);

const memberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  jobRole: z.string().min(1),
  yearsExperience: z.number().int().nonnegative(),
  education: z.string().min(1),
  status: z.string().min(1),
});

const signalsSchema = z.object({
  commitDays: z.number().int().nonnegative(),
  missionsCompleted: z.number().int().nonnegative(),
  missionsFirstTry: z.number().int().nonnegative(),
});

export const candidateSchema = z.object({
  member: memberSchema,
  missions: z.array(missionSchema).min(1),
  signals: signalsSchema,
});

const candidatesFileSchema = z.object({
  candidates: z.array(candidateSchema),
});

export type Mission = z.infer<typeof missionSchema>;
export type Member = z.infer<typeof memberSchema>;
export type Signals = z.infer<typeof signalsSchema>;
export type Candidate = z.infer<typeof candidateSchema>;

/** True for a mission the candidate skipped rather than attempted. */
export function isSkipped(mission: Mission): boolean {
  return "skipped" in mission && mission.skipped === true;
}

export function parseCandidate(data: unknown): Candidate {
  return candidateSchema.parse(data);
}

const allCandidates: Candidate[] = candidatesFileSchema.parse(rawCandidates).candidates;

export function getAllCandidates(): Candidate[] {
  return allCandidates;
}

export function getCandidateById(id: string): Candidate | undefined {
  return allCandidates.find((c) => c.member.id === id);
}
