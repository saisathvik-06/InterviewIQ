import type { Feedback } from "@/lib/session";

function FeedbackSection({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "negative" | "neutral";
}) {
  if (items.length === 0) return null;
  const dot = tone === "positive" ? "bg-green-500" : tone === "negative" ? "bg-amber-500" : "bg-blue-500";
  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FeedbackPanel({ feedback, onRestart }: { feedback: Feedback; onRestart: () => void }) {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-6 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Summary</h2>
        <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{feedback.summary}</p>
      </div>
      <FeedbackSection title="Strengths" items={feedback.strengths} tone="positive" />
      <FeedbackSection title="Gaps" items={feedback.gaps} tone="negative" />
      <FeedbackSection title="Next steps" items={feedback.next} tone="neutral" />
      <button
        onClick={onRestart}
        className="self-start rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Start another interview
      </button>
    </div>
  );
}
