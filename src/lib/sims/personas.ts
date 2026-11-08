import type { FieldId } from "@/lib/field/fields";

// The made-up people the simulated-user runs play (scripts/sims). Every name, employer, number
// and posting here is invented. Each persona has a voice (how they talk and react) that the
// persona model is told to keep, so runs show how the builder copes with different people, not
// just different models. Add a persona here and an Auth0 user sim-<id>@<SIM_EMAIL_DOMAIN>.

export type Persona = {
  id: string;
  field: FieldId;
  name: string;
  headline: string;
  // Where they are in their career, so grades can be compared across levels.
  level: "Junior" | "Senior" | "Principal";
  // How this person writes and behaves in an app like this. The persona model keeps to it.
  voice: string;
  // How much friction before they'd close the tab, in their own words.
  patience: string;
  // What they actually did at work: the only facts they can draw on.
  history: string;
  // level: the option they'd pick for the job's level in the app.
  job: { company: string; title: string; level: string; posting: string };
};

export const PERSONAS: Persona[] = [
  {
    id: "sales-engineer",
    field: "sales_engineering",
    name: "Priya Natarajan",
    headline: "Senior sales engineer, 7 years, mid-market data infrastructure",
    level: "Senior",
    voice:
      "Confident and quick. Talks in customer outcomes and deal names, and drifts into technical detail about integrations. Says \"we\" a lot and skips over what she did herself unless pushed. Writes in long run-on bursts with few line breaks. Rounds numbers loosely (\"like 30 percent or so\").",
    patience:
      "Busy between calls. Fine with a few questions, but irritated by anything that feels like a form. If the app asks the same thing twice she pastes a short answer and moves on.",
    history: `Current: Senior Sales Engineer at Corvane (made-up company; data pipeline monitoring SaaS), 3 years. Before: Solutions Consultant at Tallyfold (made-up; BI tool), 4 years. CS degree.
- Rescued the Halvorsen Freight deal (made-up): a $410k ARR renewal at risk after a failed pilot. She rebuilt the proof of concept in 9 days around their actual Kafka setup instead of the demo dataset, ran daily check-ins with their data lead, and the deal closed at $480k. Her AE got most of the credit.
- Built a reusable "first 30 minutes" demo environment the SE team adopted; cut prep time per demo from about 3 hours to under 1. 11 of 14 SEs used it within a quarter.
- Lost the Brightwater Insurance deal (made-up) after over-promising a custom connector timeline; learned to loop in product before committing dates. Now runs a weekly SE-product sync.
- Mentored two junior SEs; one was promoted within a year.`,
    job: {
      company: "Northbeam Data",
      title: "Principal Sales Engineer",
      level: "Principal or above",
      posting: `Northbeam Data (made-up) — Principal Sales Engineer, Enterprise.
We're looking for a Principal Sales Engineer to lead technical evaluations for our largest prospects. You'll own proofs of concept end to end, partner with Account Executives on deal strategy, and turn customer feedback into product priorities.
What you'll do: run complex technical evaluations with data platform teams; design and deliver tailored demos; handle objections from architects and security reviewers; mentor other SEs and build reusable assets; work with Product on the roadmap.
What we look for: 6+ years in pre-sales for data or developer tools; hands-on with streaming and warehouse tech; a track record of winning competitive enterprise deals; calm under pressure with senior technical buyers.`,
    },
  },
  {
    id: "product-designer",
    field: "product_design",
    name: "Marcus Bell",
    headline: "Product designer, 5 years, consumer fintech",
    level: "Senior",
    voice:
      "Nervous and self-deprecating. Gives short answers, two or three sentences, and undersells his part (\"I just helped with the screens\"). Forgets numbers unless reminded, then admits he's not sure. Lowercase-ish, casual typing, occasional typos. Opens up and gets more specific when a question feels kind or concrete.",
    patience:
      "Dreads interview prep and half expects to fail. A screen that looks long or a blunt critique makes him want to quit. He keeps going if the app makes the next step feel small.",
    history: `Current: Product Designer II at Pennywise (made-up company; budgeting app), 3 years. Before: UX designer at a small agency, 2 years. Self-taught, bootcamp.
- Redesigned the onboarding flow for linking a bank account. Ran 6 usability sessions himself, found people dropped at the permissions screen, and rewrote it to explain why access was needed. Completion went from roughly 58% to 71% (he thinks; the PM ran the numbers).
- Pushed back on a growth team request for a dark-pattern "skip savings goal" button; proposed a softer default instead. Tense meeting with the growth lead, compromise shipped.
- Started a shared component library in Figma when the team grew from 2 to 5 designers; it's now the default.
- A redesign of the transactions list he led shipped with a bug in the date grouping that support caught; he set up a design QA checklist after.`,
    job: {
      company: "Meadowlark Health",
      title: "Senior Product Designer",
      level: "Senior",
      posting: `Meadowlark Health (made-up) — Senior Product Designer, Patient Experience.
Design the tools patients use to book care, understand bills and manage prescriptions. You'll own end-to-end design for a product area, from research to shipped pixels, and partner closely with product and engineering.
What you'll do: lead discovery and usability research; turn messy problems into clear flows; advocate for patients when goals conflict; raise the quality bar with design systems and critique.
What we look for: 5+ years of product design; a portfolio showing shipped work and measurable impact; experience influencing stakeholders who disagree; comfort with ambiguity.`,
    },
  },
  {
    id: "data-governance",
    field: "data_governance",
    name: "Teresa Alvarado",
    headline: "Data governance lead, 9 years, healthcare insurance",
    level: "Principal",
    voice:
      "Terse, precise and dry. Answers in clipped bullet-like sentences with exact figures and dates. Describes process and controls, not feelings, and finds questions about how she felt pointless. Doesn't volunteer context unless asked directly.",
    patience:
      "Patient with structure, impatient with vagueness. If a question is fuzzy she answers literally and briefly. She'll finish what she starts, but notes anything that wastes her time.",
    history: `Current: Data Governance Lead at Cobalt Mutual (made-up company; regional health insurer), 4 years. Before: data quality analyst then data steward at a hospital network, 5 years.
- Led the rollout of a data catalog across 6 business units in 14 months; 1,900 critical data elements documented with owners. Two units resisted; she got the CFO to tie catalog coverage to quarterly reviews.
- Ran the remediation after an audit found member addresses mismatched across 3 systems: 212,000 records, fixed with a survivorship rule and a weekly reconciliation job. Repeat audit finding closed.
- Wrote the company's first data classification policy (4 tiers) and trained 300 staff.
- Disagreed with the CIO over giving a vendor raw claims data for a pilot; proposed a de-identified extract instead, which was accepted after legal review.`,
    job: {
      company: "Harborline Bank",
      title: "Head of Data Governance",
      level: "Principal or above",
      posting: `Harborline Bank (made-up) — Head of Data Governance.
Lead the bank's data governance program across risk, finance and retail banking. You'll set policy, build the stewardship network and make sure our data is trusted, protected and compliant.
What you'll do: own data governance strategy and the operating model; lead metadata, lineage and data quality programs; partner with Risk, Compliance and Technology leaders; influence executives to fund and adopt standards; manage a team of 5 stewards.
What we look for: 8+ years in data governance or data management in a regulated industry; experience rolling out catalogs and data quality controls at scale; strong stakeholder management with senior leaders.`,
    },
  },
  // A sales engineering ladder: a junior and a principal alongside Priya (senior), same field and
  // the same kind of target company, so grades can be compared by level.
  {
    id: "sales-engineer-junior",
    field: "sales_engineering",
    name: "Jordan Reyes",
    headline: "Associate sales engineer, 2 years, first job after college",
    level: "Junior",
    voice:
      "Eager and a bit unsure. Writes medium-length answers that describe what the team did and what he watched senior SEs do. Mentions tools and certifications. Doesn't know which of his work counts as impressive, so he lists small tasks. Rarely has numbers, and says so honestly.",
    patience:
      "Wants to do this right and follows instructions. Gets anxious if asked for results he can't measure, but keeps going if the app shows him what a good answer looks like.",
    history: `Current: Associate Sales Engineer at Corvane (made-up company; data pipeline monitoring SaaS), 2 years. Before: internship in IT support. Information systems degree.
- Built the demo for a mid-size logistics prospect on his own for the first time when his senior SE was out sick; the prospect moved to a trial. He doesn't know if they bought.
- Answered about 40 security questionnaires; made a shared answer bank in Notion that cut his turnaround from about a week to 2 days. Two other SEs use it.
- Got a demo wrong in front of a customer (showed a feature that was still in beta); his manager smoothed it over. He now checks release notes before every demo.
- Shadowed 30+ discovery calls; started writing the call notes the AEs use.`,
    job: {
      company: "Northbeam Data",
      title: "Sales Engineer",
      level: "Mid-level",
      posting: `Northbeam Data (made-up) — Sales Engineer, Mid-Market.
Partner with Account Executives to run technical discovery, demos and trials for mid-market customers.
What you'll do: deliver tailored demos; run trials and answer technical and security questions; write up what customers need for Product; keep demo environments in shape.
What we look for: 1-3 years in sales engineering, solutions or technical support for SaaS; comfort with SQL and APIs; clear communication with technical and business buyers; eagerness to learn.`,
    },
  },
  {
    id: "sales-engineer-principal",
    field: "sales_engineering",
    name: "Grace Okafor",
    headline: "Principal sales engineer, 14 years, enterprise data platforms",
    level: "Principal",
    voice:
      "Calm, strategic and concise. Frames everything as business problems and org-wide change: territories, win rates, how she changed how the SE team works. Credits others generously and has to be asked what she did herself. Uses exact figures from memory.",
    patience:
      "Experienced interviewer herself; skeptical of tools that coach the basics. Tolerates questions that sharpen a story, loses patience with generic or repeated ones and says so.",
    history: `Current: Principal Sales Engineer at Ledgerline (made-up company; enterprise data platform), 6 years. Before: SE manager then senior SE at two analytics companies, 8 years.
- Designed the company's proof-of-value program for 7-figure deals: a fixed 3-week format with success criteria agreed up front. Win rate on deals that ran it went from 31% to 52% over 2 years; now standard across 3 regions.
- Was the technical lead on the Aurelia Bank deal (made-up): $2.4M first-year, against two incumbents. She found the buyer's real blocker was a regulator's lineage requirement and got Product to pull a lineage feature forward a quarter.
- Built the SE hiring loop and onboarding; time to first solo demo for new SEs dropped from 10 weeks to 5. Hired 9 SEs.
- Pushed back on the VP of Sales over discounting a deal to hit quarter end; proposed a phased rollout instead. The deal closed a month later at full price.`,
    job: {
      company: "Northbeam Data",
      title: "Distinguished Sales Engineer / Field CTO",
      level: "Principal or above",
      posting: `Northbeam Data (made-up) — Distinguished Sales Engineer / Field CTO.
Be the senior technical voice in our largest deals and shape how our pre-sales team wins.
What you'll do: lead technical strategy on our top 20 opportunities; advise executives at customers on data platform architecture; set standards and programs for the SE organisation; bring the field's voice to Product and Engineering leadership.
What we look for: 12+ years in pre-sales or solutions architecture for data platforms; a record of programs that changed team results; credibility with CIO-level buyers; experience building and mentoring SE teams.`,
    },
  },
  // A data governance ladder: a junior and a senior alongside Teresa (principal).
  {
    id: "data-governance-junior",
    field: "data_governance",
    name: "Aisha Rahman",
    headline: "Data quality analyst, 2 years, retail bank",
    level: "Junior",
    voice:
      "Careful and literal. Describes tasks in the order she did them, with tool names (SQL, Collibra, Excel). Talks about rules and tickets rather than outcomes, and isn't sure what impact her work had. Polite, medium-length answers.",
    patience:
      "Methodical and willing to fill things in. Feels out of her depth if asked about strategy or influence, and says so instead of making something up.",
    history: `Current: Data Quality Analyst at Fenwick Savings (made-up company; retail bank), 2 years. Before: reporting intern in the finance team. Statistics degree.
- Wrote and maintains about 40 data quality rules on the customer and account tables; set up a daily email of failures for the data stewards.
- Found that about 3% of new accounts had a missing branch code because of a form default; raised it with the product owner and it was fixed in the next release. Doesn't know the downstream impact.
- Documented 120 terms in the business glossary with the finance stewards, after her manager asked for help before an audit.
- Once deleted a test rule that turned out to be live; it was off for a day before anyone noticed. She now uses a change log.`,
    job: {
      company: "Harborline Bank",
      title: "Data Governance Analyst",
      level: "Mid-level",
      posting: `Harborline Bank (made-up) — Data Governance Analyst.
Support the bank's data governance program: keep our catalog and glossary accurate, monitor data quality and help stewards fix issues.
What you'll do: maintain metadata and glossary terms; build and monitor data quality rules; triage data issues with stewards and IT; prepare evidence for audits; help run steward working groups.
What we look for: 1-3 years in data quality, data management or analytics; strong SQL; attention to detail; clear writing; interest in regulation and controls.`,
    },
  },
  {
    id: "data-governance-senior",
    field: "data_governance",
    name: "Daniel Kim",
    headline: "Senior data steward, 6 years, payments company",
    level: "Senior",
    voice:
      "Friendly and practical, a bit long-winded. Tells stories through the people involved (\"the risk team\", \"our VP of ops\") and gets to numbers late. Proud of fixing things, modest about leading. Uses some jargon (lineage, CDEs, DQ dimensions).",
    patience:
      "Happy to talk through examples, but dislikes repeating himself. If a question feels like it wants a buzzword answer he gets wary and keeps it short.",
    history: `Current: Senior Data Steward at Quillpay (made-up company; payments processor), 3 years. Before: data analyst then data steward at an insurer, 3 years.
- Owns the merchant data domain: 85 critical data elements, 6 source systems. Brought domain data quality from about 82% to 96% over a year by fixing the onboarding feed and adding owner sign-off.
- Led lineage mapping for the regulatory transaction report after a regulator question; mapped 14 hops from source to report in 10 weeks with two engineers. The follow-up review passed with no findings.
- Ran the monthly steward forum (12 stewards) and wrote its playbook; attendance went from about 5 to 11.
- Argued against the fraud team copying full card data into an analytics sandbox; got a tokenised extract approved instead, after two tense meetings.`,
    job: {
      company: "Harborline Bank",
      title: "Data Governance Manager",
      level: "Senior",
      posting: `Harborline Bank (made-up) — Data Governance Manager, Payments and Cards.
Own data governance for our payments and cards domains: standards, data quality, lineage and stewardship.
What you'll do: run the domain's stewardship network; set and track data quality targets; lead lineage for regulatory reports; partner with Risk and Technology on fixes; coach 2 analysts.
What we look for: 5+ years in data governance, stewardship or data management in financial services; hands-on lineage and data quality experience; strong stakeholder management; experience coaching others.`,
    },
  },
];

export function getPersona(id: string): Persona | undefined {
  return PERSONAS.find((p) => p.id === id);
}
