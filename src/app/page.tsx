import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200/80 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="text-lg font-extrabold tracking-tight text-teal-900">InterviewMax</span>
          <Suspense fallback={<span className="h-5 w-32 animate-pulse rounded bg-slate-200" />}>
            <AccountMenu />
          </Suspense>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Your interview prep
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Nothing here yet. Your target jobs, stories and practice will show up on this page as you
          build them.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-2">
          <Card className="bg-teal-800 text-white md:col-span-2 md:row-span-2" title="Story bank">
            <p className="text-5xl font-extrabold">0</p>
            <p className="mt-1 text-teal-100">stories so far</p>
            <p className="mt-6 max-w-md text-teal-50">
              Every story you build is kept here, checked against the rubric and tagged to the
              themes interviewers ask about.
            </p>
          </Card>
          <Card title="Target jobs">
            <EmptyLine>No target jobs added yet.</EmptyLine>
          </Card>
          <Card title="Likely questions">
            <EmptyLine>Questions appear once you add a target job.</EmptyLine>
          </Card>
        </div>
      </main>
    </div>
  );
}

async function AccountMenu() {
  const user = await getCurrentUser();
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden text-slate-600 sm:inline" data-testid="user-email">
        {user.email}
      </span>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="rounded-full px-3 py-1.5 font-medium text-teal-800 ring-1 ring-teal-800/20 hover:bg-teal-50"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}

function Card({
  title,
  className = "bg-white text-slate-900",
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-3xl p-6 shadow-sm ring-1 ring-black/5 ${className}`}>
      <h2 className="text-sm font-bold uppercase tracking-wide opacity-80">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-slate-500">{children}</p>;
}
