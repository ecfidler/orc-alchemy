// Adds the jest-dom matchers, for example toBeChecked(), to every test's expect.
import "@testing-library/jest-dom/vitest";
import { afterAll } from "vitest";

// jsdom has no ResizeObserver, which the character sheet uses to measure its width.
// A jsdom element has no width, so the sheet keeps layout F; a test that wants the tabs stubs the width.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// A test that changes the open character starts the autosave timer. A save that ends after the
// file's jsdom window is gone throws "window is not defined", so each file ends its saves first.
afterAll(async () => {
  const { flushAutosave } = await import("./state/character.ts");
  await flushAutosave().catch(() => {});
});
