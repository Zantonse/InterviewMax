// Signs of confusion recorded while someone uses the app. Keep in step with the check on
// ui_signals.kind (supabase/migrations/20261016030000_ui_signals.sql).
export const SIGNAL_KINDS = [
  "page_view",
  "left",
  "rage_click",
  "dead_click",
  "disabled_click",
  "error_shown",
  "js_error",
  "form_abandoned",
] as const;

export type SignalKind = (typeof SIGNAL_KINDS)[number];

export function isSignalKind(value: unknown): value is SignalKind {
  return typeof value === "string" && (SIGNAL_KINDS as readonly string[]).includes(value);
}

export const SIGNAL_LABELS: Record<SignalKind, string> = {
  page_view: "Opened",
  left: "Left or reloaded",
  rage_click: "Rage-clicked",
  dead_click: "Clicked something that didn't respond",
  disabled_click: "Clicked a disabled button",
  error_shown: "Saw an error",
  js_error: "Page error",
  form_abandoned: "Started a form and left it",
};

// The kinds that suggest someone was stuck, as opposed to just moving around.
export const FRICTION_KINDS: ReadonlySet<SignalKind> = new Set([
  "rage_click",
  "dead_click",
  "disabled_click",
  "error_shown",
  "js_error",
  "form_abandoned",
]);

export const MAX_PATH_LENGTH = 200;
export const MAX_TARGET_LENGTH = 160;
// Most signals one request may carry; the browser sends in batches.
export const MAX_BATCH = 50;

export type Signal = { kind: SignalKind; path: string; target: string; at: number };
