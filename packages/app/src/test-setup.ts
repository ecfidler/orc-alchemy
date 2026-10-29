// Adds the jest-dom matchers, for example toBeChecked(), to every test's expect.
import "@testing-library/jest-dom/vitest";

// jsdom has no ResizeObserver, which the character sheet uses to measure its width.
// A jsdom element has no width, so the sheet keeps layout F; a test that wants the tabs stubs the width.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
