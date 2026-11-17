// The quiet status beside a setting that saves as it changes.
export function SaveStatus({
  pending,
  error,
  saved,
}: {
  pending: boolean;
  error?: string;
  saved: boolean;
}) {
  return (
    <p className="min-h-5 text-sm" role="status" aria-live="polite">
      {pending ? (
        <span className="text-slate-600">Saving…</span>
      ) : error ? (
        <span className="text-red-700">{error}</span>
      ) : saved ? (
        <span className="text-slate-600">Saved.</span>
      ) : null}
    </p>
  );
}
