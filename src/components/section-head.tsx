// A section's heading row on a page with no cards (design review 2026-11-23): the title, a short
// note beside it, and at most one link or control on the right, over one rule.
export function SectionHead({
  id,
  title,
  note,
  action,
}: {
  id?: string;
  title: string;
  note?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-ink-200 pb-3">
      <h2 id={id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-lg font-semibold text-slate-900">{title}</span>
        {note && <span className="text-sm font-normal text-slate-600">{note}</span>}
      </h2>
      {action && <div className="flex items-baseline gap-4 text-sm">{action}</div>}
    </div>
  );
}
