// "Map my role": the usual parts of common job functions, written by hand. The user marks each
// part as owned, contributed to, or not theirs, which turns "I only did a slice of it" into a
// named specialty. A function's terms are the words interviewers and job posts use for it; they
// give the user vocabulary for work they already described, never new facts.

export type RoleFunction = {
  id: string;
  label: string;
  // One line on what the work looks like, so the user can recognise it.
  blurb: string;
  terms: string[];
};

export type RoleFamily = {
  id: string;
  label: string;
  functions: RoleFunction[];
};

export const ROLE_FAMILIES: RoleFamily[] = [
  {
    id: "data_governance",
    label: "Data governance",
    functions: [
      {
        id: "data_quality",
        label: "Data quality",
        blurb: "Defining quality rules, monitoring them, and chasing down bad data.",
        terms: ["data quality rules", "data profiling", "data quality monitoring", "remediation"],
      },
      {
        id: "metadata_catalog",
        label: "Metadata and data catalog",
        blurb: "Documenting what data exists, what it means, and where to find it.",
        terms: ["data catalog", "metadata management", "business glossary", "data dictionary"],
      },
      {
        id: "lineage",
        label: "Data lineage",
        blurb: "Tracing where data comes from and what depends on it.",
        terms: ["data lineage", "impact analysis", "data flows"],
      },
      {
        id: "stewardship",
        label: "Data stewardship",
        blurb:
          "Being the go-to owner for a data domain, answering questions and approving changes.",
        terms: ["data steward", "data ownership", "data domain", "issue triage"],
      },
      {
        id: "policy_standards",
        label: "Policy and standards",
        blurb: "Writing and enforcing the rules for how data is named, used and retained.",
        terms: ["data governance framework", "data standards", "data policy", "retention"],
      },
      {
        id: "privacy_access",
        label: "Privacy, security and access",
        blurb: "Classifying sensitive data and controlling who can see it.",
        terms: ["data classification", "access controls", "PII", "privacy compliance"],
      },
      {
        id: "master_data",
        label: "Master and reference data",
        blurb: "Keeping one trusted version of key records like customers, products or vendors.",
        terms: ["master data management", "MDM", "golden record", "reference data"],
      },
      {
        id: "reporting_compliance",
        label: "Governance reporting and audits",
        blurb: "Reporting on governance health and supporting audits or regulators.",
        terms: ["governance metrics", "audit support", "regulatory reporting", "controls testing"],
      },
    ],
  },
  {
    id: "sales_engineering",
    label: "Sales engineering / solutions",
    functions: [
      {
        id: "discovery",
        label: "Technical discovery",
        blurb: "Uncovering the customer's environment, pain and requirements.",
        terms: ["technical discovery", "requirements gathering", "use-case qualification"],
      },
      {
        id: "demos",
        label: "Demos and presentations",
        blurb: "Showing the product against the customer's use case.",
        terms: ["custom demos", "technical presentations", "solution storytelling"],
      },
      {
        id: "poc",
        label: "Proofs of concept",
        blurb: "Running trials and evaluations to prove the product works for them.",
        terms: ["proof of concept", "POC", "technical validation", "success criteria"],
      },
      {
        id: "architecture",
        label: "Solution design",
        blurb: "Designing how the product fits into the customer's systems.",
        terms: ["solution architecture", "integration design", "reference architecture"],
      },
      {
        id: "rfps",
        label: "RFPs and security reviews",
        blurb: "Answering RFPs, questionnaires and technical due diligence.",
        terms: ["RFP responses", "security questionnaires", "technical due diligence"],
      },
      {
        id: "deal_strategy",
        label: "Deal strategy",
        blurb: "Partnering with account executives on winning and closing deals.",
        terms: ["deal strategy", "technical win", "pipeline", "opportunity management"],
      },
      {
        id: "enablement",
        label: "Enablement and tooling",
        blurb: "Training the team and building demo assets or internal tools.",
        terms: ["sales enablement", "demo environments", "internal tooling", "playbooks"],
      },
      {
        id: "product_feedback",
        label: "Product feedback",
        blurb: "Bringing field needs back to product and engineering.",
        terms: ["voice of the customer", "feature requests", "product feedback loop"],
      },
    ],
  },
  {
    id: "software_engineering",
    label: "Software engineering",
    functions: [
      {
        id: "feature_dev",
        label: "Feature development",
        blurb: "Building and shipping product features.",
        terms: ["feature development", "full-stack", "shipping"],
      },
      {
        id: "architecture",
        label: "System design",
        blurb: "Designing services, data models and how systems fit together.",
        terms: ["system design", "architecture", "scalability"],
      },
      {
        id: "reliability",
        label: "Reliability and on-call",
        blurb: "Keeping things running: incidents, monitoring, on-call.",
        terms: ["incident response", "observability", "SLOs", "on-call"],
      },
      {
        id: "infra",
        label: "Infrastructure and DevOps",
        blurb: "CI/CD, cloud, deployment and developer tooling.",
        terms: ["CI/CD", "infrastructure as code", "cloud", "developer experience"],
      },
      {
        id: "data",
        label: "Data and pipelines",
        blurb: "Databases, data pipelines and analytics plumbing.",
        terms: ["data pipelines", "ETL", "database design"],
      },
      {
        id: "quality",
        label: "Testing and quality",
        blurb: "Test strategy, automation and code review.",
        terms: ["test automation", "code review", "quality engineering"],
      },
      {
        id: "security",
        label: "Security",
        blurb: "Secure design, vulnerabilities and access.",
        terms: ["application security", "threat modeling", "vulnerability remediation"],
      },
      {
        id: "leadership",
        label: "Technical leadership",
        blurb: "Leading projects, mentoring and setting direction.",
        terms: ["tech lead", "mentoring", "technical roadmap"],
      },
    ],
  },
  {
    id: "product_management",
    label: "Product management",
    functions: [
      {
        id: "discovery",
        label: "Customer discovery",
        blurb: "Talking to users and finding the problems worth solving.",
        terms: ["customer discovery", "user research", "problem validation"],
      },
      {
        id: "strategy",
        label: "Strategy and roadmap",
        blurb: "Deciding what to build and in what order.",
        terms: ["product strategy", "roadmap", "prioritization"],
      },
      {
        id: "specs",
        label: "Requirements and specs",
        blurb: "Writing what to build and why, and working through it with engineering.",
        terms: ["PRDs", "user stories", "requirements"],
      },
      {
        id: "delivery",
        label: "Delivery",
        blurb: "Getting things shipped with engineering and design.",
        terms: ["execution", "agile delivery", "cross-functional leadership"],
      },
      {
        id: "metrics",
        label: "Metrics and experiments",
        blurb: "Defining success and measuring it.",
        terms: ["KPIs", "A/B testing", "product analytics"],
      },
      {
        id: "launch",
        label: "Launch and go-to-market",
        blurb: "Launching with marketing, sales and support.",
        terms: ["go-to-market", "product launch", "positioning"],
      },
      {
        id: "stakeholders",
        label: "Stakeholder management",
        blurb: "Aligning leaders and teams around decisions.",
        terms: ["stakeholder alignment", "executive communication"],
      },
    ],
  },
  {
    id: "sales",
    label: "Sales / account executive",
    functions: [
      {
        id: "prospecting",
        label: "Prospecting",
        blurb: "Finding and opening new opportunities.",
        terms: ["prospecting", "pipeline generation", "outbound"],
      },
      {
        id: "discovery",
        label: "Discovery and qualification",
        blurb: "Understanding the buyer's needs and whether there's a deal.",
        terms: ["discovery", "qualification", "MEDDICC"],
      },
      {
        id: "closing",
        label: "Negotiation and closing",
        blurb: "Pricing, contracts and getting deals signed.",
        terms: ["negotiation", "closing", "deal desk"],
      },
      {
        id: "forecasting",
        label: "Forecasting and pipeline",
        blurb: "Managing and forecasting the pipeline.",
        terms: ["forecasting", "pipeline management", "quota attainment"],
      },
      {
        id: "account_mgmt",
        label: "Account management and expansion",
        blurb: "Growing existing customers and renewals.",
        terms: ["account management", "upsell", "renewals", "net revenue retention"],
      },
      {
        id: "exec_relationships",
        label: "Executive relationships",
        blurb: "Selling to and building trust with senior buyers.",
        terms: ["executive selling", "C-level relationships"],
      },
      {
        id: "partners",
        label: "Partners and channels",
        blurb: "Working deals with partners or resellers.",
        terms: ["channel sales", "partner co-selling"],
      },
    ],
  },
  {
    id: "customer_success",
    label: "Customer success / account management",
    functions: [
      {
        id: "onboarding",
        label: "Onboarding and implementation",
        blurb: "Getting new customers live and using the product.",
        terms: ["onboarding", "implementation", "time to value"],
      },
      {
        id: "adoption",
        label: "Adoption and health",
        blurb: "Tracking usage and customer health, and acting on it.",
        terms: ["adoption", "customer health scores", "usage analytics"],
      },
      {
        id: "renewals",
        label: "Renewals and retention",
        blurb: "Keeping customers and preventing churn.",
        terms: ["renewals", "retention", "churn reduction"],
      },
      {
        id: "expansion",
        label: "Expansion",
        blurb: "Finding growth inside existing accounts.",
        terms: ["expansion", "upsell", "account growth"],
      },
      {
        id: "escalations",
        label: "Escalations",
        blurb: "Handling unhappy customers and serious issues.",
        terms: ["escalation management", "issue resolution"],
      },
      {
        id: "qbrs",
        label: "Business reviews",
        blurb: "Running QBRs and showing customers their results.",
        terms: ["QBRs", "executive business reviews", "ROI reporting"],
      },
      {
        id: "voice",
        label: "Voice of the customer",
        blurb: "Bringing customer feedback to product and leadership.",
        terms: ["voice of the customer", "customer advocacy"],
      },
    ],
  },
];

export function getRoleFamily(id: string | null | undefined): RoleFamily | undefined {
  return ROLE_FAMILIES.find((f) => f.id === id);
}

// The work questions. They ask about the work, not the person, which is easier to answer for
// someone who doesn't yet have words for their role.
export const WORK_QUESTIONS = [
  { id: "title", text: "What was your job title, and which team or department were you in?" },
  { id: "week", text: "Walk me through a typical week. What did you spend most of your time on?" },
  {
    id: "owned",
    text: "What was yours to own: things you decided, built, maintained or were on the hook for?",
  },
  { id: "came_to_you", text: "Who came to you, and what did they come to you for?" },
  { id: "tools", text: "Which tools, systems, reports or data did you work with?" },
  { id: "when_out", text: "What stalled or went wrong when you were out?" },
  {
    id: "sizes",
    text: "Any sizes you remember: how many people, teams, systems, reports, records or customers, and how often? Rough numbers are fine; say if they're estimates.",
  },
  { id: "next", text: "What kind of role are you going after next, if you know?" },
] as const;

export type WorkQuestionId = (typeof WORK_QUESTIONS)[number]["id"];

// At least this many answers before mapping, so the profile has something to stand on.
export const MIN_WORK_ANSWERS = 4;
