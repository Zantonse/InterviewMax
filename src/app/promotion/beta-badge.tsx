export function BetaBadge({ className = "bg-accent-100 text-ink-900" }: { className?: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-bold ${className}`}
    >
      Beta
    </span>
  );
}
