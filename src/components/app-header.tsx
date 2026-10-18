import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { isAdminEmail } from "@/lib/admin/access";
import { getCurrentUser } from "@/lib/auth";
import { listJobs } from "@/lib/jobs/data";
import { folderLabel } from "@/lib/jobs/folder";
import { canUsePromotion } from "@/lib/promotion/access";
import { getAppMode } from "@/lib/promotion/data";
import { listStories } from "@/lib/stories/data";
import { storyHref } from "@/lib/tough/questions";
import { BuildStoryLink } from "./build-story-link";
import { NavIcon, type NavIconName } from "./nav-icons";
import { CollapseButton, NavLink, NavShell } from "./nav-shell";
import { switchMode } from "@/app/promotion/actions";

// The sections reached from every page. Stories live on the home page and are listed below these.
type NavItem = { href: string; label: string; icon: NavIconName; exact?: boolean };

const NAV: readonly NavItem[] = [
  { href: "/", label: "Your prep", icon: "home", exact: true },
  { href: "/profile", label: "Your profile", icon: "user" },
  { href: "/jobs", label: "Target jobs", icon: "briefcase" },
  { href: "/questions", label: "Question library", icon: "book" },
  { href: "/tough-questions", label: "Tough questions", icon: "bolt" },
  { href: "/transcripts", label: "Past interviews", icon: "chat" },
  { href: "/numbers", label: "Your numbers", icon: "chart" },
];

// PromotionMax (beta): the same stories, aimed at the next level instead of a new job.
const PROMOTION_NAV: readonly NavItem[] = [
  { href: "/promotion", label: "Your promotion", icon: "stairs", exact: true },
  { href: "/promotion/packet", label: "Promotion packet", icon: "doc" },
  { href: "/questions", label: "Question library", icon: "book" },
  { href: "/numbers", label: "Your numbers", icon: "chart" },
];

const RECENT_STORIES = 8;

// Read before first paint so a collapsed sidebar doesn't open wide and then snap shut.
const RESTORE_COLLAPSED = `try{if(localStorage.getItem("imx-nav")==="collapsed")document.documentElement.dataset.nav="collapsed"}catch(e){}`;

// The app's navigation: a left sidebar on wide screens (collapsible to icons) and a top bar with a
// menu drawer on phones. Kept under its old name so every page that renders it gets the sidebar.
export function AppHeader() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: RESTORE_COLLAPSED }} />
      <NavShell>
        <div className="flex items-center justify-between gap-2 px-4 pt-5 pb-4 nav-collapsed:px-0 nav-collapsed:justify-center">
          <Link
            href="/"
            className="text-lg font-extrabold tracking-tight text-white"
            aria-label="InterviewMax home"
          >
            <span className="nav-collapsed:hidden">
              Interview<span className="text-accent-400">Max</span>
            </span>
            <span className="hidden nav-collapsed:inline">
              I<span className="text-accent-400">M</span>
            </span>
          </Link>
        </div>

        <div className="px-3 nav-collapsed:px-2">
          <BuildStoryLink />
          <Suspense fallback={<AddJobButton />}>
            <InterviewOnly>
              <AddJobButton />
            </InterviewOnly>
          </Suspense>
          <Suspense fallback={null}>
            <ModeSwitch />
          </Suspense>
        </div>

        <nav aria-label="Sections" className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto px-3 nav-collapsed:px-2">
          <ul className="space-y-1">
            <Suspense fallback={<NavItems items={NAV} />}>
              <Sections />
            </Suspense>
            <Suspense fallback={null}>
              <AdminLink />
            </Suspense>
          </ul>

          <Suspense fallback={null}>
            <InterviewOnly>
              <JobFolders />
            </InterviewOnly>
          </Suspense>

          <div className="mt-6 nav-collapsed:hidden">
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-ink-300">
              Stories
            </p>
            <Suspense fallback={<StoriesSkeleton />}>
              <RecentStories />
            </Suspense>
          </div>
        </nav>

        <div className="border-t border-white/10 px-3 py-3 nav-collapsed:px-2">
          <Suspense fallback={<span className="block h-9 animate-pulse rounded-lg bg-white/10" />}>
            <AccountMenu />
          </Suspense>
          <CollapseButton />
        </div>
      </NavShell>
    </>
  );
}

function AddJobButton() {
  return (
    <Link
      href="/jobs/new"
      title="Add a target job"
      className="mt-2 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/10"
    >
      <NavIcon name="briefcase" />
      <span className="nav-collapsed:sr-only">Add a target job</span>
    </Link>
  );
}

function NavItems({ items }: { items: readonly NavItem[] }) {
  return items.map((item) => (
    <li key={item.href}>
      <NavLink href={item.href} exact={item.exact} label={item.label}>
        <NavIcon name={item.icon} />
      </NavLink>
    </li>
  ));
}

async function Sections() {
  return <NavItems items={(await getAppMode()) === "promotion" ? PROMOTION_NAV : NAV} />;
}

