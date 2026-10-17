import { useEffect } from 'react';

/**
 * Publishes --back-bar-h: the live height of the pinned Back bar on the
 * current page (0 when the page has none). Page search/filter toolbars use it
 * to stick directly below the Back bar (see GlobalBackButton.css).
 */
const BAR_SELECTOR = '.page-content .crednivo-global-back-row, .page-content .module-header.module-header-actions-only';

export default function StickyOffsets() {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    let resizeObserver;
    let observedBar = null;

    const publish = () => {
      frame = 0;
      const bar = document.querySelector(BAR_SELECTOR);
      if (bar !== observedBar) {
        resizeObserver?.disconnect();
        observedBar = bar;
        if (bar && typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(publish);
          resizeObserver.observe(bar);
        }
      }
      const height = bar ? Math.round(bar.getBoundingClientRect().height) : 0;
      root.style.setProperty('--back-bar-h', `${height}px`);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(publish); };

    schedule();
    // Pages swap their content on navigation / data load: re-measure when the DOM changes.
    const mutationObserver = new MutationObserver(schedule);
    const main = document.querySelector('.page-content') || document.body;
    mutationObserver.observe(main, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return null;
}
