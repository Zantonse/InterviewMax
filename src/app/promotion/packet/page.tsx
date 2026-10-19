import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { CopyButton } from "@/components/copy-button";
import { levelStep, packetIsStale, packetText, type PacketItem } from "@/lib/promotion/content";
import { getPromotionPlan, requirePromotion } from "@/lib/promotion/data";
import { isFinishedStory } from "@/lib/resume/content";
import { listStories, type StoryRecord } from "@/lib/stories/data";
import { BetaBadge } from "../beta-badge";
import { PacketButton } from "../forms";

export const metadata: Metadata = { title: "Promotion packet · PromotionMax" };

// Writing the packet is one model call over every written story, with a retry.
export const maxDuration = 180;

export default function PacketPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Link href="/promotion" className="text-sm font-medium text-ink-800 hover:underline">
          ← Back to your promotion
        </Link>
        <Suspense fallback={<div className="mt-4 h-64 animate-pulse rounded-3xl bg-white/80" />}>
          <Packet />
        </Suspense>
      </main>
    </div>
  );
}

async function Packet() {
  await requirePromotion();
  const [plan, stories] = await Promise.all([getPromotionPlan(), listStories()]);
  const finished = stories.filter(isFinishedStory).length;
  const packet = plan.packet;
  const titles = new Map(stories.map((s) => [s.id, s.title]));

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Promotion packet
        </h1>
        <BetaBadge />
      </div>
      <p className="mt-2 text-slate-600">
        {levelStep(plan) ? <strong className="text-slate-900">{levelStep(plan)}. </strong> : null}
        Written from your {finished} written {finished === 1 ? "story" : "stories"} only. Each line
        names the stories behind it, and a line with a figure that isn&apos;t in those stories is
        left out.
      </p>

      <div className="mt-5">
        {!plan.targetLevel ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <Link href="/promotion" className="font-semibold underline">
              Pick the level you&apos;re going for
            </Link>{" "}
            first.
          </p>
        ) : finished === 0 ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Finish writing a story first: the packet is built from your written stories.{" "}
            <Link href="/stories/new" className="font-semibold underline">
              Build a story
            </Link>
          </p>
        ) : (
          <PacketButton again={Boolean(packet)} />
        )}
      </div>

      {packet && (
        <article className="mt-6 space-y-6" data-testid="packet">
          {packetIsStale(packet, stories) && (
            <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
              Your stories changed since this was written. Write it again to use the latest.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Written{" "}
              {new Date(packet.generatedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              })}
              {packet.leftOut > 0 &&
                ` · ${packet.leftOut} ${packet.leftOut === 1 ? "line" : "lines"} left out for an untraced figure`}
            </p>
            <CopyButton
              text={packetText(packet)}
              label="Copy the packet"
              className="rounded-xl px-3 py-1.5 text-sm font-semibold text-ink-800 ring-1 ring-slate-300 hover:bg-slate-50"
            />
          </div>

          <Block title="Self-review">
            {packet.selfReview.map((item, i) => (
              <Item key={i} item={item} titles={titles} heading={item.dimension} />
            ))}
          </Block>

          {packet.managerSummary && (
            <Block title="Summary for your manager">
              <p className="whitespace-pre-line text-slate-800">{packet.managerSummary}</p>
            </Block>
          )}

          {packet.talkingPoints.length > 0 && (
            <Block title="Talking points">
              <ul className="list-disc space-y-3 pl-5">
                {packet.talkingPoints.map((item, i) => (
                  <li key={i}>
                    <Item item={item} titles={titles} />
                  </li>
                ))}
              </ul>
            </Block>
          )}
        </article>
      )}
    </>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

function Item({
  item,
  titles,
  heading,
}: {
  item: PacketItem;
  titles: Map<string, StoryRecord["title"]>;
  heading?: string;
}) {
  return (
    <div>
      {heading && <p className="font-semibold text-slate-900">{heading}</p>}
      <p className="text-slate-800">{item.text}</p>
      <p className="mt-1 text-xs text-slate-500">
        From{" "}
        {item.storyIds.map((id, i) => (
          <span key={id}>
            {i > 0 && ", "}
            {titles.has(id) ? (
              <Link href={`/stories/${id}`} className="font-medium text-ink-800 hover:underline">
                {titles.get(id)}
              </Link>
            ) : (
              "a deleted story"
            )}
          </span>
        ))}
      </p>
    </div>
  );
}
