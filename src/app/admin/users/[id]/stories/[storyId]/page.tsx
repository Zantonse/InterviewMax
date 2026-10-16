import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import {
  AdminSetupError,
  getUserStory,
  isUserId,
  logAdminView,
  requireAdmin,
} from "@/lib/admin/data";
import { TIERS, gradingCriteria } from "@/lib/stories/grading";
import { coreQuestionText, getStoryType, storyParts } from "@/lib/stories/story-types";
import { Card, SetupNeeded, formatWhen } from "../../../../ui";

export const metadata: Metadata = {
  title: "Story · Admin · InterviewMax",
  robots: { index: false, follow: false },
};

// One user's story, read-only, for coaching: what they answered, the follow-ups, the written
// story and its grade. The view is logged (with the story id) before anything is read.
export default function AdminStoryPage({ params }: PageProps<"/admin/users/[id]/stories/[storyId]">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-3xl bg-white/80" />}>
          <StoryContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function StoryContent({
  params,
}: {
  params: PageProps<"/admin/users/[id]/stories/[storyId]">["params"];
}) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AdminSetupError) return <SetupNeeded message={err.message} />;
    throw err;
  }
  const { id, storyId } = await params;
  if (!isUserId(id) || !isUserId(storyId)) notFound();
  await logAdminView(admin, `story:${storyId}`, id);
  const story = await getUserStory(admin, id, storyId);
  if (!story) notFound();

  const storyType = getStoryType(story.storyType);
  const { content } = story;
  const answers = Object.entries(content.answers).filter(([, a]) => a.trim());
  const followUps = content.followUps ?? [];
  const parts = content.draft
    ? storyParts(storyType)
        .map((p) => ({ label: p.label, text: content.draft?.parts[p.id] ?? "" }))
        .filter((p) => p.text.trim())
    : [];
  const grade = content.grade;
  const criterionLabel = (cid: string) =>
    gradingCriteria(storyType).find((c) => c.id === cid)?.label ?? cid;

  return (
    <>
      <Link href={`/admin/users/${id}`} className="text-sm font-medium text-ink-800 hover:underline">
        ← Back to this user
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">{story.title}</h1>
      <p className="mt-2 text-slate-600">
        {storyType?.label ?? story.storyType ?? "Story"} · started {formatWhen(story.createdAt)} ·
        last changed {formatWhen(story.updatedAt)}
      </p>

      <div className="mt-8 space-y-4">
        {parts.length > 0 && (
          <Card title="Written story">
            <div className="space-y-3">
              {parts.map((p) => (
                <div key={p.label}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {p.label}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-800">{p.text}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {grade && (
          <Card title="Grade" note={`Graded ${formatWhen(grade.gradedAt)}`}>
            <p className="font-semibold text-slate-900">
              {TIERS.find((t) => t.id === grade.tier)?.label ?? grade.tier}
            </p>
            {grade.summary && <p className="mt-1 text-slate-700">{grade.summary}</p>}
            {grade.criteria.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-slate-700">
                {grade.criteria.map((c) => (
                  <li key={c.id}>
                    <span className="font-medium">{criterionLabel(c.id)}</span>: {c.score} of 4
                    {c.note && <span className="text-slate-500">. {c.note}</span>}
                  </li>
                ))}
              </ul>
            )}
            {grade.fixes.length > 0 && (
              <>
                <p className="mt-3 text-sm font-semibold text-slate-900">To raise it</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {grade.fixes.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        )}

        <Card title="Their answers">
          {answers.length === 0 && !content.imported ? (
            <p className="text-sm text-slate-600">No answers yet.</p>
          ) : (
            <ol className="space-y-4">
              {content.imported && (
                <QA
                  q={`Uploaded answer${content.imported.fileName ? ` (${content.imported.fileName})` : ""}`}
                  a={content.imported.text}
                />
              )}
              {answers.map(([qid, a]) => (
                <QA key={qid} q={coreQuestionText(qid, storyType) || qid} a={a} />
              ))}
            </ol>
          )}
        </Card>

        {followUps.length > 0 && (
          <Card title="Follow-up questions" note="In the order they were asked.">
            <ol className="space-y-4">
              {followUps.map((f, i) => (
                <QA
                  key={i}
                  q={`${f.round ? `Round ${f.round}: ` : ""}${f.question}`}
                  a={f.answer?.trim() || ""}
                />
              ))}
            </ol>
          </Card>
        )}
      </div>
    </>
  );
}

function QA({ q, a }: { q: string; a: string }) {
  return (
    <li>
      <p className="text-sm font-semibold text-slate-900">{q}</p>
      {a ? (
        <p className="mt-1 whitespace-pre-wrap text-slate-700">{a}</p>
      ) : (
        <p className="mt-1 text-sm italic text-slate-400">Skipped or not answered yet</p>
      )}
    </li>
  );
}
