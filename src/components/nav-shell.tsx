"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { NavIcon } from "./nav-icons";

// The sidebar frame. On wide screens it's fixed to the left; on phones it's a drawer opened from
// the top bar, and following any link inside it closes it.
export function NavShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-950/20 bg-ink-900 px-4 py-3 lg:hidden">
        <Link href="/" className="text-lg font-extrabold tracking-tight text-white">
          Interview<span className="text-accent-400">Max</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="app-nav"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-100 ring-1 ring-white/20 hover:bg-white/10"
        >
          <NavIcon name="menu" />
          Menu
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-ink-950/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        id="app-nav"
        data-open={open || undefined}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
        className="fixed inset-y-0 left-0 z-50 invisible flex w-72 max-w-[85vw] -translate-x-full flex-col data-open:visible lg:visible bg-ink-900 shadow-xl transition-transform duration-200 data-open:translate-x-0 lg:z-30 lg:w-64 lg:translate-x-0 lg:shadow-none nav-collapsed:w-18"
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute top-4 right-3 rounded-lg p-1.5 text-ink-200 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close menu"
        >
          <NavIcon name="close" />
        </button>
        {children}
      </aside>
    </>
  );
}

// A sidebar link that shows when you're on its page. The pathname is only known per request on
// story pages, so the highlight streams in after the link itself.
export function NavLink(props: {
  href: string;
  label: string;
  exact?: boolean;
  compact?: boolean;
  children?: ReactNode;
}) {
  return (
    <Suspense fallback={<NavLinkBody {...props} active={false} />}>
      <ActiveNavLink {...props} />
    </Suspense>
  );
}

function ActiveNavLink(props: Parameters<typeof NavLink>[0]) {
  const pathname = usePathname();
  const active = props.exact
    ? pathname === props.href
    : pathname === props.href || pathname.startsWith(`${props.href}/`);
  return <NavLinkBody {...props} active={active} />;
}

function NavLinkBody({
  href,
  label,
  compact,
  children,
  active,
}: Parameters<typeof NavLink>[0] & { active: boolean }) {
  return (
    <Link
      href={href}
      title={label}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 font-medium transition nav-collapsed:justify-center nav-collapsed:px-0 ${
        compact ? "py-1.5 text-sm" : "py-2 text-[0.9375rem]"
      } ${
        active
          ? "bg-white/10 text-white shadow-[inset_3px_0_0_var(--color-accent-400)]"
          : "text-ink-100 hover:bg-white/5 hover:text-white"
      }`}
    >
      {children}
      <span className={`truncate ${children ? "nav-collapsed:sr-only" : ""}`}>{label}</span>
    </Link>
  );
}

// Shrinks the sidebar to icons on wide screens. The choice is kept in this browser.
export function CollapseButton() {
  const toggle = () => {
    const root = document.documentElement;
    const collapsed = root.dataset.nav !== "collapsed";
    if (collapsed) root.dataset.nav = "collapsed";
    else delete root.dataset.nav;
    try {
      localStorage.setItem("imx-nav", collapsed ? "collapsed" : "open");
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={toggle}
      title="Collapse or expand the sidebar"
      className="mt-2 hidden w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-300 hover:bg-white/5 hover:text-white lg:flex nav-collapsed:justify-center"
    >
      <span className="nav-collapsed:rotate-180">
        <NavIcon name="collapse" />
      </span>
      <span className="nav-collapsed:sr-only">Collapse</span>
    </button>
  );
}
