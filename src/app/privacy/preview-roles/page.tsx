import { RolesCard } from "@/app/jobs/[id]/roles-card";
import { JobOutcomeForm } from "@/app/jobs/forms";
import { QuestionList } from "@/components/question-list";
import type { TargetJob } from "@/lib/jobs/data";
import { withRoleQuestion } from "@/lib/jobs/roles";
import serval from "./serval.json";

const S = serval as Record<string, string>;
const others = [
  { id: "a", title: "Solutions Engineer - Majors", level: "mid" as const, levelConfirmed: true, description: S["Solutions Engineer - Majors"], addedAt: "" },
  { id: "b", title: "Solutions Engineer, Enterprise", level: "mid" as const, levelConfirmed: true, description: S["Solutions Engineer, Enterprise"], addedAt: "" },
];
const job = {
  id: "00000000-0000-0000-0000-000000000001",
  title: "Solutions Engineer, Strategic",
  company: "Serval",
  level: "senior",
  levelConfirmed: true,
  description: S["Solutions Engineer, Strategic"],
  otherRoles: others,
  outcome: null,
  offeredRole: "",
} as unknown as TargetJob;

const qs = withRoleQuestion(
  [
    { question: "Tell me about yourself.", theme: "about_you", why: "always asked", source: "common", specific: false },
    { question: "Walk me through the largest, most complex enterprise deal you won the technical decision on.", theme: "impact", why: "Strategic asks for 10+ years with strategic customers", source: "posting", specific: false, role: "Solutions Engineer, Strategic" },
    { question: "Tell me about a time a security team pushed back hard during an evaluation.", theme: "influence", why: "posting stresses security reviews", source: "posting", specific: false },
  ],
  others,
  10,
);

export default function Preview() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
        Solutions Engineer, Strategic <span className="font-bold text-slate-500">at Serval</span>
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Also up for: Solutions Engineer - Majors · Solutions Engineer, Enterprise.{" "}
        <a href="#roles" className="font-semibold text-ink-800 hover:underline">How the roles differ</a>
      </p>
      <RolesCard job={job} />
      <section id="q" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-800">Likely questions</h2>
        <QuestionList questions={qs} stories={[]} />
      </section>
      <section id="o" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <JobOutcomeForm jobId={job.id} outcome={null} roundReached={null} roundName="" finishedOn={null} roles={["Solutions Engineer, Strategic", ...others.map((o) => o.title)]} />
      </section>
    </main>
  );
}
