import Link from "next/link";

// The two policy links, for sign-in and the settings page.
export function PolicyLinks({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm text-slate-500 ${className}`}>
      <Link href="/privacy" className="font-medium text-ink-800 hover:underline">
        Privacy policy
      </Link>
      <span aria-hidden> · </span>
      <Link href="/ai-usage" className="font-medium text-ink-800 hover:underline">
        AI usage policy
      </Link>
    </p>
  );
}
