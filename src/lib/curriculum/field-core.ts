import type { FieldId } from "@/lib/field/fields";
import type { LevelId } from "@/lib/jobs/content";
import type { AreaId, CurriculumTopic } from "./content";

// Core topics for a field (Nov 24): hand-written topics interviewers in that field expect at every
// job, put at the top of each job's curriculum for users in that field, by the job's level. The
// model writes the rest from the posting and is told not to repeat these. General knowledge only,
// never a claim about the user or the company.
//
// Data governance's list comes from Craig's "Data Governance Job Market Analysis" doc (Nov 2026):
// the precision areas its interview guides check, and the questions asked at each level.

type CoreTopic = {
  // Stable, so marks stay put when the curriculum is rewritten.
  id: string;
  area: AreaId;
  name: string;
  basics: string[];
  askedAs: string;
  check: string;
  // The job levels it's for; every level when absent (and when the job has no level).
  levels?: LevelId[];
};

const EARLY: LevelId[] = ["entry", "mid"];
const SENIOR: LevelId[] = ["senior", "principal"];

const DATA_GOVERNANCE: CoreTopic[] = [
  {
    id: "dgcore01",
    area: "role",
    name: "Governance vs. management",
    basics: [
      "Data management builds and runs the systems and pipelines (the roads).",
      "Data governance sets the rules, who decides and who is accountable (the traffic laws).",
      "Governance is more than data quality: decision rights, ownership, policy, stewardship and how it's measured.",
      "Mixing the two up reads as operational thinking rather than running a program.",
    ],
    askedAs: "Early in a screen: \"What's the difference between data governance and data management?\"",
    check: "Can you explain it in two sentences, with an example of each from your own work?",
  },
  {
    id: "dgcore02",
    area: "skills",
    name: "Policy, standard, procedure",
    basics: [
      "A policy states intent: what and why, in principles.",
      "A standard is the measurable rule: how, in a way you can check.",
      "A procedure is the operational steps: who does what, and when.",
      "Common mistakes: a policy written like steps, or a standard nobody can measure.",
    ],
    askedAs: "A technical question, or a case: \"Draft the policy for customer data retention.\"",
    check: "Take one rule you've worked with. Which part is the policy, the standard and the procedure?",
  },
  {
    id: "dgcore03",
    area: "skills",
    name: "Data quality dimensions",
    basics: [
      "The seven: completeness, accuracy, consistency, timeliness, uniqueness, validity, integrity.",
      "Prioritize them by business use: a finance report and a marketing list need different ones.",
      "Quality at rest is profiling stored tables; quality in motion is checks in the pipeline (tools like Great Expectations, Soda or Monte Carlo).",
      "Fix at the root cause, then measure the change.",
    ],
    askedAs: "\"How do you prioritize quality fixes with limited resources?\" or a user-reported issue to walk through.",
    check: "Can you name a quality problem you fixed, which dimension it was, the root cause and what changed?",
  },
  {
    id: "dgcore04",
    area: "tools",
    name: "Catalogs, glossaries and lineage",
    basics: [
      "Common tools: Collibra, Alation, Atlan, Microsoft Purview, Informatica, Databricks Unity Catalog, Snowflake Horizon.",
      "A business glossary term needs an owner, a definition, rules and where it's used.",
      "Lineage shows where data comes from and what depends on it, so you can trace a bad number.",
      "Expect questions on the friction: steward workload, adoption, keeping it current.",
    ],
    askedAs: "A technical round: \"How do you document a glossary term?\" or \"Which catalog have you used, and what was hard?\"",
    check: "Could you walk through setting up one term or one lineage trace, including what went wrong?",
  },
  {
    id: "dgcore05",
    area: "domain",
    name: "AI governance basics",
    basics: [
      "Treated as baseline now: AI governance is often run inside the data governance team.",
      "A model inventory: what models exist, who owns them, what data they use and the risk level.",
      "Explainability, bias and fairness testing, where training data came from, audit trails and human oversight.",
      "It builds on what governance already has: lineage, catalogs, classification and access controls.",
    ],
    askedAs: "\"How would you govern AI here?\" or a case: \"Design an inventory of our AI models.\"",
    check: "What would you put in a model inventory, and who would own keeping it up to date?",
  },
  {
    id: "dgcore06",
    area: "domain",
    name: "Privacy and AI regulation",
    basics: [
      "GDPR (EU) and CCPA (California) for personal data, plus other US state laws.",
      "The EU AI Act: data governance rules for high-risk AI (Article 10), technical documentation (Article 11) and human oversight (Article 14).",
      "The Colorado AI Act takes effect January 1, 2027.",
      "Interviewers like controls that work across rules, not one project per law.",
    ],
    askedAs: "A technical or panel question: \"How would you get us ready for the EU AI Act?\"",
    check: "Can you say what one of these rules asks of the data team, in plain words?",
  },
  {
    id: "dgcore07",
    area: "skills",
    name: "Frameworks: DAMA-DMBOK and DCAM",
    basics: [
      "DAMA-DMBOK is the common reference for data management areas; the CDMP is its certification.",
      "DCAM (EDM Council) is a capability and maturity model, common in financial services.",
      "Use them to structure an answer, then say how it worked in practice.",
      "Certifications help you get in the door; interviewers still want real examples.",
    ],
    askedAs: "A recruiter or conceptual screen: \"Which frameworks have you used?\"",
    check: "Can you name a framework and one way you used it, not just what it says?",
    levels: EARLY,
  },
  {
    id: "dgcore08",
    area: "skills",
    name: "Settling a definition dispute",
    basics: [
      "A classic behavioral question: two data owners disagree on what a metric means.",
      "Show influence without authority: get both into a room, trace the numbers, agree on one definition and an owner.",
      "Write it into the glossary so the fight doesn't come back.",
      "Close with a measured result: the gap closed, the reconciliation stopped.",
    ],
    askedAs: "A behavioral round: \"Tell me about two teams who disagreed on a definition.\"",
    check: "Do you have a story ready for this, with your part and a number?",
    levels: EARLY,
  },
  {
    id: "dgcore09",
    area: "tools",
    name: "SQL for governance checks",
    basics: [
      "Joins across several tables, and spotting a left join that silently multiplies rows.",
      "Profiling: nulls, duplicates, ranges and values that break a rule.",
      "Bronze, silver and gold layers, and where you'd check each rule.",
      "Common for technical or analyst-style seats, especially in financial services.",
    ],
    askedAs: "A hands-on SQL exercise in a technical round.",
    check: "Could you write a query that finds duplicate customers, and explain why a join changed the row count?",
    levels: EARLY,
  },
  {
    id: "dgcore10",
    area: "tools",
    name: "Governance as code",
    basics: [
      "Rules built into pipelines: data contracts, quality checks and access policies in CI/CD.",
      "Often sits with platform engineering under joint data and technology leaders.",
      "Data Mesh: domains own their data, and the center sets the rules they all follow.",
      "Tie each technical choice to the governance result it gives you.",
    ],
    askedAs: "\"How have you built governance into CI/CD?\" or \"How would you govern a Data Mesh?\"",
    check: "Can you describe one control you automated, and what it caught?",
    levels: SENIOR,
  },
  {
    id: "dgcore11",
    area: "role",
    name: "Operating model",
    basics: [
      "Central policy with federated execution in the domains: who decides what, and where.",
      "Roles: owners, stewards, a council, and how issues get escalated.",
      "A maturity scale, and the two or three gaps that matter most this year.",
      "Turning governance into a business habit, not an IT policing project.",
    ],
    askedAs: "\"How would you structure governance for a company this size?\"",
    check: "Could you sketch your operating model on one page, with who owns what?",
    levels: SENIOR,
  },
  {
    id: "dgcore12",
    area: "role",
    name: "Funding and measuring the program",
    basics: [
      "Build and defend a budget: what bad data costs today, and what fixing it is worth.",
      "Metrics tied to leaders' goals, not just counts of rules or terms.",
      "A clear 90-day and first-year plan.",
      "Ask in the interview: who sponsors the program, and is AI governance in it?",
    ],
    askedAs: "A final round with a senior leader: \"How would you justify this budget to the CFO?\"",
    check: "Can you name the business number your program would move, and how you'd show it?",
    levels: ["principal"],
  },
];

const CORE: Partial<Record<FieldId, CoreTopic[]>> = { data_governance: DATA_GOVERNANCE };

export const MAX_CORE_TOPICS = 12;

// The field's core topics for a job at this level, as curriculum topics marked core.
export function coreTopicsFor(
  field: FieldId | null | undefined,
  level: string | null | undefined,
): CurriculumTopic[] {
  const list = (field && CORE[field]) || [];
  return list
    .filter((t) => !t.levels || !level || (t.levels as string[]).includes(level))
    .slice(0, MAX_CORE_TOPICS)
    .map((t) => ({
      id: t.id,
      area: t.area,
      name: t.name,
      quote: "",
      basics: t.basics,
      askedAs: t.askedAs,
      check: t.check,
      core: true,
    }));
}
