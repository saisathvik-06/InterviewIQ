import type { Session } from "@/lib/session";

/** Per-session turn cap so a runaway or abusive client can't drain the Groq free tier mid-judging. */
export const MAX_TURNS = 40;

// Deliberately specific imperative phrasing, not generic security vocabulary — day 27
// ("Security, Privacy & Guardrails") has candidates legitimately discussing "prompt injection"
// and "jailbreak safeguards" as curriculum content. Matching on that vocabulary would flag
// every honest day-27 answer, so these patterns target attack phrasing, not the topic.
const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all|any|the)?\s*(previous|prior|above)\s*(instructions|rules|prompts?)/i,
  /disregard (all|any|the)?\s*(previous|prior|above)\s*(instructions|rules|prompts?)/i,
  /you are now (a|an)?\s*\S/i,
  /forget (everything|all)( you (know|were told|were instructed))?/i,
  /reveal (your|the) (system )?(prompt|instructions)/i,
  /give me (a |an )?(full|perfect|max|10\/10|five.?star) (score|marks|rating)/i,
  /act as (a|an) (dan|jailbroken|unrestricted)/i,
  /new instructions?:/i,
  /\bsystem\s*:\s*you (must|will|should)/i,
];

/**
 * Flags obvious prompt-injection attempts in a candidate answer, for logging only — it never
 * blocks or changes behaviour. Real isolation comes from treating the answer as delimited data
 * in the LLM prompts (see decisionSystemPrompt/decisionUserPrompt in prompts.ts): the model is
 * instructed never to follow directives embedded in it, no matter what they claim. An interviewer
 * who calmly notices and carries on is both the safe behaviour and the better demo.
 */
export function detectPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

/** True once a session has used up its turn budget — checked before spending another LLM call on it. */
export function turnCapExceeded(session: Session): boolean {
  return session.questionsAsked >= MAX_TURNS;
}
