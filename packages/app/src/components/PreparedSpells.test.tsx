import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { type Sheet, toSheet } from "../engine/sheet.ts";
import { loadSpellContent, setPrepared } from "../engine/spells.ts";
import { useCharacter } from "../state/character.ts";
import { Builder } from "./Builder.tsx";
import { SpellsPanel } from "./SpellsPanel.tsx";

// The prepare section of the builder's Spells step has the rules of the Spells panel (ORC-288, docs/design/spells-panel.md "The builder").
// These tests are in their own file because a vi.mock applies to the whole file: the mocks of toSheet and of the
// spell lookup below would otherwise touch the tests in Spells.test.tsx.

/** When true, the sheet of the open character has no known prepare limit, as a homebrew class with no prepare count. */
const noLimit = vi.hoisted(() => ({ on: false }));
vi.mock("../engine/sheet.ts", async (importOriginal) => {
  const sheet = await importOriginal<typeof import("../engine/sheet.ts")>();
  return {
    ...sheet,
    toSheet: (...args: Parameters<typeof sheet.toSheet>): Sheet => {
      const result = sheet.toSheet(...args);
      if (!noLimit.on || !result.spellcasting) return result;
      return { ...result, spellcasting: { ...result.spellcasting, casters: result.spellcasting.casters.map((caster) => ({ ...caster, canPrepare: null })) } };
    },
  };
});

/** When true, the spell lookup is null, as while the SRD spells load. */
const noLookup = vi.hoisted(() => ({ on: false }));
vi.mock("../state/spell-records.ts", async (importOriginal) => {
  const records = await importOriginal<typeof import("../state/spell-records.ts")>();
  return { ...records, useSpellLookup: () => (noLookup.on ? null : records.useSpellLookup()) };
});

beforeAll(async () => {
  await loadEngine();
  await loadSpellContent();
});

afterEach(() => {
  cleanup();
  noLimit.on = false;
  noLookup.on = false;
});

const e2eFile = (name: string): StrictEntity => JSON.parse(readFileSync(join(import.meta.dirname, `../../e2e/${name}.strict.json`), "utf8"));
const prepareAll = (entity: StrictEntity, className: string, keys: string[]) =>
  keys.reduce((current, key) => setPrepared(engine(), current, className, key, true), entity);

/** The prepare counts in `root`: [state, text]. */
const counts = (root: ParentNode) =>
  [...root.querySelectorAll("[data-prepare-count]")]
    .filter((count) => !count.closest("[data-pane=spell]"))
    .map((count) => [count.getAttribute("data-prepare-count"), count.textContent]);
/** The prepare boxes in `root`, A to Z: [name, checked, disabled]. */
const boxes = (root: HTMLElement) =>
  within(root)
    .queryAllByRole("checkbox")
    .map((box) => [box.getAttribute("aria-label"), box.getAttribute("aria-checked"), box.getAttribute("aria-disabled") === "true"])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

/** Opens the entity in the builder, on the Spells step. */
async function openBuilder(id: string, entity: StrictEntity) {
  useCharacter.getState().load(id, entity);
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Spells/ }));
  return screen.findByRole("region", { name: /^Prepared spells: / });
}

/** The open panel of the entity, in prepare mode. */
async function openPanel(entity: StrictEntity) {
  const sheet = toSheet(engine().evaluate(entity).built, entity);
  const panel = (
    <SpellsPanel
      open
      onOpenChange={() => {}}
      spellcasting={sheet.spellcasting!}
      classes={sheet.classes}
      builderHref="/b"
      onSpendSlots={() => {}}
      onPrepare={() => {}}
    />
  );
  render(<RouterProvider router={createMemoryRouter([{ path: "/", element: panel }], { initialEntries: ["/"] })} />);
  const dialog = await screen.findByRole("dialog", { name: "Spells" });
  await within(dialog).findAllByRole("heading", { level: 3 });
  fireEvent.click(within(dialog).getByRole("button", { name: "Prepare spells" }));
  return dialog;
}

test("while the spell records load, the section shows its count and no boxes, so no box shows a name from a key", async () => {
  noLookup.on = true;
  const section = await openBuilder("prepared-no-lookup", e2eFile("life-cleric-9"));
  expect(counts(section)).toEqual([["under", "8 of 12 prepared"]]);
  expect(within(section).queryAllByRole("checkbox")).toEqual([]);
  expect(within(section).queryByRole("list")).toBeNull();
  // With the records, the boxes show, with the names of the records.
  noLookup.on = false;
  cleanup();
  const loaded = await openBuilder("prepared-lookup", e2eFile("life-cleric-9"));
  expect(within(loaded).getByRole("checkbox", { name: "Prepared: Command" })).toBeTruthy();
});

test("a class that prepares with no known limit gets a prepare section with no limit: '8 prepared', and each box is on", async () => {
  noLimit.on = true;
  const section = await openBuilder("prepared-no-limit", e2eFile("life-cleric-9"));
  expect(section.getAttribute("aria-label")).toBe("Prepared spells: Cleric");
  expect(counts(section)).toEqual([["no-limit", "8 prepared"]]);
  // No limit: nothing disables a box that can change, and a ninth spell counts.
  const command = within(section).getByRole("checkbox", { name: "Prepared: Command" });
  expect(command).not.toHaveAttribute("aria-disabled", "true");
  fireEvent.click(command);
  expect(counts(screen.getByRole("region", { name: "Prepared spells: Cleric" }))).toEqual([["no-limit", "9 prepared"]]);
});

for (const [state, extra] of [
  ["under", []],
  ["at", ["command", "bane", "sanctuary", "guiding-bolt"]],
  ["over", ["command", "bane", "sanctuary", "guiding-bolt", "detect-magic"]],
] as const) {
  test(`the panel and the builder give the same count and the same boxes for the same character (${state} the limit)`, async () => {
    const entity = prepareAll(e2eFile("life-cleric-9"), "Cleric", [...extra]);
    const section = await openBuilder(`prepared-same-${state}`, entity);
    const builder = { counts: counts(section), boxes: boxes(section) };
    cleanup();
    const dialog = await openPanel(entity);
    expect(builder.counts[0]![0]).toBe(state);
    expect(builder.counts).toEqual(counts(dialog));
    expect(builder.boxes.length).toBeGreaterThan(0);
    expect(builder.boxes).toEqual(boxes(dialog));
  });
}
