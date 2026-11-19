import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { AdminSetupError, listUserStories, logAdminView, requireAdmin } from "@/lib/admin/data";
import { interviewLabel, levelCounts, nextInterview } from "@/lib/coaching/client-view";
import {
  CoachingSetupError,
  clientJobs,
  listClients,
  listPendingInvites,
  type Client,
} from "@/lib/coaching/clients";
import { AdminTabs, Card, SetupNeeded, formatDay } from "../ui";
import { cancelInvite } from "./actions";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = {
  title: "My clients · Admin · InterviewMax",
  robots: { index: false, follow: false },
};

// 1:1 coaching (Craig, 2026-11-19): invite one person at a time; once they say yes they show here,
// with their next interview and how their stories stand. Each opens to their client page.
export default function ClientsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Admin</h1>
        <AdminTabs current="clients" />
        <p className="mt-4 max-w-2xl text-slate-600">
          The people you coach 1:1. Each one said yes to an invite link and can stop from their
          Settings at any time, which closes their page here.
        </p>
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-3xl bg-white/80" />}>
          <ClientsContent />
        </Suspense>
      </main>
    </div>
  );
}

async function ClientsContent() {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AdminSetupError) return <SetupNeeded message={err.message} />;
    throw err;
  }
  await logAdminView(admin, "clients");
  let clients: Client[];
  let invites;
  try {
    [clients, invites] = await Promise.all([listClients(admin), listPendingInvites(admin)]);
  } catch (err) {
    if (err instanceof CoachingSetupError) return <SetupNeeded message={err.message} />;
    throw err;
  }
  const active = clients.filter((c) => !c.stoppedAt);
  const stopped = clients.filter((c) => c.stoppedAt);
  const [jobs, stories] = await Promise.all([
    clientJobs(
      admin,
      active.map((c) => c.userId),
    ),
    Promise.all(active.map((c) => listUserStories(admin, c.userId))),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mt-8 space-y-6">
      <Card title="Invite someone" note="Only you see who it's for. They see a consent screen first.">
        <InviteForm />
        {invites.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-900">Waiting for a yes</h3>
            <ul className="mt-2 divide-y divide-slate-100 text-sm" data-testid="pending-invites">
              {invites.map((invite) => (
                <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium text-slate-900">{invite.label || "Unnamed"}</span>
                    <span className="text-slate-500">
                      {" "}
                      · made {formatDay(invite.createdAt)} · works until {formatDay(invite.expiresAt)}
                    </span>
                  </span>
                  <form action={cancelInvite}>
                    <input type="hidden" name="id" value={invite.id} />
                    <button
                      type="submit"
                      className="rounded-lg px-2 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    >
                      Cancel link
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card title={`Clients (${active.length})`}>
        {active.length === 0 ? (
          <p className="text-sm text-slate-600">
            Nobody yet. Make an invite link above and send it to someone you coach.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="client-list">
            {active.map((client, i) => {
              const clientJobList = jobs.get(client.userId) ?? [];
              const next = nextInterview(clientJobList, today);
              const counts = levelCounts(stories[i]);
              const open = clientJobList.filter((j) => !j.outcome).length;
              return (
                <li key={client.userId}>
                  <Link
                    href={`/admin/clients/${client.userId}`}
                    className="block h-full rounded-2xl p-4 ring-1 ring-slate-200 transition hover:ring-ink-700/40"
                  >
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-lg font-bold text-slate-900">
                        {client.label || client.email}
                      </span>
                      {next ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                          {interviewLabel(next, today)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">No interview date</span>
                      )}
                    </span>
                    {client.label && (
                      <span className="block break-all text-sm text-slate-500">{client.email}</span>
                    )}
                    <span className="mt-2 block text-sm text-slate-700">
                      {open} open {open === 1 ? "job" : "jobs"} · stories at Level 3: {counts[3]},
                      Level 2: {counts[2]}, Level 1: {counts[1]}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      Coaching since {formatDay(client.startedAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {stopped.length > 0 && (
        <Card title="Stopped" note="They stopped coaching, so their pages are closed. A new invite starts it again.">
          <ul className="space-y-1 text-sm text-slate-700">
            {stopped.map((client) => (
              <li key={client.userId}>
                {client.label || client.email}
                {client.label && <span className="text-slate-500"> · {client.email}</span>}
                <span className="text-slate-500">
                  {" "}
                  · stopped {formatDay(client.stoppedAt as string)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
