import {
  RageDetector,
  cleanPath,
  describeElement,
  errorLabel,
  isTrackedPath,
} from "@/lib/signals/detect";
import { MAX_BATCH, type Signal, type SignalKind } from "@/lib/signals/kinds";

// Records signs that someone is confused or stuck, so the admin panel can show where testers
// struggle: pages opened, where they left, rage clicks, clicks that do nothing, clicks on
// disabled buttons, errors shown, page errors, and forms they typed in but didn't send.
// Nothing typed or shown on the page is sent: elements are described by their tag and the app's
// own labels (see describeElement). Signals go to /api/signals in small batches, and anything
// that goes wrong here is swallowed: tracking must never break the app.

const ENDPOINT = "/api/signals";
const FLUSH_MS = 10_000;
const PATH_CHECK_MS = 1000;
const DEAD_CLICK_MS = 1000;
// A ceiling per page load, in case something loops.
const MAX_SIGNALS = 300;

const INTERACTIVE =
  'a[href], button, input, select, textarea, label, summary, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="radio"], [role="menuitem"], [role="option"], [role="switch"], [contenteditable="true"], [contenteditable=""]';
// Clicks that should visibly do something. Inputs and labels are left out: focusing a field
// rightly changes nothing on the page.
const ACTIONABLE = 'a[href], button, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"]';
const DISABLED = 'button:disabled, input:disabled, select:disabled, [aria-disabled="true"]';
const TEXT_FIELDS = "input, textarea, select";
const SKIP_INPUT_TYPES = new Set(["hidden", "submit", "button", "reset", "checkbox", "radio", "file"]);

let queue: Signal[] = [];
let recorded = 0;
let currentPath = cleanPath(window.location.href);
const rage = new RageDetector();
// Forms (or loose fields) the user typed in and hasn't sent, with their labels.
const touched = new Map<Element, string>();
// The text last seen in each alert, compared only to spot a new error; never sent.
const alertsSeen = new WeakMap<Element, string>();

function record(kind: SignalKind, target = "", path = currentPath) {
  if (!isTrackedPath(path) || recorded >= MAX_SIGNALS) return;
  recorded++;
  queue.push({ kind, path, target, at: Date.now() });
  if (queue.length >= MAX_BATCH) flush(false);
}

function flush(leaving: boolean) {
  if (queue.length === 0) return;
  const body = JSON.stringify({ signals: queue });
  queue = [];
  try {
    if (leaving && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
    } else {
      void fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Dropped; never worth breaking the page over.
  }
}

function label(el: Element): string {
  return describeElement({
    tag: el.tagName,
    testId: el.getAttribute("data-testid"),
    id: el.id || null,
    name: el.getAttribute("name"),
    href: el instanceof HTMLAnchorElement ? el.getAttribute("href") : null,
    type: el.getAttribute("type"),
    within: el.parentElement?.closest("[data-testid]")?.getAttribute("data-testid") ?? null,
  });
}

function hasTypedValue(el: Element): boolean {
  const fields = el instanceof HTMLFormElement ? Array.from(el.elements) : [el];
  return fields.some((f) => {
    if (!(f instanceof HTMLInputElement || f instanceof HTMLTextAreaElement)) return false;
    if (f instanceof HTMLInputElement && SKIP_INPUT_TYPES.has(f.type)) return false;
    return f.value.trim().length > 0;
  });
}

// Forms still on the page with something typed in them, left without sending.
function reportAbandoned() {
  for (const [el, target] of touched) {
    if (el.isConnected && hasTypedValue(el)) record("form_abandoned", target);
  }
  touched.clear();
}

function enterPath(path: string) {
  if (path === currentPath) return;
  currentPath = path;
  record("page_view");
}

function onClick(event: MouseEvent) {
  const el = event.target instanceof Element ? event.target : null;
  if (!el) return;
  const hit = el.closest(INTERACTIVE) ?? el;

  if (rage.add({ x: event.clientX, y: event.clientY, at: event.timeStamp })) {
    record("rage_click", label(hit));
  }

  // A click on a button inside a form counts as trying to send it.
  const button = el.closest("button");
  if (button) {
    if (button.form) touched.delete(button.form);
    for (const key of touched.keys()) if (!(key instanceof HTMLFormElement)) touched.delete(key);
  }

  const actionable = el.closest(ACTIONABLE);
  const looksClickable = !el.closest(INTERACTIVE) && getComputedStyle(el).cursor === "pointer";
  if (!actionable && !looksClickable) return;
  const target = label(actionable ?? el);
  const before = window.location.href;
  let changed = false;
  const watcher = new MutationObserver(() => {
    changed = true;
  });
  watcher.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  window.setTimeout(() => {
    watcher.disconnect();
    if (!changed && window.location.href === before) record("dead_click", target);
  }, DEAD_CLICK_MS);
}

function onPointerDown(event: PointerEvent) {
  const el = event.target instanceof Element ? event.target.closest(DISABLED) : null;
  if (el) record("disabled_click", label(el));
}

function onInput(event: Event) {
  const el = event.target instanceof Element ? event.target : null;
  if (!el?.matches(TEXT_FIELDS)) return;
  const key = (el as HTMLInputElement).form ?? el;
  if (!touched.has(key)) touched.set(key, label(key));
}

function onSubmit(event: SubmitEvent) {
  if (event.target instanceof Element) touched.delete(event.target);
}

let scanQueued = false;
function scanAlerts() {
  scanQueued = false;
  for (const el of document.querySelectorAll('[role="alert"]')) {
    const text = (el.textContent ?? "").trim();
    if (text && alertsSeen.get(el) !== text) record("error_shown", label(el));
    alertsSeen.set(el, text);
  }
}

function queueAlertScan() {
  if (scanQueued) return;
  scanQueued = true;
  window.requestAnimationFrame(scanAlerts);
}

try {
  record("page_view");
  document.addEventListener("click", onClick, true);
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("input", onInput, true);
  document.addEventListener("submit", onSubmit, true);
  window.addEventListener("error", (e) => record("js_error", errorLabel(e.message)));
  window.addEventListener("unhandledrejection", (e) =>
    record("js_error", errorLabel((e.reason as Error | undefined)?.message ?? e.reason)),
  );
  window.addEventListener("pagehide", () => {
    reportAbandoned();
    record("left");
    flush(true);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
  new MutationObserver(queueAlertScan).observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
  });
  queueAlertScan();
  window.setInterval(() => flush(false), FLUSH_MS);
  // Catches path changes the router hook doesn't see, such as a redirect after a form is sent.
  window.setInterval(() => {
    const path = cleanPath(window.location.href);
    if (path === currentPath) return;
    touched.clear();
    enterPath(path);
  }, PATH_CHECK_MS);
  window.addEventListener("popstate", () => enterPath(cleanPath(window.location.href)));
} catch {
  // Tracking is optional.
}

export function onRouterTransitionStart(url: string) {
  try {
    reportAbandoned();
    enterPath(cleanPath(url));
  } catch {
    // Tracking is optional.
  }
}
