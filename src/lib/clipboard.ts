// Copies text for the Copy buttons. The Clipboard API is missing or blocked in some places testers
// use (in-app browsers, embedded previews, a page that lost focus while a call ran), and a silent
// failure reads as a broken button (tester feedback, Oct 16), so fall back to a hidden textarea and
// report whether either way worked.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the older way.
  }
  return copyWithTextarea(text);
}

function copyWithTextarea(text: string): boolean {
  if (typeof document === "undefined") return false;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "0";
  area.style.opacity = "0";
  document.body.appendChild(area);
  const active = document.activeElement as HTMLElement | null;
  area.select();
  area.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  active?.focus?.({ preventScroll: true });
  return ok;
}

export const COPY_FAILED = "Copying didn't work in this browser. Select the text and copy it instead.";
