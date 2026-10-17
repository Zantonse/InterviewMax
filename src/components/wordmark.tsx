// "InterviewMax" with "Max" in periwinkle, as in the sidebar. `onDark` for graphite backgrounds.
export function Wordmark({ onDark = false }: { onDark?: boolean }) {
  return (
    <span
      className={`font-extrabold tracking-tight ${onDark ? "text-white" : "text-slate-900"}`}
    >
      Interview<span className={onDark ? "text-accent-400" : "text-accent-600"}>Max</span>
    </span>
  );
}
