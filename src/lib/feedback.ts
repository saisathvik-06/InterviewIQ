import type { Feedback, Session } from "@/lib/session";

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
