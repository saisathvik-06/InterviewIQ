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
}): Promise<T> {
  if (!isLlmConfigured()) {
    throw new LlmError("GROQ_API_KEY not configured");
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
      });
      raw = completion.choices[0]?.message?.content ?? "";
    } catch (err) {
      // Network/API-level failure, after the SDK's own retry is exhausted.
      // Don't retry again at this layer — fail fast to the caller's fallback.
      throw new LlmError(`Groq request failed: ${(err as Error).message}`);
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
