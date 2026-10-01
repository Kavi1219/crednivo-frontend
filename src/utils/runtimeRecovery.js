/**
 * Recovering from "Failed to fetch dynamically imported module".
 *
 * Every deploy gives the page files new names (Collection-AbC123.js). A tab or
 * the Android app that was opened before the deploy still asks for the OLD
 * names, which no longer exist on the server. The cure is to load the page
 * again so it picks up the new file names.
 *
 * - Attempt 1: normal reload.
 * - Attempt 2: reload with a "?_v=" stamp so no cache can hand back the old page.
 * - After that we stop and show the error screen (no endless reload loop).
 */
const ATTEMPTS_KEY = 'crednivo-stale-chunk-attempts';
const ATTEMPT_WINDOW_MS = 2 * 60 * 1000;
const MAX_ATTEMPTS = 2;
const BUST_PARAM = '_v';

let reloadInFlight = false;

export function isStaleChunkError(error) {
  const message = String(error?.message || error || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading chunk .* failed|ChunkLoadError|is not a valid JavaScript MIME type/i.test(message);
}

function readAttempts() {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(ATTEMPTS_KEY) || 'null');
    if (saved && Date.now() - saved.firstAt < ATTEMPT_WINDOW_MS) return saved;
  } catch {
    // Ignore unreadable storage.
  }
  return { count: 0, firstAt: Date.now() };
}

function writeAttempts(value) {
  try { window.sessionStorage.setItem(ATTEMPTS_KEY, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

/** Load the current page again, skipping every cache. */
export function hardReload() {
  reloadInFlight = true;
  const url = new URL(window.location.href);
  url.searchParams.set(BUST_PARAM, String(Date.now()));
  window.location.replace(url.toString());
}

/** Returns true when a reload is happening, so callers should NOT show an error. */
export function recoverFromStaleChunk(error) {
  if (typeof window === 'undefined' || !isStaleChunkError(error)) return false;
  // Several places can report the same failure at once (route import, CSS preload,
  // error boundary). Only the first one reloads; the rest just wait for it.
  if (reloadInFlight) return true;

  const attempts = readAttempts();
  if (attempts.count >= MAX_ATTEMPTS) return false;
  writeAttempts({ count: attempts.count + 1, firstAt: attempts.firstAt });

  if (attempts.count === 0) {
    reloadInFlight = true;
    window.location.reload();
  } else {
    hardReload();
  }
  return true;
}

/** Call once a page has loaded fine: resets the attempts and tidies the "?_v=" stamp out of the address bar. */
export function clearStaleChunkReloadGuard() {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.removeItem(ATTEMPTS_KEY); } catch { /* storage unavailable */ }
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has(BUST_PARAM)) {
      url.searchParams.delete(BUST_PARAM);
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
  } catch { /* ignore */ }
}
