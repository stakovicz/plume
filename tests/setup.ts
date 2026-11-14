// paper.js (path booleans) probes a 2D canvas when it loads: jsdom has none, and under plain Node paper
// builds its own jsdom. Booleans never draw, so a no-op context (jsdom) or no window at all (Node) will do.
if (typeof HTMLCanvasElement === 'undefined') (globalThis as { self?: unknown }).self ??= globalThis;
else HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
  return new Proxy({ canvas: this }, { get: (t, k) => (k in t ? t[k as 'canvas'] : () => {}) });
} as never;

// Node's navigator.language follows the system locale: pin English so the UI strings tests expect (layer names…)
// don't depend on the machine running them. Runs before each test file imports #lib/i18n.
if (globalThis.navigator) Object.defineProperty(globalThis.navigator, 'language', { value: 'en-US', configurable: true });
