"use client";

import { useEffect, useState } from "react";
import type { Candidate } from "@/lib/candidate";

export function CandidatePicker({ onSelect }: { onSelect: (candidate: Candidate) => void }) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/candidates")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load candidates (HTTP ${res.status}).`);
        return res.json();
      })
      .then((data: { candidates: Candidate[] }) => {
        if (!cancelled) setCandidates(data.candidates);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load candidates.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="w-full rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        {error}
      </div>
    );
  }

  if (!candidates) {
    return (
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-live="polite">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex animate-pulse flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="h-4 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-3 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-2 h-3 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {candidates.map((candidate) => {
        const { member, signals } = candidate;
        const firstTryRate =
          signals.missionsCompleted > 0
            ? Math.round((signals.missionsFirstTry / signals.missionsCompleted) * 100)
            : 0;
        return (
          <button
            key={member.id}
            onClick={() => onSelect(candidate)}
            className="flex flex-col gap-1 rounded-lg border border-zinc-200 p-4 text-left transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
          >
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">{member.name}</span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">{member.jobRole}</span>
            <span className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {signals.missionsCompleted} missions completed · {firstTryRate}% first-try
            </span>
          </button>
        );
      })}
    </div>
  );
}
