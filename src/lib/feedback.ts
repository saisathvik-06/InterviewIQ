import { analyseCandidate } from "@/lib/analysis";
import { callJSON, isLlmConfigured } from "@/lib/llm";
import { feedbackResponseSchema, feedbackSystemPrompt, feedbackUserPrompt } from "@/lib/prompts";
import type { Feedback, Session } from "@/lib/session";

const MAX_BULLETS = 5;

/**
 * Builds feedback purely from the plan's topic signals (already known before
 * the interview even started) — no reading of transcript content, since there
 * is no LLM yet to judge answer quality. This is also the fallback used later
 * whenever the LLM-based synthesis (a future milestone) fails.
 */
export function buildDeterministicFeedback(session: Session): Feedback {
  const topics = session.plan.topics;

  const strongTopics = topics.filter((t) => t.signal === "strong");
  const solidTopics = topics.filter((t) => t.signal === "solid" || t.signal === "shaky");
  const gapTopics = topics.filter((t) => t.signal === "failed" || t.signal === "skipped");

  const strengths = [...strongTopics, ...solidTopics].map(
    (t) => `Day ${t.day} — ${t.title}: demonstrated understanding during the interview.`,
  );

  const gaps = gapTopics.map(
    (t) =>
      `Day ${t.day} — ${t.title}: ${
        t.signal === "skipped" ? "not yet attempted on the platform" : "did not pass on the platform"
      }, worth revisiting.`,
  );

  const next =
    gapTopics.length > 0
      ? gapTopics.map((t) => `Revisit day ${t.day} (${t.title}) and rebuild the core concepts.`)
      : ["Continue deepening expertise across the modules covered in this interview."];

  const daysCovered = topics.map((t) => t.day).join(", ");
  const strongDays = strongTopics.map((t) => t.day).join(", ");
  const gapDays = gapTopics.map((t) => t.day).join(", ");

  const summary = [
    `Covered ${topics.length} topics across days ${daysCovered} of the cohort.`,
    strongTopics.length > 0 ? `Strongest performance on day${strongTopics.length > 1 ? "s" : ""} ${strongDays}.` : "",
    gapTopics.length > 0
      ? `Some gaps remain around day${gapTopics.length > 1 ? "s" : ""} ${gapDays}.`
      : "No major gaps identified from platform history.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    summary,
    strengths: strengths.length > 0 ? strengths.slice(0, 5) : ["Completed the interview across all planned topics."],
    gaps: gaps.length > 0 ? gaps.slice(0, 5) : ["No significant gaps identified from platform history."],
    next: next.slice(0, 5),
  };
}

/** Every "day N" mention in a piece of feedback text, so it can be checked against what was actually asked. */
function referencedDays(text: string): number[] {
  return [...text.matchAll(/day\s+(\d{1,2})/gi)].map((m) => Number(m[1]));
}

function onlyReferencesAskedDays(feedback: { summary: string; strengths: string[]; gaps: string[]; next: string[] }, askedDays: number[]): boolean {
  const allText = [feedback.summary, ...feedback.strengths, ...feedback.gaps, ...feedback.next];
  return allText.every((text) => referencedDays(text).every((day) => askedDays.includes(day)));
}

/**
 * Synthesises feedback from the notes accumulated live during the interview
 * (M7's per-answer assessments) plus the plan's topic intents. Grounded in
 * evidence, not a re-read of the raw transcript. Falls back to
 * `buildDeterministicFeedback` verbatim on any LLM failure or if the model
 * invents a day that was never actually discussed — an invented day is worse
 * than a generic-but-honest fallback.
 */
export async function buildFeedback(session: Session): Promise<Feedback> {
  if (!isLlmConfigured()) return buildDeterministicFeedback(session);

  try {
    const seniorityTier = analyseCandidate(session.candidate).seniorityTier;
    const result = await callJSON({
      system: feedbackSystemPrompt(),
      user: feedbackUserPrompt({
        candidateName: session.candidate.member.name,
        jobRole: session.candidate.member.jobRole,
        seniorityTier,
        topics: session.plan.topics.map((t) => ({ day: t.day, title: t.title, signal: t.signal, intent: t.intent })),
        notes: session.notes,
        askedDays: session.askedDays,
      }),
      schema: feedbackResponseSchema,
    });

    const feedback: Feedback = {
      summary: result.summary,
      strengths: result.strengths.slice(0, MAX_BULLETS),
      gaps: result.gaps.slice(0, MAX_BULLETS),
      next: result.next.slice(0, MAX_BULLETS),
    };

    if (!onlyReferencesAskedDays(feedback, session.askedDays)) {
      return buildDeterministicFeedback(session);
    }

    return feedback;
  } catch {
    return buildDeterministicFeedback(session);
  }
}
