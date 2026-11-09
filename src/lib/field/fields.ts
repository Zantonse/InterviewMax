// "Your field": the kind of work the user does, picked in Settings (Nov 4: a tester's friend in
// product design found the app spoke sales engineering). It swaps the builder's hand-written
// examples and memory joggers for ones from their field, pre-picks their role on Numbers and Map
// my role, and adds one line to the coaching model steps (see promptLine). It never changes facts,
// scores or which gaps get flagged. Likely questions and the curriculum already read each job's
// posting; the field line only steers their wording.
//
// Plain data, safe to import in client components.

import type { Step } from "@/lib/ai/config";

export const FIELD_IDS = [
  "generic",
  "sales_engineering",
  "data_governance",
  "product_design",
  "product_management",
  "software_engineering",
  "sales",
  "customer_success",
  "finance",
  "other",
] as const;

export type FieldId = (typeof FIELD_IDS)[number];

// What the app uses: the field id and, for "other", the name the user typed.
export type UserField = { id: FieldId; name: string | null; guessed: boolean };

export const MAX_FIELD_NAME_LENGTH = 60;

export type FieldDef = {
  id: FieldId;
  label: string;
  // Shown under the dropdown so people recognise it.
  blurb: string;
  // For the model: the situations this field's stories are made of.
  situations: string;
  // The hand-written lists to pre-pick on Map my role and Numbers, where one exists.
  roleFamily?: string;
  numbersFamily?: string;
  // Builder "Show me a good answer" examples that differ from the defaults (src/lib/stories/help.ts),
  // keyed like that file.
  examples?: Partial<Record<string, string>>;
  // Memory joggers that replace a story type's defaults (src/lib/stories/story-types.ts).
  joggers?: Partial<Record<string, readonly string[]>>;
};

// Intro examples for anyone without a field-specific set: no sales words.
const NEUTRAL_INTRO: Partial<Record<string, string>> = {
  present:
    "\"I'm an operations lead at a logistics company, running a team of 6 that keeps our 3 warehouses' systems working.\"",
  path:
    "\"I started on the warehouse floor, moved into the systems team after I kept fixing the scanners myself, and I've led it for 2 years.\"",
  highlight:
    "\"I rebuilt how we schedule shifts; overtime dropped by about a third in the first quarter (my estimate).\"",
  strengths:
    "\"People come to me when a process is broken and nobody owns it. Last quarter that was about 5 fixes.\"",
  next:
    "\"I want a role with more say in how the systems get designed, not just keeping them running.\"",
};

