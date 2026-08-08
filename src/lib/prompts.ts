import { z } from "zod";

export const questionResponseSchema = z.object({
  question: z.string().min(1),
});

export function questionSystemPrompt(): string {
  return [
    "You are conducting a live technical interview for a graduate of a 31-day AI engineering cohort.",
    "Ask exactly one clear, natural-sounding interview question that assesses the given curriculum objective.",
    "Sound like an experienced, warm-but-rigorous human interviewer — not a quiz generator.",
    'Respond with a single JSON object of the exact shape {"question": "..."} and nothing else — no markdown, no code fences, no extra keys.',
  ].join(" ");
}

export function questionUserPrompt(params: {
  candidateName: string;
  jobRole: string;
  seniorityTier: string;
  day: number;
  dayTitle: string;
  objective: string;
  tools: string[];
  intent: string;
  priorQuestions: string[];
}): string {
  const lines = [
    `Candidate: ${params.candidateName}, ${params.jobRole} (${params.seniorityTier}-level experience).`,
    `Curriculum day ${params.day}: "${params.dayTitle}".`,
    `Tools covered that day: ${params.tools.join(", ")}.`,
    `Objective to probe: ${params.objective}`,
    `Why this topic was picked for this candidate: ${params.intent}`,
  ];
  if (params.priorQuestions.length > 0) {
    lines.push(
      "Questions already asked earlier in this interview — do not repeat these or ask something too similar:",
      ...params.priorQuestions.map((q, i) => `${i + 1}. ${q}`),
    );
  }
  lines.push("Write exactly one new interview question assessing the objective above.");
  return lines.join("\n");
}
