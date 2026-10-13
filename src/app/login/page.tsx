import type { Metadata } from "next";
import { Suspense } from "react";
import { WhyInterviewMax } from "@/components/why-interviewmax";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · InterviewMax" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">InterviewMax</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
          Build stories that land.
        </h1>
        <p className="mt-2 text-slate-600">
          Sign in with your email. No password needed.
        </p>
        <Suspense fallback={null}>
          <LinkError searchParams={searchParams} />
        </Suspense>
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
      <WhyInterviewMax className="w-full max-w-3xl" />
    </main>
  );
}

async function LinkError({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { error } = await searchParams;
  if (!error) return null;
  return (
    <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
      That sign-in link didn&apos;t work or has expired. Request a new one below.
    </p>
  );
}
