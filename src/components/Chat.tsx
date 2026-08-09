"use client";

import { useEffect, useRef, useState } from "react";
import type { Candidate } from "@/lib/candidate";
import type { Feedback } from "@/lib/session";
import type { InterviewProgress } from "@/components/ProgressBar";

interface ChatMessage {
  role: "agent" | "candidate";
  content: string;
}

type Status = "starting" | "idle" | "sending" | "error" | "expired";

export function Chat({
  candidate,
  sessionId,
  onDone,
  onProgress,
}: {
  candidate: Candidate;
  sessionId: string;
  onDone: (feedback: Feedback) => void;
  onProgress?: (progress: InterviewProgress) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryHandler, setRetryHandler] = useState<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    start();
    // Runs once on mount for this session; sessionId/candidate don't change within a Chat instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setStatus("starting");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, candidate }),
      });
      if (!res.ok) throw new Error(`Couldn't start the interview (HTTP ${res.status}).`);
      const data = await res.json();
      setMessages([{ role: "agent", content: data.reply }]);
      if (data.progress) onProgress?.(data.progress);
      setStatus("idle");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Couldn't start the interview.");
      setStatus("error");
      setRetryHandler(() => start);
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || status === "sending" || status === "starting") return;

    setMessages((prev) => [...prev, { role: "candidate", content: trimmed }]);
    setInput("");
    setStatus("sending");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, message: trimmed }),
      });
      if (res.status === 404) {
        setStatus("expired");
        return;
      }
      if (!res.ok) throw new Error(`That didn't go through (HTTP ${res.status}).`);
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "agent", content: data.reply }]);
      if (data.done) {
        onDone(data.feedback);
        return;
      }
      if (data.progress) onProgress?.(data.progress);
      setStatus("idle");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong sending that answer.");
      setStatus("error");
      setRetryHandler(() => () => sendMessage(trimmed));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  const inputDisabled = status === "sending" || status === "starting" || status === "expired";

  return (
    <div className="flex w-full max-w-2xl flex-1 flex-col gap-4">
      <div
        className="flex flex-1 flex-col gap-3 overflow-y-auto rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        style={{ maxHeight: "60vh", minHeight: "20rem" }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
              m.role === "agent"
                ? "self-start bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                : "self-end bg-blue-600 text-white"
            }`}
          >
            {m.content}
          </div>
        ))}
        {(status === "starting" || status === "sending") && (
          <div className="self-start rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <span className="animate-pulse">Thinking…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {status === "expired" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          This session has expired — please start a new interview.
        </div>
      )}

      {status === "error" && errorMessage && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <span>{errorMessage}</span>
          {retryHandler && (
            <button
              onClick={() => retryHandler()}
              className="shrink-0 rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
            >
              Retry
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={inputDisabled}
          placeholder={status === "expired" ? "Session expired" : "Type your answer…"}
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={inputDisabled || !input.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
