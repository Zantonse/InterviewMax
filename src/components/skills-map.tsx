import { LEARNED, SKILL_LEVELS, type SkillStatus } from "@/lib/stories/skills";

// Story skills map (skills.ts): each storytelling skill with its level from 0 to 5 across the
// person's behavioral stories, and what gets it to the next one.
export function SkillsMap({ map }: { map: SkillStatus[] }) {
  const learned = map.filter((s) => s.level >= LEARNED).length;
  return (
    <section aria-labelledby="skills-heading" data-testid="skills-map">
      <p id="skills-heading" className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-3xl font-extrabold text-slate-900" data-testid="skills-learned">
          {learned} of {map.length}
        </span>
        <span className="text-slate-600">story skills learned</span>
      </p>
      <p className="mt-1 text-sm text-slate-500">
        A skill counts as learned once it shows in two of your stories, and in one of them before I
        asked about it.
      </p>
      <ul className="mt-4 flex flex-col gap-3" data-stagger>
        {map.map((s) => (
          <li
            key={s.skill.id}
            className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto]"
            data-testid={`skill-${s.skill.id}`}
          >
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{s.skill.label}</p>
              <p className="text-xs text-slate-500">{s.next ?? s.skill.what}</p>
            </div>
            <div className="flex items-center gap-2 sm:justify-end">
              <Pips level={s.level} />
              <span
                className={`w-24 text-xs font-semibold ${s.level >= LEARNED ? "text-emerald-700" : "text-slate-500"}`}
              >
                {SKILL_LEVELS[s.level].name}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Pips({ level }: { level: number }) {
  return (
    <span
      className="flex gap-1"
      role="img"
      aria-label={`Level ${level} of 5`}
      data-testid="skill-pips"
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-2 w-5 rounded-full ${
            i <= level ? (level >= LEARNED ? "bg-emerald-600" : "bg-ink-700") : "bg-slate-200"
          }`}
        />
      ))}
    </span>
  );
}
