import '@testing-library/jest-dom/vitest';

/**
 * jsdom implements neither of these, and both are reached on import or first
 * render rather than behind a feature check: `useIsMobile` calls
 * `window.matchMedia` on mount, and every recharts container observes its own
 * box. Without the stubs most of the app simply throws in the test harness.
 */

if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
