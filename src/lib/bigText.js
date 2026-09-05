// "Bigger text" preference — shared by the Home nav button and Settings,
// so both flip the same thing: a class on <html> that scales all rem-based
// text, plus a localStorage copy so it survives reloads.
export function applyBigText(enabled) {
  document.documentElement.classList.toggle("big-text", enabled);
  try {
    localStorage.setItem("ab-big-text", enabled ? "1" : "0");
  } catch (e) {
    /* private mode — the class alone is enough for this session */
  }
}

export function readBigText() {
  try {
    return localStorage.getItem("ab-big-text") === "1";
  } catch (e) {
    return false;
  }
}