export const FIELDS: FieldDef[] = [
  {
    id: "generic",
    label: "General / not sure",
    blurb: "Plain examples that fit most jobs.",
    situations: "",
    examples: NEUTRAL_INTRO,
  },
  {
    id: "sales_engineering",
    label: "Solutions / sales engineering",
    blurb: "Discovery, demos, proofs of concept and technical wins.",
    situations:
      "technical discovery, demos, proofs of concept, solution design, RFPs and security reviews, working with account executives on deals",
    roleFamily: "sales_engineering",
    numbersFamily: "sales_engineering",
  },
  {
    id: "data_governance",
    label: "Data governance",
    blurb: "Data quality, catalogs, lineage, stewardship and policy.",
    situations:
      "data quality rules and issues, catalogs and glossaries, lineage, stewardship, data policy and access, audits",
    roleFamily: "data_governance",
    numbersFamily: "data_governance",
    examples: {
      telling:
        "Rough notes are fine, like: \"Last year finance and sales reported different revenue numbers every month. I was the data steward for sales data. I traced both reports back, found they used two customer tables, and got both teams to agree on one definition. Took about 6 weeks. The monthly gap went away and the CFO stopped asking for a reconciliation.\"",
      result:
        "\"Open data quality issues went from about 140 to 30 in a quarter, and the audit closed with no findings on our domain.\"",
      obstacle:
        "\"The hard part was that the sales ops lead owned the old table and saw the change as extra work, so he kept pushing the cutover back.\"",
      present:
        "\"I'm a data governance lead at a regional bank, owning quality and definitions for our customer and loan data.\"",
      path:
        "\"I started as a reporting analyst, kept getting pulled into 'why don't these numbers match', and moved into governance 3 years ago.\"",
      highlight:
        "\"I set up our first business glossary; about 200 people use it now, and definition questions to my team dropped by half (my estimate).\"",
      strengths:
        "\"People come to me when two reports disagree. I can usually find the reason in a day.\"",
      next:
        "\"I want to lead governance across a whole company, not just one domain.\"",
    },
    joggers: {
      major_project: [
        "A data quality problem you fixed at the root",
        "A catalog, glossary or standard you rolled out",
        "An audit or regulator request you got through",
        "Getting teams to agree on one definition",
      ],
      went_wrong: [
        "A bad number that reached a report or a leader",
        "A rule or standard nobody followed",
        "An audit finding",
        "A call you got wrong",
      ],
    },
  },
  {
    id: "product_design",
    label: "Product design / UX",
    blurb: "Research, design, prototyping and shipping with product and engineering.",
    situations:
      "user research and usability tests, design critiques, prototypes, design systems, trade-offs with product managers and engineers, shipped designs and the metrics they moved",
    roleFamily: "product_design",
    numbersFamily: "product_design",
    examples: {
      telling:
        "Rough notes are fine, like: \"Last spring our checkout had a big drop-off on mobile. I was the designer on the payments team. I watched 6 usability sessions, saw people missing the promo code field, and redesigned the flow with our PM and 2 engineers. Took about 5 weeks. Mobile checkout completion went up about 8%. Lesson: watch real people before redesigning.\"",
      situation:
        "\"We were 4 weeks from launch and research showed new users couldn't find the main action. If we shipped as it was, onboarding would miss its target.\"",
      context:
        "\"I'd been the only designer on the team for about a year, working with 1 PM and 5 engineers, when the redesign was approved.\"",
      ownership:
        "\"Engineering built it, but the design was mine: I ran the research, picked the direction, and made the call on what to cut.\"",
      obstacle:
        "\"The hard part was that the PM wanted to keep the old layout because sales had promised it to a customer, and the engineers were already halfway through building it.\"",
      decision:
        "\"I could polish all 3 screens or ship the 1 that mattered with the others unchanged. I shipped the one, because the drop-off was all on that screen, and planned a test to check.\"",
      result:
        "\"Task success in usability tests went from 3 of 8 people to 7 of 8, and sign-up completion rose about 12% after launch.\"",
      reflection:
        "\"I learned to bring engineers into the first sketches. Next time I'd do that before the critique, not after.\"",
      detail:
        "\"In the last test, a user said 'oh, that was easy' out loud, and our PM wrote it on the whiteboard.\"",
      present:
        "\"I'm a product designer at a fintech startup, owning the mobile app's onboarding and payments flows.\"",
      path:
        "\"I started in graphic design, moved into UX after redesigning our company's internal tools, and I've been a product designer for 4 years.\"",
      highlight:
        "\"I redesigned our onboarding; completion went from about 60% to 78%, and it's still the flow new hires study.\"",
      strengths:
        "\"People come to me when a flow tests badly and nobody knows why. I'm good at finding the one confusing step.\"",
      next:
        "\"I want to work on a product where research drives the roadmap, and grow toward leading a design area.\"",
    },
    joggers: {
      major_project: [
        "A design you shipped that moved a metric",
        "A redesign you led start to finish",
        "Research that changed what got built",
        "A design system or pattern others now use",
      ],
      difficult_stakeholder: [
        "A PM or leader who wanted a different design",
        "Engineers who pushed back on feasibility",
        "Feedback in a critique you disagreed with",
        "A person who disagreed with your plan",
      ],
      went_wrong: [
        "A design that tested badly or launched badly",
        "A deadline that forced you to cut scope",
        "Research that proved you wrong",
        "A call you got wrong",
      ],
      defining_success: [
        "A design where you set the success metric",
        "A launch that hit its target",
        "Work your manager held up as an example",
        "A time you changed how success was measured",
      ],
    },
  },
  {
    id: "product_management",
    label: "Product management",
    blurb: "Discovery, roadmaps, launches and working across teams.",
    situations:
      "customer discovery, roadmap and prioritization calls, launches, working with engineering and design, metrics and experiments",
    roleFamily: "product_management",
    examples: {
      present:
        "\"I'm a product manager at a B2B software company, owning the reporting product used by about 2,000 customers.\"",
      path:
        "\"I started in customer support, moved into product after writing most of our feature requests, and I've been a PM for 3 years.\"",
      highlight:
        "\"I cut our roadmap from 12 projects to 4; we shipped all 4 that year and the main one doubled weekly use (my estimate).\"",
      strengths:
        "\"People come to me to turn a messy customer problem into something engineering can build.\"",
      next:
        "\"I want to own a bigger area and work closer to the strategy, not just the backlog.\"",
    },
    joggers: {
      major_project: [
        "A launch you owned",
        "A feature that moved a key metric",
        "Discovery that changed the roadmap",
        "A project that was behind when you joined",
      ],
      went_wrong: [
        "A launch that missed its target",
        "A feature nobody used",
        "A call you got wrong",
        "A deadline that slipped",
      ],
    },
  },
  {
    id: "software_engineering",
    label: "Software engineering",
    blurb: "Building, designing and running software.",
    situations:
      "features shipped, system design decisions, incidents and on-call, code review, migrations, technical trade-offs",
    roleFamily: "software_engineering",
    examples: {
      present:
        "\"I'm a senior backend engineer at a payments company, on the team that runs our card processing services.\"",
      path:
        "\"I started in QA, moved into engineering after automating our test suite, and I've been on the payments team for 4 years.\"",
      highlight:
        "\"I led our move off the old database; checkout errors dropped about 90% and on-call pages went from weekly to monthly.\"",
      strengths:
        "\"People come to me when an incident has no obvious cause. I'm good at reading logs nobody else wants to.\"",
      next:
        "\"I want to grow into a tech lead role, owning the design of a whole system.\"",
    },
    joggers: {
      major_project: [
        "A system or feature you designed and shipped",
        "A migration you led",
        "A performance or reliability win",
        "A project that was behind when you joined",
      ],
      went_wrong: [
        "An incident or outage",
        "A release that broke",
        "A design you had to redo",
        "A call you got wrong",
      ],
    },
  },
  {
    id: "sales",
    label: "Sales / account executive",
    blurb: "Prospecting, running deals and hitting quota.",
    situations: "prospecting, running deals, negotiations, quota and pipeline, account growth",
    roleFamily: "sales",
    examples: {
      present:
        "\"I'm an account executive at a security software company, selling to mid-market companies in the Midwest.\"",
      path:
        "\"I started as an SDR, moved into a closing role after finishing top of my class, and I've carried a quota for 3 years.\"",
      highlight:
        "\"I finished last year at 128% of quota, second out of 14 reps.\"",
      strengths:
        "\"People come to me when a deal is stuck in procurement. I'm good at finding who actually signs.\"",
      next: "\"I want to move up to enterprise deals with longer cycles.\"",
    },
  },
  {
    id: "customer_success",
    label: "Customer success / account management",
    blurb: "Onboarding, adoption, renewals and saving accounts.",
    situations: "onboarding, adoption, renewals and expansion, at-risk accounts, escalations",
    roleFamily: "customer_success",
    examples: {
      present:
        "\"I'm a customer success manager at an HR software company, looking after 40 accounts worth about $3M a year.\"",
      path:
        "\"I started in support, moved into customer success after customers kept asking for me by name, and I've been a CSM for 3 years.\"",
      highlight:
        "\"My book renewed at 96% last year, the highest on a team of 8.\"",
      strengths:
        "\"People come to me when an account is about to churn. I'm good at finding what they really need.\"",
      next: "\"I want to lead a team of CSMs, or take on our largest accounts.\"",
    },
  },
  {
    id: "finance",
    label: "Finance / FP&A",
    blurb: "Budgets, forecasts, models and decisions.",
    situations:
      "budgets and forecasts, financial models, month-end close, cost savings, decision support for leaders",
    numbersFamily: "finance",
    examples: {
      present:
        "\"I'm a senior financial analyst at a healthcare company, owning the forecast for our $200M operations budget.\"",
      path:
        "\"I started in accounting, moved into FP&A after building our first rolling forecast, and I've been there 3 years.\"",
      highlight:
        "\"I rebuilt our forecast model; the miss went from about 8% to under 2%.\"",
      strengths:
        "\"People come to me to turn a leader's question into a model they can decide from.\"",
      next: "\"I want to partner with a business unit leader directly, not just report numbers.\"",
    },
    joggers: {
      major_project: [
        "A model or forecast you built",
        "A cost saving you found",
        "A decision your analysis changed",
        "A close or process you sped up",
      ],
    },
  },
  {
    id: "other",
    label: "Something else (type it)",
    blurb: "Name your field and the coach uses it.",
    situations: "",
    examples: NEUTRAL_INTRO,
  },
];

