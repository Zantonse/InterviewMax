// A story's level as three short bars (design review 2026-11-23): under a story's title, in home's
// question table and on its cue cards. The words beside it say the level; the bars are a picture.
export function LevelMeter({ level }: { level: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`h-1 w-3.5 rounded-full ${n <= level ? "bg-ink-900" : "bg-ink-200"}`}
        />
      ))}
    </span>
  );
}
