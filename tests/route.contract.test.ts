import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/interview/route";
import { getCandidateById } from "@/lib/candidate";

function makeRequest(body: unknown, rawBody?: string): Request {
  return new Request("http://localhost/api/interview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: rawBody ?? JSON.stringify(body),
  });
}

describe("POST /api/interview — contract", () => {
  it("start: returns {reply, done:false} for a valid candidate", async () => {
    const candidate = getCandidateById("CAND-001")!;
    const res = await POST(makeRequest({ sessionId: "contract-start", candidate }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(typeof json.reply).toBe("string");
    expect(json.done).toBe(false);
    expect(json.feedback).toBeUndefined();
  });

  it("turn: returns {reply, done:false} mid-interview", async () => {
    const candidate = getCandidateById("CAND-001")!;
    await POST(makeRequest({ sessionId: "contract-turn", candidate }));
    const res = await POST(makeRequest({ sessionId: "contract-turn", message: "my answer" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(typeof json.reply).toBe("string");
    expect(json.done).toBe(false);
  });

  it("completes a full interview over HTTP with spec-shaped feedback and no extra keys", async () => {
    const candidate = getCandidateById("CAND-002")!;
    const sessionId = "contract-full";
    let res = await POST(makeRequest({ sessionId, candidate }));
    let json = await res.json();
    let guard = 0;
    while (!json.done) {
      if (++guard > 100) throw new Error("no termination");
      res = await POST(makeRequest({ sessionId, message: "a detailed answer with an example" }));
      json = await res.json();
    }
    expect(res.status).toBe(200);
    expect(json.done).toBe(true);
    expect(typeof json.reply).toBe("string");
    expect(typeof json.feedback.summary).toBe("string");
    expect(Array.isArray(json.feedback.strengths)).toBe(true);
    expect(Array.isArray(json.feedback.gaps)).toBe(true);
    expect(Array.isArray(json.feedback.next)).toBe(true);
    expect(Object.keys(json).sort()).toEqual(["done", "feedback", "reply"]);
  });

  it("400s when both candidate and message are present", async () => {
    const candidate = getCandidateById("CAND-001")!;
    const res = await POST(makeRequest({ sessionId: "x", candidate, message: "hi" }));
    expect(res.status).toBe(400);
  });

  it("400s when neither candidate nor message is present", async () => {
    const res = await POST(makeRequest({ sessionId: "x" }));
    expect(res.status).toBe(400);
  });

  it("400s on a non-string message", async () => {
    const res = await POST(makeRequest({ sessionId: "x", message: 12345 }));
    expect(res.status).toBe(400);
  });

  it("400s on an invalid candidate shape", async () => {
    const res = await POST(makeRequest({ sessionId: "x", candidate: { nope: true } }));
    expect(res.status).toBe(400);
  });

  it("400s on malformed JSON", async () => {
    const res = await POST(makeRequest(undefined, "{not valid json"));
    expect(res.status).toBe(400);
  });

  it("404s on an unknown sessionId turn, without crashing", async () => {
    const res = await POST(makeRequest({ sessionId: "does-not-exist-xyz", message: "hi" }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(typeof json.reply).toBe("string");
  });

  it("restarting an existing sessionId resets the session (idempotent start)", async () => {
    const candidate1 = getCandidateById("CAND-001")!;
    const candidate2 = getCandidateById("CAND-002")!;
    const sessionId = "contract-restart";
    await POST(makeRequest({ sessionId, candidate: candidate1 }));
    const res = await POST(makeRequest({ sessionId, candidate: candidate2 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reply).toContain(candidate2.member.name);
  });
});
