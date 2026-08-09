export interface InterviewProgress {
  questionsAsked: number;
  questionsTarget: number;
  daysCovered: number[];
}

const MIN_DAYS_REQUIRED = 4;

export function ProgressBar({ progress }: { progress: InterviewProgress }) {
  const { questionsAsked, questionsTarget, daysCovered } = progress;
  const pct = Math.min(100, Math.round((questionsAsked / questionsTarget) * 100));
  const sortedDays = [...daysCovered].sort((a, b) => a - b);

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          Question {questionsAsked} of {questionsTarget}
        </span>
        <span>
          {sortedDays.length} day{sortedDays.length === 1 ? "" : "s"} covered
          {sortedDays.length < MIN_DAYS_REQUIRED ? ` (min ${MIN_DAYS_REQUIRED})` : ""}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sortedDays.map((day) => (
          <span
            key={day}
            className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"
          >
            Day {day}
          </span>
        ))}
      </div>
    </div>
  );
}
