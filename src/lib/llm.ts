import OpenAI from "openai";
import type { z } from "zod";

const MODEL = "llama-3.3-70b-versatile";
const TIMEOUT_MS = 10_000;

let loggedMissingKey = false;

/** True when a Groq call is possible at all. Logs the deterministic-mode notice exactly once. */
export function isLlmConfigured(): boolean {
  const configured = Boolean(process.env.GROQ_API_KEY);
  if (!configured && !loggedMissingKey) {
    console.warn("GROQ_API_KEY not set — running in deterministic mode (no LLM calls).");
    loggedMissingKey = true;
  }
  return configured;
}

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
      timeout: TIMEOUT_MS,
      maxRetries: 1, // handles transient network/429 failures with the SDK's own backoff
    });
  }
  return client;
}

export class LlmError extends Error {}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

const DEFAULT_MAX_TOKENS = 400;
const MAX_CIRCUIT_BREAKER_MS = 5 * 60 * 1000; // never disable calls for longer than this in one go

// Circuit breaker for the Groq free tier's daily token cap (100k TPD). Hit repeatedly during
// real testing: once exhausted, every call was still attempted over the network, waited out a
// full round trip, and only then fell back — slow, and pointless since the cap can't clear
// mid-request. Once we see the specific "tokens per day" 429, skip the network call entirely
// until Groq's own reported reset time passes.
let quotaExhaustedUntil = 0;

function parseRetryAfterMs(message: string): number | null {
  const match = message.match(/try again in\s+(?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/i);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const totalMs = ((hours * 60 + minutes) * 60 + seconds) * 1000;
  return totalMs > 0 ? totalMs : null;
}

function noteIfDailyQuotaExhausted(message: string): void {
  if (!/tokens per day/i.test(message)) return;
  const retryMs = parseRetryAfterMs(message);
  const waitMs = Math.min(retryMs ?? MAX_CIRCUIT_BREAKER_MS, MAX_CIRCUIT_BREAKER_MS);
  quotaExhaustedUntil = Date.now() + waitMs;
  console.warn(`Groq daily token quota exhausted — skipping LLM calls for ~${Math.round(waitMs / 1000)}s.`);
}

/** Test-only: clears the circuit breaker so test cases don't leak state into each other. */
export function resetCircuitBreakerForTests(): void {
  quotaExhaustedUntil = 0;
}

/**
 * Calls Groq expecting a single JSON object matching `schema`. On invalid
 * JSON or a schema mismatch, retries once telling the model what was wrong;
 * if that also fails, throws LlmError. Callers must catch this and fall back
 * to a deterministic path — an LLM failure must never surface to the user.
 */
export async function callJSON<T>(params: {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
}): Promise<T> {
  if (!isLlmConfigured()) {
    throw new LlmError("GROQ_API_KEY not configured");
  }

  if (Date.now() < quotaExhaustedUntil) {
    throw new LlmError("Groq daily token quota known-exhausted — skipping network call until it resets");
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: params.system },
    { role: "user", content: params.user },
  ];

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      messages.push({
        role: "user",
        content: `Your previous response was invalid: ${lastError}. Return ONLY a single valid JSON object matching the required shape, with no markdown code fences.`,
      });
    }

    let raw: string;
    try {
      const completion = await getClient().chat.completions.create({
        model: MODEL,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
      });
      raw = completion.choices[0]?.message?.content ?? "";
    } catch (err) {
      // Network/API-level failure, after the SDK's own retry is exhausted.
      // Don't retry again at this layer — fail fast to the caller's fallback.
      const message = (err as Error).message;
      noteIfDailyQuotaExhausted(message);
      throw new LlmError(`Groq request failed: ${message}`);
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(stripCodeFences(raw));
    } catch (err) {
      lastError = `response was not valid JSON (${(err as Error).message})`;
      continue;
    }

    const result = params.schema.safeParse(parsedJson);
    if (result.success) {
      return result.data;
    }
    lastError = result.error.issues.map((i) => i.message).join("; ");
  }

  throw new LlmError(`Groq response failed validation twice: ${lastError}`);
}
