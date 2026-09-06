// A note written on the landing page before there was an account to save it
// to. It waits here across the sign-in redirect, and the home page creates
// it for real on the way back in.

const KEY = "buddy:pending-note";

export function savePendingNote(pending) {
  try {
    localStorage.setItem(KEY, JSON.stringify(pending));
  } catch (_) {
    /* private browsing — the note just doesn't survive the trip */
  }
}

export function readPendingNote() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function clearPendingNote() {
  try {
    localStorage.removeItem(KEY);
  } catch (_) {
    /* nothing to clear */
  }
}
