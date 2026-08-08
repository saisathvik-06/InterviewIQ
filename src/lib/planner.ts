import type { CandidateProfile, TopicAssessment, TopicSignal } from "@/lib/analysis";
import { allDays, getDay, getModuleForDay } from "@/lib/curriculum";

export interface PlanTopic {
  day: number;
  title: string;
  objectives: string[];
  tools: string[];
  signal: TopicSignal;
  /** Why this topic was chosen — feeds both the question prompt and the final feedback. */
  intent: string;
  questionsAllotted: number;
}

export interface InterviewPlan {
  topics: PlanTopic[];
  totalQuestions: number;
}

const MIN_QUESTIONS = 8;
const MIN_DISTINCT_DAYS = 4;
const TARGET_TOPICS = 5;
const QUESTIONS_PER_TOPIC = 2;

/**
 * Throws unless the plan meets the hackathon's hard minimums. Called at the
 * end of buildPlan so an invalid plan can never leave this module — this is
 * the actual enforcement point for "≥8 questions across ≥4 curriculum days".
 */
export function assertValidPlan(plan: InterviewPlan): void {
  const distinctDays = new Set(plan.topics.map((t) => t.day)).size;
  if (plan.totalQuestions < MIN_QUESTIONS) {
    throw new Error(
      `Invalid interview plan: ${plan.totalQuestions} questions planned, need at least ${MIN_QUESTIONS}.`,
    );
  }
  if (distinctDays < MIN_DISTINCT_DAYS) {
    throw new Error(
      `Invalid interview plan: ${distinctDays} distinct curriculum days covered, need at least ${MIN_DISTINCT_DAYS}.`,
    );
  }
}

function byDayAsc(a: TopicAssessment, b: TopicAssessment): number {
  return a.day - b.day;
}

function fallbackIntent(signal: TopicSignal): string {
  switch (signal) {
    case "strong":
      return "Additional coverage on a topic you passed first try.";
    case "solid":
      return "Additional coverage on a topic you passed.";
    case "shaky":
      return "Additional coverage on a topic that took several attempts to pass.";
    case "failed":
      return "Revisiting a topic that didn't pass — probing gently, not a gotcha.";
    case "skipped":
      return "You skipped this one — talk me through what you'd expect it to involve.";
  }
}

/**
 * Builds a 5-topic / 10-question interview plan from a candidate profile.
 * Deterministic: the same profile always produces the same plan (selection
 * is by sorted day order, never randomised), which keeps demos reproducible.
 */
export function buildPlan(profile: CandidateProfile): InterviewPlan {
  const used = new Set<number>();
  const usedModules = new Set<number>();
  const selected: PlanTopic[] = [];

  function addTopic(
    t: TopicAssessment,
    intent: string,
    opts?: { requireNewModule?: boolean },
  ): boolean {
    if (used.has(t.day)) return false;
    const mod = getModuleForDay(t.day)?.n;
    if (opts?.requireNewModule && mod !== undefined && usedModules.has(mod)) return false;
    const day = getDay(t.day);
    if (!day) return false;
    used.add(t.day);
    if (mod !== undefined) usedModules.add(mod);
    selected.push({
      day: t.day,
      title: day.title,
      objectives: day.objectives,
      tools: day.tools,
      signal: t.signal,
      intent,
      questionsAllotted: QUESTIONS_PER_TOPIC,
    });
    return true;
  }

  const strong = profile.topics.filter((t) => t.signal === "strong").sort(byDayAsc);
  const solidShaky = profile.topics
    .filter((t) => t.signal === "solid" || t.signal === "shaky")
    .sort(byDayAsc);
  const failed = profile.topics.filter((t) => t.signal === "failed").sort(byDayAsc);
  const skipped = profile.topics.filter((t) => t.signal === "skipped").sort(byDayAsc);
  const passed = profile.topics
    .filter((t) => t.signal === "strong" || t.signal === "solid" || t.signal === "shaky")
    .sort(byDayAsc);

  // 1. Opener — one topic passed first try, to build rapport before the harder material.
  for (const t of strong) {
    if (
      addTopic(
        t,
        "Opening question on a topic you passed first try — building rapport before the harder material.",
      )
    )
      break;
  }

  // 2. Middle — two solid/shaky topics, preferring distinct modules over each other and the opener.
  let middleWanted = 2;
  for (const t of solidShaky) {
    if (middleWanted <= 0) break;
    if (addTopic(t, fallbackIntent(t.signal), { requireNewModule: true })) middleWanted--;
  }
  for (const t of solidShaky) {
    if (middleWanted <= 0) break;
    if (addTopic(t, fallbackIntent(t.signal))) middleWanted--;
  }

  // 3. Ceiling — the most advanced passed topic not yet used.
  const ceilingPool = [...passed].sort((a, b) => b.day - a.day);
  for (const t of ceilingPool) {
    if (addTopic(t, "Testing your ceiling with the most advanced topic you've completed.")) break;
  }

  // 4. Closer — the capstone, if passed. The single best question for "explain what you built".
  const capstone = passed.find((t) => t.day === 31);
  if (capstone) {
    addTopic(capstone, "Closing question: walk me through what you built, end to end.");
  }

  // Top up to the 5-topic target, in priority order, until every real signal is exhausted.
  for (const pool of [passed, failed, skipped]) {
    for (const t of pool) {
      if (selected.length >= TARGET_TOPICS) break;
      addTopic(t, fallbackIntent(t.signal));
    }
    if (selected.length >= TARGET_TOPICS) break;
  }

  // Last resort: the candidate has fewer than 5 total mission records. Pull the
  // lowest-numbered curriculum days with no mission record at all.
  if (selected.length < TARGET_TOPICS) {
    for (const day of allDays()) {
      if (selected.length >= TARGET_TOPICS) break;
      if (used.has(day.day)) continue;
      used.add(day.day);
      selected.push({
        day: day.day,
        title: day.title,
        objectives: day.objectives,
        tools: day.tools,
        signal: "skipped",
        intent: "No mission record for this day — walk me through what you'd expect it to involve.",
        questionsAllotted: QUESTIONS_PER_TOPIC,
      });
    }
  }

  const plan: InterviewPlan = {
    topics: selected,
    totalQuestions: selected.reduce((sum, t) => sum + t.questionsAllotted, 0),
  };
  assertValidPlan(plan);
  return plan;
}
