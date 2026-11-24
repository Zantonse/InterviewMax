import type { PitfallHit } from "@/lib/field/pitfalls";

// Field mistakes a feedback round found (src/lib/field/pitfalls.ts): the ones interviewers in the
// user's field cut people for. Shown under what was missing, in the same amber.
export function FieldPitfalls({ pitfalls }: { pitfalls?: PitfallHit[] }) {
  if (!pitfalls?.length) return null;
  return (
    <div className="mt-3 rounded-xl bg-amber-50 p-3" data-testid="field-pitfalls">
      <h4 className="text-sm font-semibold text-amber-900">A mistake interviewers in your field watch for</h4>
      <ul className="mt-1 space-y-1 text-sm text-amber-950">
        {pitfalls.map((p) => (
          <li key={p.id}>
            <span className="font-semibold">{p.label}:</span> {p.note}
          </li>
        ))}
      </ul>
    </div>
  );
}
