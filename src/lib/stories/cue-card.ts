import { QUESTION_THEMES } from "@/lib/questions/themes";

// What a story's cue card on home shows besides its title (design review 2026-11-23, fix 6): the
// one figure to remember it by and the question themes it answers. Plain code, no model: the
// figure is copied from the story as written, never made up or rounded.

// Where the figure is looked for first: the result, then the rest of the story.
const FIGURE_PARTS = ["result", "highlight", "actions", "situation", "present", "path", "reflection"];

const NUM = String.raw`(?:about |around |roughly |nearly |over |under |~)?\$?\d[\d,.]*(?:\s?(?:%|percent\b|[kKmMbB]\b|x\b|×)|\s(?:million|billion|thousand)\b)?`;
const FROM_TO = new RegExp(String.raw`\bfrom (${NUM}) (?:down |up )?to (${NUM})`, "i");
const FIGURE = new RegExp(String.raw`(${NUM})((?: [A-Za-z][A-Za-z'-]*){0,2})`);
// Words a figure's phrase shouldn't end on ("21% at the" becomes "21%").
const TRAILING = new Set(["a", "an", "and", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "with", "per", "than", "across", "over", "into"]);

// "38% → 21%", "31 clinics", "$2.4M", or undefined when the story has no figure.
export function keyFigure(parts: Record<string, string> | undefined): string | undefined {
  if (!parts) return undefined;
  const order = [
    ...FIGURE_PARTS.filter((id) => parts[id]?.trim()),
    ...Object.keys(parts).filter((id) => !FIGURE_PARTS.includes(id)),
  ];
  for (const id of order) {
    const text = parts[id] ?? "";
    const fromTo = text.match(FROM_TO);
    if (fromTo) return `${clean(fromTo[1])} → ${clean(fromTo[2])}`;
    const found = text.match(FIGURE);
    if (!found) continue;
    const number = clean(found[1]);
    // A year ("in 2023") or a bare list number isn't a figure worth remembering.
    if (/^(19|20)\d\d$/.test(number)) continue;
    const words = found[2].trim().split(" ").filter(Boolean);
    while (words.length && TRAILING.has(words[words.length - 1].toLowerCase())) words.pop();
    const unitOnly = /[%$kKmMbBx×]|percent|million|billion|thousand/.test(number);
    // "38%" says enough; "31" needs its noun ("31 clinics").
    if (!unitOnly && words.length === 0) continue;
    return unitOnly && words.length === 0 ? number : `${number} ${words.join(" ")}`.trim();
  }
  return undefined;
}

function clean(raw: string): string {
  return raw
    .replace(/^(about|around|roughly|nearly|over|under|~)\s*/i, "")
    .replace(/[.,]+$/, "")
    .replace(/\s?percent\b/i, "%")
    .trim();
}

// Short names for the themes on a card: "Influence" rather than "Influence without authority".
const SHORT: Record<string, string> = {
  about_you: "The opener",
  influence: "Influence",
  collaboration: "Cross-team work",
  success: "Success in the role",
  ai_use: "AI at work",
};

export function themeShortLabel(theme: { id: string; label: string }): string {
  return SHORT[theme.id] ?? theme.label.split(" and ")[0];
}

// The themes a story of this type answers, in the order questions are listed.
export function storyThemes(storyType: string | null | undefined): string[] {
  if (!storyType) return [];
  return QUESTION_THEMES.filter((t) => (t.storyTypes as readonly string[]).includes(storyType)).map(
    themeShortLabel,
  );
}
