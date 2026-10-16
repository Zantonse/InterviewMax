import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { PageGuide } from "@/components/page-guide";
import { type TargetJob, listJobs } from "@/lib/jobs/data";
import {
  type NumbersChecklist,
  OTHER_ROLE,
  checklistItems,
  checklistRole,
  filledCount,
} from "@/lib/numbers/checklist";
import { getNumbersChecklist } from "@/lib/numbers/data";
import { NUMBERS_FAMILIES, getNumbersFamily, guessFamily } from "@/lib/numbers/families";
import { NUMBER_SOURCES } from "@/lib/numbers/sources";
import { type StoryRecord, listStories } from "@/lib/stories/data";
import { REQUIRED_STORY_TYPE_ID } from "@/lib/stories/story-types";
import { NumbersForm, RoleForm } from "./forms";

export const metadata: Metadata = { title: "Your numbers · InterviewMax" };

// Picking a role with no hand-written list drafts one, which is a model call.
export const maxDuration = 60;

export default function NumbersPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/" className="text-sm font-medium text-ink-800 hover:underline">
          ← Back to your prep
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Your numbers
        </h1>
        <p className="mt-2 text-slate-600">
          Strong stories have numbers in them. Here are the ones interviewers expect for your role,
          and where to find each. Fill in what you can; your stories will use them, and I&apos;ll
          never make one up.
        </p>
        <PageGuide
          id="numbers"
          steps={[
            "Confirm your role, and I'll list the numbers interviewers expect from it.",
            "Fill them in one at a time. Skip any you don't know; rough is fine if you say “about”.",
            "Your stories use them, and the builder shows which ones each story needs.",
          ]}
        />
        <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-3xl bg-white/80" />}>
          <NumbersContent />
        </Suspense>
      </main>
    </div>
  );
}

async function NumbersContent() {
  let checklist: NumbersChecklist | null;
  try {
    checklist = await getNumbersChecklist();
  } catch (err) {
    unstable_rethrow(err);
    console.error("Numbers checklist: loading failed", err);
    return (
      <section className="mt-8 rounded-3xl bg-amber-50 p-6 text-amber-900 ring-1 ring-black/5">
        Your numbers couldn&apos;t be loaded just now. Try again in a moment.
      </section>
    );
  }
  const families = NUMBERS_FAMILIES.map((f) => ({ id: f.id, label: f.label }));

  if (!checklist) {
    const suggested = await suggestRole();
    return (
      <section className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
        <RoleForm
          families={families}
          initialFamilyId={suggested.familyId}
          initialRoleName={suggested.roleName}
          submitLabel="Show my numbers"
        />
      </section>
    );
  }

  const items = checklistItems(checklist);
  return (
    <>
      <WhereToLook openByDefault={filledCount(checklist) === 0} />
      <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-800">
            {checklistRole(checklist)}
          </h2>
          <p className="text-sm text-slate-600" data-testid="numbers-filled">
            {filledCount(checklist)} of {items.length} filled in
          </p>
        </div>
        <NumbersForm items={items} values={checklist.values} />
      </section>
      <details className="mt-4 rounded-3xl bg-white/70 p-5 ring-1 ring-black/5 sm:p-6">
        <summary className="cursor-pointer text-sm font-medium text-ink-800">
          Not your role? Change it
        </summary>
        <div className="mt-4">
          <RoleForm
            families={families}
            initialFamilyId={checklist.familyId ?? OTHER_ROLE}
            initialRoleName={checklist.roleName ?? ""}
            submitLabel="Change my role"
          />
        </div>
      </details>
    </>
  );
}

// A first guess at their role from what they've already told us: their role map, their About me
// answer about today, then their target jobs. They confirm it before anything is built.
async function suggestRole(): Promise<{ familyId: string; roleName: string }> {
  const [stories, jobs] = await Promise.all([
    listStories().catch(() => [] as StoryRecord[]),
    listJobs().catch(() => [] as TargetJob[]),
  ]);
  const aboutMe = stories.find((s) => s.storyType === REQUIRED_STORY_TYPE_ID)?.content;
  const map = aboutMe?.roleMap;
  if (getNumbersFamily(map?.familyId)) return { familyId: map!.familyId!, roleName: "" };
  const guess = guessFamily([
    map?.roleName,
    map?.answers.title,
    aboutMe?.answers.now,
    ...jobs.map((j) => j.title),
  ]);
  if (guess) return { familyId: guess, roleName: "" };
  return { familyId: OTHER_ROLE, roleName: map?.roleName ?? "" };
}

// The places people usually find their numbers, across every role. Open for someone who hasn't
// filled any in yet, so they can gather a few sources before starting; one tap away after that.
function WhereToLook({ openByDefault }: { openByDefault: boolean }) {
  return (
    <details
      open={openByDefault}
      className="group mt-8 rounded-3xl bg-white/70 p-5 ring-1 ring-black/5 sm:p-6"
      data-testid="numbers-sources"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-ink-800 [&::-webkit-details-marker]:hidden">
        Where to find your numbers
        <span aria-hidden className="text-xs transition group-open:rotate-180">
          ▾
        </span>
      </summary>
      <p className="mt-2 text-sm text-slate-600">
        Most numbers are already written down somewhere. Open two or three of these before you
        start, and the list goes quickly.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {NUMBER_SOURCES.map((group) => (
          <div key={group.title}>
            <h3 className="text-sm font-semibold text-slate-900">{group.title}</h3>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-600">
              {group.places.map((place) => (
                <li key={place}>{place}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-slate-600">
        Can&apos;t find one? A labelled estimate like &ldquo;about 30&rdquo; is fine, and a blank
        is fine too. I&apos;ll never fill one in for you.
      </p>
    </details>
  );
}
