import { isSkipped, type Candidate } from "@/lib/candidate";

export function CandidateBrief({ candidate }: { candidate: Candidate }) {
  const { member, missions, signals } = candidate;
  const passed = missions.filter((m) => "passed" in m && m.passed).length;
  const failed = missions.filter((m) => "passed" in m && !m.passed).length;
  const skipped = missions.filter(isSkipped).length;
  const firstTryRate =
    signals.missionsCompleted > 0 ? Math.round((signals.missionsFirstTry / signals.missionsCompleted) * 100) : 0;

  return (
    <div className="flex w-full flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div>
        <p className="font-semibold text-zinc-900 dark:text-zinc-50">{member.name}</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {member.jobRole} · {member.yearsExperience} yr{member.yearsExperience === 1 ? "" : "s"} experience
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">Passed</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-50">{passed}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">Failed</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-50">{failed}</dd>
        </div>
        {skipped > 0 && (
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Skipped</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-50">{skipped}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">First-try rate</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-50">{firstTryRate}%</dd>
        </div>
      </dl>
    </div>
  );
}
