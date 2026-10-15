import Link from "next/link";

// The one-line notice under every upload (PRD v0.3, "Consent at upload"). The policy opens in a
// new tab so a half-filled form isn't lost.
export function AiNotice({ purpose, className = "" }: { purpose: string; className?: string }) {
  return (
    <p className={`text-xs font-normal text-slate-500 ${className}`} data-testid="ai-notice">
      This is sent to an AI model to {purpose}. See the{" "}
      <Link
        href="/ai-usage"
        target="_blank"
        className="font-medium text-ink-800 underline-offset-2 hover:underline"
      >
        AI usage policy
      </Link>
      .
    </p>
  );
}
