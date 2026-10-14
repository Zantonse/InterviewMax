// The numbers checklist: for a role family, the numbers a strong interview story needs and where
// to find each, written by hand. Any other role gets one model call to draft its list (draft.ts).
// These name the numbers only; the values always come from the user.

export type NumberItem = {
  id: string;
  // What to fill in, e.g. "Account executives you supported".
  label: string;
  // What the number shows an interviewer.
  why: string;
  // Where to look it up.
  where: string;
  // Story type ids it usually fits (see src/lib/stories/story-types.ts).
  storyTypes: string[];
};

export type NumbersFamily = {
  // Matches the "Map my role" family id where there is one, so a role map can pick it.
  id: string;
  label: string;
  items: NumberItem[];
};

export const NUMBERS_FAMILIES: NumbersFamily[] = [
  {
    id: "sales_engineering",
    label: "Sales engineering / solutions",
    items: [
      {
        id: "aes_supported",
        label: "Account executives you supported",
        why: "Shows how far your coverage reached and how much the sales team leaned on you.",
        where: "Your team's org chart, your manager, or your recurring AE meetings.",
        storyTypes: ["about_me", "prioritization", "cross_team", "defining_success"],
      },
      {
        id: "accounts",
        label: "Accounts or opportunities you worked at once",
        why: "Gives the scale of your book and makes prioritization stories concrete.",
        where: "CRM opportunities where you're listed as the SE, for a typical quarter.",
        storyTypes: ["about_me", "prioritization", "major_project", "defining_success"],
      },
      {
        id: "avg_deal",
        label: "Average deal size (ARR)",
        why: "Tells the interviewer what kind of deals you can carry.",
        where: "A CRM closed-won report on your deals, or ask your AE or sales ops.",
        storyTypes: ["about_me", "major_project", "defining_success"],
      },
      {
        id: "win_rate",
        label: "Win rate or technical win rate on your deals",
        why: "The clearest proof that your work changes outcomes.",
        where:
          "CRM: closed-won against closed-lost where you were the SE; your SE leader may track it.",
        storyTypes: ["about_me", "major_project", "defining_success"],
      },
      {
        id: "revenue_influenced",
        label: "Pipeline or revenue you influenced",
        why: "Puts a dollar figure on your contribution over a year or a quarter.",
        where: "CRM reports, SE attainment reports, or your performance review.",
        storyTypes: ["about_me", "defining_success", "major_project"],
      },
      {
        id: "largest_deal",
        label: "Your largest deal",
        why: "Anchors your best project story and shows the ceiling of what you've handled.",
        where: "CRM, the deal's order form, or the win announcement.",
        storyTypes: ["major_project", "difficult_stakeholder", "about_me"],
      },
      {
        id: "pocs",
        label: "Proofs of concept you ran, and how many converted",
        why: "Shows technical validation work and how often it won the deal.",
        where: "Your POC tracker, CRM stage history, or your notes from each evaluation.",
        storyTypes: ["major_project", "defining_success", "went_wrong"],
      },
      {
        id: "cycle_time",
        label: "Sales cycle or POC length, before and after a change you made",
        why: "A before-and-after is the strongest kind of result.",
        where: "CRM stage dates on the deals before and after the change.",
        storyTypes: ["prioritization", "major_project", "cross_team", "went_wrong"],
      },
      {
        id: "enablement",
        label: "People you trained, or how many used something you built",
        why: "Shows impact beyond your own deals.",
        where: "Training attendance, demo environment logins, or page views on your playbook.",
        storyTypes: ["cross_team", "defining_success", "about_me"],
      },
    ],
  },
  {
    id: "finance",
    label: "Finance / FP&A",
    items: [
      {
        id: "budget_size",
        label: "Size of the budget you owned or managed",
        why: "Sets the scale of your responsibility in one figure.",
        where: "The annual plan, your cost center reports, or the budget file you maintain.",
        storyTypes: ["about_me", "major_project", "prioritization", "defining_success"],
      },
      {
        id: "forecast_accuracy",
        label: "Forecast accuracy (actual against forecast)",
        why: "The core measure of how well you do the job.",
        where: "Monthly or quarterly variance reports, or the close review deck.",
        storyTypes: ["about_me", "defining_success", "went_wrong"],
      },
      {
        id: "savings",
        label: "Savings or cost reductions you found",
        why: "A dollar result interviewers remember.",
        where:
          "The business case, a savings tracker, or the sign-off email from finance leadership.",
        storyTypes: ["major_project", "difficult_stakeholder", "defining_success"],
      },
      {
        id: "decision_size",
        label: "Size of a decision your analysis supported",
        why: "Shows your work drives real investment calls.",
        where: "Approved business cases, board or leadership decks.",
        storyTypes: ["major_project", "difficult_stakeholder", "about_me"],
      },
      {
        id: "partners",
        label: "Teams or leaders you partnered with",
        why: "Shows your reach as a business partner.",
        where: "Your org chart and your recurring business reviews.",
        storyTypes: ["about_me", "cross_team", "difficult_stakeholder"],
      },
      {
        id: "close_time",
        label: "Days to close the books, before and after a change you made",
        why: "A clean before-and-after on process work.",
        where: "The close calendar or close checklist for the months before and after.",
        storyTypes: ["major_project", "prioritization", "went_wrong", "defining_success"],
      },
      {
        id: "models_reports",
        label: "Models or reports you owned, and how many people used them",
        why: "Shows what the business relied on you for.",
        where: "Your shared drive, the report distribution list, or BI usage stats.",
        storyTypes: ["about_me", "defining_success", "cross_team"],
      },
      {
        id: "variance",
        label: "The largest variance you caught or explained",
        why: "Makes a story about judgment or a miss concrete.",
        where: "Variance commentary in past monthly reports.",
        storyTypes: ["went_wrong", "defining_success", "prioritization"],
      },
    ],
  },
  {
    id: "data_governance",
    label: "Data governance",
    items: [
      {
        id: "domains",
        label: "Data domains, systems or business units you covered",
        why: "Sets the scope of your governance work.",
        where:
          "The governance charter, your steward assignments, or the data catalog's domain list.",
        storyTypes: ["about_me", "defining_success", "prioritization"],
      },
      {
        id: "assets_documented",
        label: "Tables, datasets or glossary terms you documented",
        why: "Puts a size on catalog and metadata work.",
        where: "Your catalog's stats page (Collibra, Alation, Purview…) or the business glossary.",
        storyTypes: ["major_project", "defining_success", "about_me"],
      },
      {
        id: "dq_rules",
        label: "Data quality rules you wrote or monitored",
        why: "Shows hands-on ownership of data quality.",
        where: "The rule list in your data quality tool, filtered to your domains.",
        storyTypes: ["major_project", "defining_success"],
      },
      {
        id: "quality_change",
        label: "Data quality score or error rate, before and after your work",
        why: "The strongest result in governance: a measurable improvement.",
        where: "Your data quality dashboard, or the issue log for the months before and after.",
        storyTypes: ["major_project", "went_wrong", "defining_success"],
      },
      {
        id: "issues",
        label: "Data issues you triaged or resolved",
        why: "Shows volume and that people brought problems to you.",
        where: "Your ticket queue (Jira, ServiceNow) filtered to you, for a typical month or year.",
        storyTypes: ["about_me", "prioritization", "difficult_stakeholder"],
      },
      {
        id: "stakeholders",
        label: "Teams or data owners you worked with",
        why: "Governance is cross-team work; this shows how wide yours was.",
        where: "The steward or owner list, a RACI, or your recurring council meetings.",
        storyTypes: ["cross_team", "difficult_stakeholder", "about_me"],
      },
      {
        id: "users",
        label: "People who used what you built (catalog, reports, standards)",
        why: "Shows adoption, not just delivery.",
        where: "Usage analytics in the catalog or BI tool, or the distribution list.",
        storyTypes: ["defining_success", "major_project", "cross_team"],
      },
      {
        id: "audits",
        label: "Audits or regulatory reviews you supported, and their findings",
        why: "Ties your work to risk and compliance outcomes.",
        where: "Audit reports, the compliance tracker, or the findings log.",
        storyTypes: ["went_wrong", "major_project", "prioritization"],
      },
      {
        id: "time_saved",
        label: "Time saved finding or fixing data",
        why: "Turns governance into a business result.",
        where: "Ticket times before and after, or a user survey. Say if it's an estimate.",
        storyTypes: ["major_project", "defining_success", "cross_team"],
      },
    ],
  },
];

export function getNumbersFamily(id: string | null | undefined): NumbersFamily | undefined {
  return NUMBERS_FAMILIES.find((f) => f.id === id);
}

// A first guess at the user's family from words they already gave (a role title, their About me
// answer, target job titles), checked in order. The user confirms it before anything is built.
const FAMILY_WORDS: { id: string; re: RegExp }[] = [
  {
    id: "sales_engineering",
    re: /\b(sales engineer|solutions? (engineer|consultant|architect)|pre-?sales|technical sales|sales engineering)/i,
  },
  {
    id: "data_governance",
    re: /\b(data governance|data steward|data quality|metadata|master data|data catalog)/i,
  },
  {
    id: "finance",
    re: /\b(fp&a|financial (analyst|planning)|finance|controller|accountant|accounting|treasury)\b/i,
  },
];

export function guessFamily(texts: (string | null | undefined)[]): string | undefined {
  for (const text of texts) {
    if (!text) continue;
    const hit = FAMILY_WORDS.find((f) => f.re.test(text));
    if (hit) return hit.id;
  }
  return undefined;
}
