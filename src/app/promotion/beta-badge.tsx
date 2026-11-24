export function BetaBadge({ className = "bg-ink-50 text-ink-700 ring-1 ring-ink-100" }: { className?: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}
    >
      Beta
    </span>
  );
}
