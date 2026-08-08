import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mockCreate = vi.fn();

vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(function MockOpenAI() {
      return {
        chat: { completions: { create: mockCreate } },
      };
    }),
  };
});

import { callJSON, isLlmConfigured, LlmError } from "@/lib/llm";

function completionWith(content: string) {
  return { choices: [{ message: { content } }] };
}

const schema = z.object({ question: z.string().min(1) });

beforeEach(() => {
  mockCreate.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("callJSON", () => {
  it("throws immediately without calling the API when GROQ_API_KEY is unset", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    await expect(callJSON({ system: "s", user: "u", schema })).rejects.toThrow(LlmError);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("parses and validates a well-formed response on the first try", async () => {
    vi.stubEnv("GROQ_API_KEY", "fake-key");
    mockCreate.mockResolvedValueOnce(completionWith('{"question":"Tell me about embeddings."}'));
    const result = await callJSON({ system: "s", user: "u", schema });
    expect(result.question).toBe("Tell me about embeddings.");
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("strips markdown code fences before parsing", async () => {
    vi.stubEnv("GROQ_API_KEY", "fake-key");
    mockCreate.mockResolvedValueOnce(completionWith('```json\n{"question":"Explain RAG."}\n```'));
    const result = await callJSON({ system: "s", user: "u", schema });
    expect(result.question).toBe("Explain RAG.");
  });

  it("retries once on invalid JSON and succeeds on the second attempt", async () => {
    vi.stubEnv("GROQ_API_KEY", "fake-key");
    mockCreate
      .mockResolvedValueOnce(completionWith("not json at all"))
      .mockResolvedValueOnce(completionWith('{"question":"Second try works."}'));
    const result = await callJSON({ system: "s", user: "u", schema });
    expect(result.question).toBe("Second try works.");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("throws LlmError when JSON is invalid twice in a row", async () => {
    vi.stubEnv("GROQ_API_KEY", "fake-key");
    mockCreate
      .mockResolvedValueOnce(completionWith("not json"))
      .mockResolvedValueOnce(completionWith("still not json"));
    await expect(callJSON({ system: "s", user: "u", schema })).rejects.toThrow(LlmError);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("rejects valid JSON that doesn't match the schema, and throws if the retry is also wrong", async () => {
    vi.stubEnv("GROQ_API_KEY", "fake-key");
    mockCreate
      .mockResolvedValueOnce(completionWith('{"wrongField":123}'))
      .mockResolvedValueOnce(completionWith('{"wrongField":456}'));
    await expect(callJSON({ system: "s", user: "u", schema })).rejects.toThrow(LlmError);
  });

  it("recovers when the retry produces schema-valid JSON", async () => {
    vi.stubEnv("GROQ_API_KEY", "fake-key");
    mockCreate
      .mockResolvedValueOnce(completionWith('{"wrongField":123}'))
      .mockResolvedValueOnce(completionWith('{"question":"Recovered."}'));
    const result = await callJSON({ system: "s", user: "u", schema });
    expect(result.question).toBe("Recovered.");
  });

  it("throws LlmError when the underlying request itself fails (network/429/etc.), without a second attempt", async () => {
    vi.stubEnv("GROQ_API_KEY", "fake-key");
    mockCreate.mockRejectedValueOnce(new Error("rate limited"));
    await expect(callJSON({ system: "s", user: "u", schema })).rejects.toThrow(LlmError);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

describe("isLlmConfigured", () => {
  it("reflects GROQ_API_KEY presence", () => {
    vi.stubEnv("GROQ_API_KEY", "");
    expect(isLlmConfigured()).toBe(false);
    vi.stubEnv("GROQ_API_KEY", "something");
    expect(isLlmConfigured()).toBe(true);
  });
});
