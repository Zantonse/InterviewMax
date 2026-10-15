import type { Metadata } from "next";
import Link from "next/link";
import {
  ContactLine,
  PolicyList,
  PolicyPage,
  PolicySection,
} from "@/components/policy-page";
import { privacyContactEmail } from "@/lib/privacy/contact";
import { aiStepRows, aiVendors } from "@/lib/privacy/ai-steps";

export const metadata: Metadata = { title: "AI usage policy · InterviewMax" };

// Which steps use AI, what each sends, where it goes, and the rules the models work under (PRD
// v0.3, "Data privacy and AI usage"). The table is built from the app's model config, so it stays
// in step with what actually runs. A draft for Craig to check; not legal advice.
export default function AiUsagePage() {
  const rows = aiStepRows();
  const vendors = aiVendors().join(" and ");
  const contact = privacyContactEmail();

  return (
    <PolicyPage title="AI usage policy">
      <p className="text-lg">
        InterviewMax uses AI models to ask you follow-up questions, write and grade your stories,
        and read jobs, resumes and transcripts. This page says what is sent, where it goes, and
        what the models are and aren&apos;t allowed to do with it.
      </p>

      <PolicySection title="How a request travels">
        <p>
          When a step needs AI, our server sends only what that step needs to{" "}
          <strong>OpenRouter</strong>, which passes it to the company whose model runs the step (
          {vendors} today). Your email address and account details are not sent. Nothing goes to
          a model until you use a feature that needs it.
        </p>
      </PolicySection>

      <PolicySection title="No training on your data">
        <PolicyList>
          <li>
            Every request tells OpenRouter to use only providers that don&apos;t collect or train
            on what we send. If none is available for a model, the request fails rather than going
            to one that does. The same rule is switched on for our whole OpenRouter account.
          </li>
          <li>OpenRouter&apos;s own logging of what we send is turned off.</li>
          <li>
            {vendors} don&apos;t train their models on data sent through their APIs. They may keep
            requests for up to 30 days to check for abuse, then delete them.
          </li>
          <li>We don&apos;t train or fine-tune any model on your stories.</li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="Which steps use AI">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" data-testid="ai-steps">
            <thead>
              <tr className="border-b border-slate-300 text-slate-900">
                <th className="py-2 pr-4 font-semibold">Feature</th>
                <th className="py-2 pr-4 font-semibold">What is sent</th>
                <th className="py-2 font-semibold">Model by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 align-top">
              {rows.map((row) => (
                <tr key={row.step}>
                  <td className="py-2 pr-4 font-medium text-slate-900">{row.feature}</td>
                  <td className="py-2 pr-4">{row.sends}</td>
                  <td className="py-2">{row.vendor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Grading uses a different company&apos;s model from the one that writes your story, so the
          writer never grades its own work.
        </p>
      </PolicySection>

      <PolicySection title="The no-invented-facts rule">
        <PolicyList>
          <li>
            The AI writes only from what you told it. It may reword and order your answers, but it
            must not add events, results or numbers you didn&apos;t give.
          </li>
          <li>
            The app checks every number in a written story against your answers and flags any it
            can&apos;t trace. Quotes taken from your resume, a job posting or a transcript are
            checked against the original text.
          </li>
          <li>
            AI can still be wrong. Read every story and grade as a draft, and only say in an
            interview what is true.
          </li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="What AI is not used for">
        <PolicyList>
          <li>Deciding anything about you outside the app, or sharing your stories with anyone.</li>
          <li>Listening in or helping live during a real interview.</li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="Questions">
        <p>
          Write to <ContactLine email={contact} />. How your data is kept and deleted is in the{" "}
          <Link href="/privacy" className="font-medium text-ink-800 hover:underline">
            privacy policy
          </Link>
          .
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