// Job search pieces that PromotionMax doesn't use.
async function InterviewOnly({ children }: { children: React.ReactNode }) {
  return (await getAppMode()) === "promotion" ? null : <>{children}</>;
}

// Interview / Promotion. Everyone sees PromotionMax marked Beta; only those let into the beta can
// switch to it (Craig, Oct 18).
async function ModeSwitch() {
  const user = await getCurrentUser();
  const allowed = canUsePromotion(user.email);
  const mode = await getAppMode();
  const segment =
    "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold";
  const on = `${segment} bg-white text-ink-900`;
  const off = `${segment} text-ink-100 hover:bg-white/10`;
  return (
    <form
      action={switchMode}
      className="mt-3 flex gap-1 rounded-xl bg-white/5 p-1 ring-1 ring-white/10 nav-collapsed:hidden"
      aria-label="Mode"
      data-testid="mode-switch"
    >
      <button
        type="submit"
        name="mode"
        value="interview"
        aria-pressed={mode === "interview"}
        disabled={!allowed || mode === "interview"}
        className={mode === "interview" ? on : off}
      >
        Interview
      </button>
      <button
        type="submit"
        name="mode"
        value="promotion"
        aria-pressed={mode === "promotion"}
        disabled={!allowed || mode === "promotion"}
        title={
          allowed
            ? "PromotionMax: build the case for your next level"
            : "PromotionMax is in beta and not open yet"
        }
        className={`${mode === "promotion" ? on : off} ${allowed ? "" : "cursor-not-allowed opacity-60 hover:bg-transparent"}`}
        data-testid="mode-promotion"
      >
        Promotion
        <span className="rounded-full bg-accent-400/90 px-1.5 text-[0.625rem] font-bold uppercase tracking-wider text-ink-950">
          Beta
        </span>
      </button>
    </form>
  );
}

// Shown only to admins (checked on the server); the admin pages check again before showing anything.
async function AdminLink() {
  const user = await getCurrentUser();
  if (!isAdminEmail(user.email)) return null;
  return (
    <li>
      <NavLink href="/admin" label="Admin">
        <NavIcon name="shield" />
      </NavLink>
    </li>
  );
}

// Each target job as a folder: its page holds everything for that role. Hidden with no jobs.
async function JobFolders() {
  let jobs;
  try {
    jobs = await listJobs();
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
  if (jobs.length === 0) return null;
  return (
    <div className="mt-6 nav-collapsed:hidden">
      <p className="px-3 text-xs font-semibold uppercase tracking-wider text-ink-300">Your jobs</p>
      <ul className="mt-2 space-y-0.5" data-testid="nav-jobs">
        {jobs.map((job) => (
          <li key={job.id}>
            <NavLink href={`/jobs/${job.id}`} label={folderLabel(job)} compact>
              <NavIcon name="folder" />
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function RecentStories() {
  let stories;
  try {
    stories = await listStories();
  } catch (error) {
    unstable_rethrow(error);
    return <p className="mt-2 px-3 text-sm text-ink-300">Couldn&apos;t load your stories.</p>;
  }
  if (stories.length === 0) {
    return <p className="mt-2 px-3 text-sm text-ink-300">No stories yet.</p>;
  }
  const shown = stories.slice(0, RECENT_STORIES);
  return (
    <ul className="mt-2 space-y-0.5" data-testid="nav-stories">
      {shown.map((story) => (
        <li key={story.id}>
          <NavLink href={storyHref(story)} label={story.title || "Untitled story"} compact />
        </li>
      ))}
      {stories.length > shown.length && (
        <li>
          <Link href="/" className="block px-3 py-1.5 text-sm text-ink-300 hover:text-white">
            All {stories.length} stories →
          </Link>
        </li>
      )}
    </ul>
  );
}

function StoriesSkeleton() {
  return (
    <div className="mt-2 space-y-2 px-3">
      <span className="block h-4 w-4/5 animate-pulse rounded bg-white/10" />
      <span className="block h-4 w-3/5 animate-pulse rounded bg-white/10" />
    </div>
  );
}

async function AccountMenu() {
  const user = await getCurrentUser();
  return (
    <div className="flex items-center justify-between gap-2 text-sm nav-collapsed:justify-center">
      <span
        className="min-w-0 truncate px-1 text-ink-200 nav-collapsed:hidden"
        data-testid="user-email"
        title={user.email}
      >
        {user.email}
      </span>
      <Link
        href="/settings"
        title="Settings and your data"
        className="flex shrink-0 items-center rounded-lg p-1.5 text-ink-100 hover:bg-white/10 hover:text-white nav-collapsed:hidden"
        data-testid="settings-link"
      >
        <NavIcon name="settings" />
        <span className="sr-only">Settings</span>
      </Link>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          title="Sign out"
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 font-medium text-ink-100 hover:bg-white/10 hover:text-white"
        >
          <NavIcon name="signout" />
          <span className="nav-collapsed:sr-only">Sign out</span>
        </button>
      </form>
    </div>
  );
}