export function getField(id: string | null | undefined): FieldDef | undefined {
  return FIELDS.find((f) => f.id === id);
}

export function parseFieldId(value: unknown): FieldId | null {
  return typeof value === "string" && (FIELD_IDS as readonly string[]).includes(value)
    ? (value as FieldId)
    : null;
}

export function fieldLabel(field: UserField): string {
  if (field.id === "other") return field.name?.trim() || "Something else";
  return getField(field.id)?.label ?? "General";
}

// The builder's "Show me a good answer" example for this field, where it has its own.
export function fieldExample(fieldId: FieldId | null | undefined, key: string): string | undefined {
  return getField(fieldId)?.examples?.[key];
}

export function fieldJoggers(
  fieldId: FieldId | null | undefined,
  storyTypeId: string | null | undefined,
): readonly string[] | undefined {
  return storyTypeId ? getField(fieldId)?.joggers?.[storyTypeId] : undefined;
}

// A first guess from words they already gave (target job titles, a role title), in order. Shown as
// a guess in Settings until they save one.
const FIELD_WORDS: { id: FieldId; re: RegExp }[] = [
  {
    id: "sales_engineering",
    re: /\b(sales engineer|solutions? (engineer|consultant|architect)|pre-?sales|technical sales|sales engineering)/i,
  },
  {
    id: "product_design",
    re: /\b(product design(er)?|ux|ui\/ux|user experience|interaction design(er)?|visual design(er)?|design lead|designer)\b/i,
  },
  {
    id: "data_governance",
    re: /\b(data governance|data steward|data quality|metadata|master data|data catalog)/i,
  },
  { id: "product_management", re: /\b(product manager|product management|product owner|\bpm\b)/i },
  {
    id: "software_engineering",
    re: /\b(software engineer|software developer|developer|backend|frontend|full[- ]stack|sre|site reliability)\b/i,
  },
  {
    id: "customer_success",
    re: /\b(customer success|account manager|csm|client success)\b/i,
  },
  { id: "sales", re: /\b(account executive|sales (rep|representative|manager)|\bae\b|business development)\b/i },
  {
    id: "finance",
    re: /\b(fp&a|financial (analyst|planning)|finance|controller|accountant|accounting|treasury)\b/i,
  },
];

