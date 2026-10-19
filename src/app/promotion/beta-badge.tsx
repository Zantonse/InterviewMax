export function BetaBadge({ className = "bg-accent-100 text-ink-900" }: { className?: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wider ${className}`}
    >
      Beta
    </span>
  );
}
