"use client";

import { useState } from "react";
import { CandidatePicker } from "@/components/CandidatePicker";
import { Chat } from "@/components/Chat";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import type { Candidate } from "@/lib/candidate";
import type { Feedback } from "@/lib/session";

type Phase = "picking" | "interviewing" | "done";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("picking");
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  function handleSelect(selected: Candidate) {
    setCandidate(selected);
    setSessionId(crypto.randomUUID());
    setFeedback(null);
    setPhase("interviewing");
  }

  function handleDone(finalFeedback: Feedback) {
    setFeedback(finalFeedback);
    setPhase("done");
  }

  function handleRestart() {
    setCandidate(null);
    setSessionId(null);
    setFeedback(null);
    setPhase("picking");
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-8 bg-zinc-50 px-4 py-10 dark:bg-black sm:px-8">
      <header className="flex w-full max-w-3xl flex-col gap-1">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">InterviewIQ</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          An AI-conducted technical interview based on a candidate&apos;s cohort progress.
        </p>
      </header>

      <main className="flex w-full max-w-3xl flex-1 flex-col items-center gap-6">
        {phase === "picking" && (
          <>
            <p className="w-full text-sm text-zinc-500 dark:text-zinc-400">
              Pick a candidate to begin. Interviews aren&apos;t saved anywhere — refreshing the page starts over.
            </p>
            <CandidatePicker onSelect={handleSelect} />
          </>
        )}

        {phase === "interviewing" && candidate && sessionId && (
          <>
            <p className="w-full text-sm text-zinc-500 dark:text-zinc-400">
              Interviewing{" "}
              <span className="font-medium text-zinc-700 dark:text-zinc-200">{candidate.member.name}</span> —{" "}
              {candidate.member.jobRole}
            </p>
            <Chat candidate={candidate} sessionId={sessionId} onDone={handleDone} />
          </>
        )}

        {phase === "done" && feedback && <FeedbackPanel feedback={feedback} onRestart={handleRestart} />}
      </main>
    </div>
  );
}
