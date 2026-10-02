/**
 * jsdom preload for bun test — provides the DOM environment that component
 * tests need (Radix, testing-library/user-event). Loaded via bunfig.toml
 * [test] preload. Committed to git so sandbox resets cannot remove it again.
 */
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:3000/",
  pretendToBeVisual: true,
  userAgent: "bun-test-jsdom",
});

const { window } = dom;

function defineGlobal(key: string, value: unknown) {
  try {
    Object.defineProperty(globalThis, key, {
      value,
      writable: true,
      configurable: true,
    });
  } catch {
    /* ignore non-configurable globals */
  }
}

// Copy enumerable window properties onto globalThis
for (const key of Object.getOwnPropertyNames(window)) {
  if (key in globalThis) continue;
  let value: unknown;
  try {
    value = (window as unknown as Record<string, unknown>)[key];
  } catch {
    continue;
  }
  defineGlobal(key, value);
}

// Core globals (some are getter-only on globalThis in newer runtimes)
defineGlobal("window", window);
defineGlobal("document", window.document);
defineGlobal("navigator", window.navigator);
defineGlobal("HTMLElement", window.HTMLElement);
defineGlobal("Element", window.Element);
defineGlobal("Node", window.Node);
defineGlobal("Event", window.Event);
defineGlobal("CustomEvent", window.CustomEvent);
defineGlobal("KeyboardEvent", window.KeyboardEvent);
defineGlobal("MouseEvent", window.MouseEvent);
defineGlobal("FocusEvent", window.FocusEvent);
defineGlobal("getComputedStyle", window.getComputedStyle.bind(window));
defineGlobal(
  "requestAnimationFrame",
  window.requestAnimationFrame?.bind(window) ??
    ((cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16))
);
defineGlobal(
  "cancelAnimationFrame",
  window.cancelAnimationFrame?.bind(window) ?? ((id: number) => clearTimeout(id))
);

// matchMedia — Radix uses it for hover/pointer queries
if (typeof window.matchMedia !== "function") {
  (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (
    query: string
  ) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
defineGlobal(
  "matchMedia",
  (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia
);

// ResizeObserver — Radix popovers/dialogs observe elements
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  defineGlobal("ResizeObserver", ResizeObserverStub);
}

// scrollIntoView — used by Radix select/accordion on focus
if (window.Element && !window.Element.prototype.scrollIntoView) {
  window.Element.prototype.scrollIntoView = function scrollIntoView() {};
}

// PointerEvent — user-event pointer sequences under jsdom
if (window.PointerEvent === undefined) {
  (window as unknown as { PointerEvent?: unknown }).PointerEvent = window.MouseEvent;
  defineGlobal("PointerEvent", window.MouseEvent);
}

// Register jest-dom matchers AFTER the DOM exists — a static import would
// evaluate @testing-library/dom's `screen` before document exists and cache
// the throwing variant.
await import("@testing-library/jest-dom");

export {};