export function guessField(texts: (string | null | undefined)[]): FieldId | undefined {
  for (const text of texts) {
    if (!text) continue;
    const hit = FIELD_WORDS.find((f) => f.re.test(text));
    if (hit) return hit.id;
  }
  return undefined;
}

// The model steps that coach, write or word things for the user: they get one line naming the
// field. Grading is left out on purpose, as with coaching style: scores must not move with it.
export const FIELD_STEPS: readonly Step[] = [
  "storyProbe",
  "storyWrite",
  "storyTailor",
  "storyTell",
  "storyAnalyze",
  "storyFind",
  "toughAnswer",
  "likelyQuestions",
  "askQuestions",
  "jobCurriculum",
  "practiceProbe",
  "practiceFeedback",
  "casePractice",
  "profileSummary",
  "storyQuestions",
  "storyExec",
];

// The line added to a field step's system prompt, or "" when it adds nothing (general).
export function fieldPromptLine(field: UserField | null): string {
  if (!field || field.id === "generic") return "";
  const def = getField(field.id);
  const name = fieldLabel(field);
  if (field.id === "other" && !field.name?.trim()) return "";
  const situations = def?.situations ? ` (${def.situations})` : "";
  return `The user's field: ${name}${situations}. When you give an example, word a question or pick an angle, use situations from this field. Any examples elsewhere in these instructions may come from other fields; they only show the shape. This never adds facts: use only what the user gave.`;
}
