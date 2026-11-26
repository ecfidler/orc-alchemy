// Adds the jest-dom matchers, for example toBeChecked(), to every test's expect.
import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";
import { afterAll } from "vitest";

// Each findBy and waitFor waits up to 5 s, not 1 s (ORC-361). On a loaded CI runner, a wait for a save or for the
// engine can take more than 1 s. The short default made such tests fail at random. A wait that needs more names its own.
configure({ asyncUtilTimeout: 5_000 });

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
