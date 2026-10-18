// Coaching guidelines (admin panel): Craig's own principles and checklists for coaching, as
// sections of plain text. The body is shown as written, with "- " lines as bullets and "- [ ] "
// lines as checklist items. Kept apart from the database code so the format is tested on its own.

export const MAX_TITLE_LENGTH = 120;
export const MAX_BODY_LENGTH = 20_000;

export type Guideline = {
  id: string;
  title: string;
  body: string;
  position: number;
  updatedBy: string | null;
  updatedAt: string;
};

export type GuidelineBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "checklist"; items: string[] };

const CHECK_RE = /^\s*-\s*\[[ xX]?\]\s+(.*)$/;
const BULLET_RE = /^\s*[-*•]\s+(.*)$/;

// Splits a section's text into paragraphs, bullet lists and checklists, keeping their order.
export function guidelineBlocks(body: string): GuidelineBlock[] {
  const blocks: GuidelineBlock[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const last = blocks.at(-1);
    const check = line.match(CHECK_RE);
    const bullet = check ? null : line.match(BULLET_RE);
    if (check) {
      if (last?.kind === "checklist") last.items.push(check[1]);
      else blocks.push({ kind: "checklist", items: [check[1]] });
    } else if (bullet) {
      if (last?.kind === "bullets") last.items.push(bullet[1]);
      else blocks.push({ kind: "bullets", items: [bullet[1]] });
    } else if (line.trim()) {
      if (last?.kind === "paragraph") last.text = last.text ? `${last.text} ${line.trim()}` : line.trim();
      else blocks.push({ kind: "paragraph", text: line.trim() });
    } else if (last?.kind === "paragraph") {
      // A blank line ends a paragraph.
      blocks.push({ kind: "paragraph", text: "" });
    }
  }
  return blocks.filter((b) => b.kind !== "paragraph" || b.text);
}

// Cleans what the admin typed. Returns an error to show, or the values to save.
export function checkGuideline(input: {
  title: unknown;
  body: unknown;
}): { error: string } | { title: string; body: string } {
  const title = String(input.title ?? "").trim();
  const body = String(input.body ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!title) return { error: "Give the section a title." };
  if (title.length > MAX_TITLE_LENGTH) {
    return { error: `Keep the title under ${MAX_TITLE_LENGTH} characters.` };
  }
  if (body.length > MAX_BODY_LENGTH) {
    return {
      error: `Keep a section under ${MAX_BODY_LENGTH.toLocaleString("en-US")} characters.`,
    };
  }
  return { title, body };
}
