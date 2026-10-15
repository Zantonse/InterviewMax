import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage } from "@/components/policy-page";

export const metadata: Metadata = { title: "Account deleted · InterviewMax" };

export default function AccountDeletedPage() {
  return (
    <PolicyPage title="Your account is deleted" dated={false}>
      <p className="text-lg">
        Your stories, jobs, transcripts, uploads and sign-in are gone from InterviewMax. Thanks for
        trying it.
      </p>
      <p>
        <Link href="/login" className="font-semibold text-ink-800 hover:underline">
          Start again with a new account
        </Link>
      </p>
    </PolicyPage>
  );
}
