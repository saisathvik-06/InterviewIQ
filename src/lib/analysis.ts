import type { Candidate, Mission } from "@/lib/candidate";

export type TopicSignal = "strong" | "solid" | "shaky" | "failed" | "skipped";

export interface TopicAssessment {
  day: number;
  title: string;
  signal: TopicSignal;
}

export type SeniorityTier = "junior" | "mid" | "senior" | "principal";

export interface CandidateProfile {
  candidate: Candidate;
  /** One entry per distinct day the candidate has any mission record for. */
  topics: TopicAssessment[];
  /** missionsFirstTry / missionsCompleted, 0 when nothing is completed yet. */
  firstTryRate: number;
  /** commitDays / 31. */
  consistency: number;
  seniorityTier: SeniorityTier;
}

function isSkippedMission(mission: Mission): mission is Extract<Mission, { skipped: true }> {
  return "skipped" in mission && mission.skipped === true;
}

/**
 * Classifies a single mission. `signals` on the candidate object is a coarse,
 * sometimes-inconsistent summary (see docs/hackathon-brief.md §8) — this
 * always reads from the mission record itself, never from `signals`.
 */
export function classifyMission(mission: Mission): TopicSignal {
  if (isSkippedMission(mission)) return "skipped";
  if (!mission.passed) return "failed";
  if (mission.attempts === 1) return "strong";
  if (mission.attempts <= 3) return "solid";
  return "shaky";
}

export function classifySeniority(yearsExperience: number): SeniorityTier {
  if (yearsExperience <= 2) return "junior";
  if (yearsExperience <= 7) return "mid";
  if (yearsExperience <= 15) return "senior";
  return "principal";
}

export function analyseCandidate(candidate: Candidate): CandidateProfile {
  const seenDays = new Set<number>();
  const topics: TopicAssessment[] = [];
  for (const mission of candidate.missions) {
    if (seenDays.has(mission.day)) continue; // dedupe: first record for a day wins
    seenDays.add(mission.day);
    topics.push({
      day: mission.day,
      title: mission.title,
      signal: classifyMission(mission),
    });
  }

  const { missionsCompleted, missionsFirstTry, commitDays } = candidate.signals;
  const firstTryRate = missionsCompleted > 0 ? missionsFirstTry / missionsCompleted : 0;
  const consistency = commitDays / 31;

  return {
    candidate,
    topics,
    firstTryRate,
    consistency,
    seniorityTier: classifySeniority(candidate.member.yearsExperience),
  };
}

export function topicsBySignal(profile: CandidateProfile, signal: TopicSignal): TopicAssessment[] {
  return profile.topics.filter((t) => t.signal === signal);
}
