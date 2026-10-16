import type { Metadata } from "next";
import Link from "next/link";
import {
  ContactLine,
  PolicyList,
  PolicyPage,
  PolicySection,
} from "@/components/policy-page";
import { authProvider } from "@/lib/auth0/provider";
import { privacyContactEmail } from "@/lib/privacy/contact";
import { aiVendors } from "@/lib/privacy/ai-steps";

export const metadata: Metadata = { title: "Privacy policy · InterviewMax" };

// What InterviewMax collects, why, where it's kept, for how long and who else sees it (PRD v0.3,
// "Data privacy and AI usage"). A draft for Craig to check; not legal advice.
export default function PrivacyPage() {
  const contact = privacyContactEmail();
  const auth0 = authProvider() === "auth0";
  const vendors = aiVendors().join(" and ");

  return (
    <PolicyPage title="Privacy policy">
      <p className="text-lg">
        InterviewMax helps you turn your work history into interview stories. That means you tell it
        sensitive things: employers, customers, revenue figures, what went wrong. This page says
        plainly what we keep, why, and how to delete it.
      </p>

      <PolicySection title="The short version">
        <PolicyList>
          <li>We keep what you put in so the app can work. We never sell it or use it for ads.</li>
          <li>
            Some of it is sent to AI models to build and grade your stories. We only use model
            providers that don&apos;t train on it. The{" "}
            <Link href="/ai-usage" className="font-medium text-ink-800 hover:underline">
              AI usage policy
            </Link>{" "}
            has the details.
          </li>
          <li>
            You can delete one story, job or transcript at any time, or your whole account and
            everything in it in one step from{" "}
            <Link href="/settings" className="font-medium text-ink-800 hover:underline">
              Settings
            </Link>
            .
          </li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="What we collect">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-slate-900">
                <th className="py-2 pr-4 font-semibold">What</th>
                <th className="py-2 pr-4 font-semibold">Where it comes from</th>
                <th className="py-2 font-semibold">Sent to an AI model?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 align-top">
              {COLLECTED.map(([what, from, ai]) => (
                <tr key={what}>
                  <td className="py-2 pr-4 font-medium text-slate-900">{what}</td>
                  <td className="py-2 pr-4">{from}</td>
                  <td className="py-2">{ai}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          When you upload a file, we keep the text read from it, not the file itself. Screenshots
          and voice recordings are not kept at all: only the text taken from them.
        </p>
        <p>
          We don&apos;t use advertising or analytics cookies. The app sets only the cookies that
          keep you signed in, and remembers a couple of display choices (like a folded sidebar) in
          your browser.
        </p>
      </PolicySection>

      <PolicySection title="Why we use it">
        <PolicyList>
          <li>To run the features you use: building, writing, tailoring and grading your stories.</li>
          <li>
            To see how far people get through the app (activity only, such as &ldquo;finished a
            story&rdquo; and when), so we can fix the steps where people get stuck.
          </li>
          <li>
            To coach you: the founder can read your stories to give you feedback (see who sees it,
            below).
          </li>
          <li>To sign you in and send sign-in emails.</li>
        </PolicyList>
        <p>
          We don&apos;t sell your data, show you ads, or use your stories to train AI models, ours
          or anyone else&apos;s.
        </p>
      </PolicySection>

      <PolicySection title="Where it's kept, and who else sees it">
        <p>These companies process data for us, only to run InterviewMax:</p>
        <PolicyList>
          <li>
            <strong>Supabase</strong> holds the database{auth0 ? "" : " and runs sign-in"}, in the
            United States (US East, Ohio). Only you can read your rows; the database checks who is
            asking on every request.
          </li>
          {auth0 && (
            <li>
              <strong>Auth0</strong> (by Okta) runs sign-in. It holds your email address and the
              sign-in method you use (for example Google or an email code).
            </li>
          )}
          <li>
            <strong>Vercel</strong> hosts the app. It keeps short-lived technical logs, such as
            which page was requested and error messages.
          </li>
          <li>
            <strong>OpenRouter</strong> passes AI requests to the model companies ({vendors}). See
            the{" "}
            <Link href="/ai-usage" className="font-medium text-ink-800 hover:underline">
              AI usage policy
            </Link>
            .
          </li>
          <li>
            When you add a job by link, the app fetches that page from the job site. The site sees a
            request from our server, not from you.
          </li>
        </PolicyList>
        <p>
          Inside InterviewMax, the admin page shows the founder, who is also the coach, which steps
          each person has done and when. To coach you, the founder can also read your stories: your
          answers, the follow-up questions, the written story and its grade. Uploads (resumes,
          LinkedIn PDFs and interview transcripts) are not shown there. Every look at the admin page,
          and every story opened, is logged. Beyond that, the people who run the database only reach
          stored data to fix a problem you report, or if the law requires it.
        </p>
      </PolicySection>

      <PolicySection title="How long we keep it">
        <p>
          Until you delete it. Deleting a story, job or past interview removes it straight away.
          Deleting your account removes your profile, resume text, stories, jobs, transcripts,
          numbers, activity records{auth0 ? " and your Auth0 sign-in" : " and your sign-in"} in one
          step. Copies in our database host&apos;s backups are overwritten within 7 days.
        </p>
        <p>
          AI providers may keep requests for a short time for abuse and safety checks; the{" "}
          <Link href="/ai-usage" className="font-medium text-ink-800 hover:underline">
            AI usage policy
          </Link>{" "}
          says how long.
        </p>
      </PolicySection>

      <PolicySection title="Your choices">
        <PolicyList>
          <li>See everything you&apos;ve saved: it&apos;s all in the app.</li>
          <li>Change or delete any story, job or transcript from its page.</li>
          <li>
            Delete your account and all your data from{" "}
            <Link href="/settings" className="font-medium text-ink-800 hover:underline">
              Settings
            </Link>
            .
          </li>
          <li>
            Ask a question or ask for a copy of your data: write to <ContactLine email={contact} />.
          </li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="Changes">
        <p>
          If we change what we collect or who sees it, we&apos;ll update this page and its date, and
          tell you in the app.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}

const COLLECTED: [string, string, string][] = [
  ["Email address", "Sign-in", "No"],
  [
    "Resume, LinkedIn profile text, prepared answers",
    "Files you upload or text you paste",
    "Yes, to prefill answers, read jobs and suggest stories",
  ],
  [
    "Target jobs and interview reports",
    "Text you paste, a posting link, or a PDF, saved page or screenshots you upload",
    "Yes, to read jobs and predict questions",
  ],
  ["Past interview transcripts", "Files you upload or text you paste", "Yes, to find what was asked"],
  [
    "Story answers, drafts, role map, numbers, grades, interview dates",
    "What you build in the app",
    "Yes, to ask follow-ups, write, tailor and grade",
  ],
  ["Voice in mic mode", "Your microphone, only while it's on", "Yes, to write down what you said"],
  ["Activity (which steps you've done, and when)", "Recorded by the app", "No"],
];
