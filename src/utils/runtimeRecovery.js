const STALE_CHUNK_RELOAD_KEY = 'crednivo-stale-chunk-reload-at';
const RELOAD_GUARD_MS = 15000;

export function isStaleChunkError(error) {
  const message = String(error?.message || error || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading chunk .* failed|ChunkLoadError/i.test(message);
}

export function recoverFromStaleChunk(error) {
  if (typeof window === 'undefined' || !isStaleChunkError(error)) return false;

  try {
    const now = Date.now();
    const lastReload = Number(window.sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY) || 0);
    if (now - lastReload < RELOAD_GUARD_MS) return false;
    window.sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, String(now));
  } catch {
    // Storage can be unavailable; a one-time reload is still safer than a dead page.
  }

  window.location.reload();
  return true;
}

export function clearStaleChunkReloadGuard() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STALE_CHUNK_RELOAD_KEY);
  } catch {
    // Ignore storage access failures.
  }
}
