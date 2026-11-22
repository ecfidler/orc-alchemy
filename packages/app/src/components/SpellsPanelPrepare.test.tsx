import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Button } from "@orc-alchemy/ui";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test } from "vitest";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { type PrepareSpell, type Spellcasting, toSheet } from "../engine/sheet.ts";
import { loadSpellContent, setPrepared } from "../engine/spells.ts";
import { SpellsPanel } from "./SpellsPanel.tsx";

// Prepared spells in the Spells panel (ORC-287, docs/design/spells-panel.md "The prepare bar" and "Preparing spells").

beforeAll(async () => {
  await loadEngine();
  await loadSpellContent();
});

afterEach(cleanup);

const e2eFile = (name: string): StrictEntity => JSON.parse(readFileSync(join(import.meta.dirname, `../../e2e/${name}.strict.json`), "utf8"));
const prepareAll = (entity: StrictEntity, className: string, keys: string[]) =>
  keys.reduce((current, key) => setPrepared(engine(), current, className, key, true), entity);

/**
 * The open panel of a character, with the sheet's prepare handler on a live entity, and an "Open spells" button that
 * opens it again after a close. `change` changes the Spellcasting of the sheet before the panel gets it.
 */
async function renderLive(start: StrictEntity, change: (spellcasting: Spellcasting) => Spellcasting = (s) => s) {
  const entities: StrictEntity[] = [];
  function Live() {
    const [entity, setEntity] = useState(start);
    const [open, setOpen] = useState(true);
    const sheet = toSheet(engine().evaluate(entity).built, entity);
    const prepare: PrepareSpell = (spell, prepared) =>
      setEntity((current) => {
        const next = setPrepared(engine(), current, spell.source, spell.key, prepared);
        entities.push(next);
        return next;
      });
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open spells</Button>
        <SpellsPanel
          open={open}
          onOpenChange={setOpen}
          spellcasting={change(sheet.spellcasting!)}
          classes={sheet.classes}
          builderHref="/b"
          onSpendSlots={() => {}}
          onPrepare={prepare}
        />
      </>
    );
  }
  render(<RouterProvider router={createMemoryRouter([{ path: "/", element: <Live /> }], { initialEntries: ["/"] })} />);
  const dialog = await screen.findByRole("dialog", { name: "Spells" });
  await within(dialog).findAllByRole("heading", { level: 3 });
  return { dialog, entities };
}

const rowNames = (dialog: HTMLElement) => [...dialog.querySelectorAll("[data-spell-row]")].map((row) => row.textContent);
/** A row by the start of its accessible name: the spell name, then in prepare mode the state. */
const row = (dialog: HTMLElement, name: string) => within(dialog).getByRole("button", { name: new RegExp(`^${name}( ?(Ritual|Concentration))*(,|$)`) });
const box = (dialog: HTMLElement, name: string) => within(dialog).getByRole("checkbox", { name: `Prepared: ${name}` });
/** The counts of the bar: [state, text]. */
const counts = (dialog: HTMLElement) =>
  [...dialog.querySelectorAll("[data-prepare-count]")]
    .filter((count) => !count.closest("[data-pane=spell]"))
    .map((count) => [count.getAttribute("data-prepare-count"), count.textContent]);
const modeButton = (dialog: HTMLElement) => within(dialog).getByRole("button", { name: /^(Prepare spells|Done)$/ });
const liveText = (dialog: HTMLElement) => dialog.querySelector("[aria-live=polite]")!.textContent!.replace(" ", "");
const view = (dialog: HTMLElement) => within(dialog.querySelector<HTMLElement>("[data-pane=spell]")!).getByRole("region");

test("the bar has the count and Prepare spells; prepare mode shows the spells to prepare, A to Z, with a box at the left of each row", async () => {
  const { dialog } = await renderLive(e2eFile("life-cleric-9"));
  expect(counts(dialog)).toEqual([["under", "8 of 12 prepared"]]);
  // No box outside prepare mode, and the spells that the cleric has not prepared do not show.
  expect(within(dialog).queryAllByRole("checkbox")).toEqual([]);
  expect(rowNames(dialog)).toHaveLength(22);
  expect(within(dialog).queryByRole("button", { name: /^Command/ })).toBeNull();

  fireEvent.click(modeButton(dialog));
  expect(modeButton(dialog).textContent).toBe("Done");
  // One button with no pressed state.
  expect([modeButton(dialog).hasAttribute("aria-pressed"), within(dialog).getAllByRole("button", { name: /^(Prepare spells|Done)$/ })]).toEqual([
    false,
    [modeButton(dialog)],
  ]);
  const firstLevel = [...dialog.querySelectorAll('[data-spell-level="1"] [data-spell-row]')].map((element) => element.getAttribute("aria-label") ?? "");
  expect(firstLevel.slice(0, 6)).toEqual([
    "Bane, not prepared Concentration",
    "Bless, always prepared Concentration",
    "Command, not prepared",
    "Create or Destroy Water, not prepared",
    "Cure Wounds, always prepared",
    "Detect Evil and Good, not prepared Concentration",
  ]);
  expect(firstLevel).toEqual([...firstLevel].sort((a, b) => a.localeCompare(b)));
  // A cantrip has no box, and no state in its name.
  expect(row(dialog, "Guidance").getAttribute("aria-label")).toBeNull();
  expect(within(dialog.querySelector('[data-spell-row="Cleric/guidance"]')!.closest("li")!).queryByRole("checkbox")).toBeNull();
  // A spell that can change: an empty box out of the Tab order, with the state in the row name.
  expect(row(dialog, "Command").getAttribute("aria-label")).toBe("Command, not prepared");
  expect([box(dialog, "Command").getAttribute("aria-checked"), box(dialog, "Command").tabIndex]).toEqual(["false", -1]);
  expect(box(dialog, "Healing Word").getAttribute("aria-checked")).toBe("true");
  expect(row(dialog, "Healing Word").getAttribute("aria-label")).toBe("Healing Word, prepared");
  // The box is beside the row button, not in it.
  expect(row(dialog, "Command").contains(box(dialog, "Command"))).toBe(false);
});

test("a click on a box prepares the spell and changes only the box: the selection stays, and a live region says the count", async () => {
  const { dialog, entities } = await renderLive(e2eFile("life-cleric-9"));
  fireEvent.click(modeButton(dialog));
  expect(row(dialog, "Guidance").getAttribute("aria-current")).toBe("true");
  fireEvent.click(box(dialog, "Command"));
  expect(box(dialog, "Command").getAttribute("aria-checked")).toBe("true");
  expect(counts(dialog)).toEqual([["under", "9 of 12 prepared"]]);
  expect(row(dialog, "Guidance").getAttribute("aria-current")).toBe("true");
  expect(liveText(dialog)).toBe("Cleric: 9 of 12 prepared");
  expect(entities).toHaveLength(1);
  // A click on the row selects the spell, and does not change the box.
  fireEvent.click(row(dialog, "Command"));
  expect(row(dialog, "Command").getAttribute("aria-current")).toBe("true");
  expect(box(dialog, "Command").getAttribute("aria-checked")).toBe("true");
  expect(entities).toHaveLength(1);
  // A second click on the box stops preparing it.
  fireEvent.click(box(dialog, "Command"));
  expect(counts(dialog)).toEqual([["under", "8 of 12 prepared"]]);
  expect(liveText(dialog)).toBe("Cleric: 8 of 12 prepared");
});

test("Space on a row changes its box, and Enter selects the spell; Space on an always-prepared row changes nothing", async () => {
  const { dialog, entities } = await renderLive(e2eFile("life-cleric-9"));
  fireEvent.click(modeButton(dialog));
  const command = row(dialog, "Command");
  command.focus();
  fireEvent.keyDown(command, { key: " " });
  fireEvent.keyUp(command, { key: " " });
  expect(row(dialog, "Command").getAttribute("aria-label")).toBe("Command, prepared");
  expect(box(dialog, "Command").getAttribute("aria-checked")).toBe("true");
  // A key that repeats while it is held does not change the box again.
  fireEvent.keyDown(command, { key: " ", repeat: true });
  expect(entities).toHaveLength(1);
  const bless = row(dialog, "Bless");
  fireEvent.keyDown(bless, { key: " " });
  expect(entities).toHaveLength(1);
});

test("a domain spell has a filled box that cannot change and the label Always prepared, and it is not in the count", async () => {
  const { dialog, entities } = await renderLive(e2eFile("life-cleric-9"));
  fireEvent.click(modeButton(dialog));
  const bless = box(dialog, "Bless");
  expect([bless.getAttribute("aria-checked"), bless.getAttribute("aria-disabled")]).toEqual(["true", "true"]);
  fireEvent.click(bless);
  expect(entities).toHaveLength(0);
  expect(row(dialog, "Bless").textContent).toBe("BlessAlways preparedC");
  // The visible label is hidden from a screen reader: the name says the state once.
  expect(within(row(dialog, "Bless")).getByText("Always prepared").getAttribute("aria-hidden")).toBe("true");
  expect(row(dialog, "Bless").getAttribute("aria-label")).toBe("Bless, always prepared Concentration");
  expect(row(dialog, "Bless").querySelector("svg[aria-hidden=true]")).not.toBeNull();
  expect(counts(dialog)).toEqual([["under", "8 of 12 prepared"]]);
});

test("the count in each state: at the limit it shows only in prepare mode; over the limit it says how many to remove, in the two modes", async () => {
  // The Life cleric 9 has a limit of 12 and 8 prepared spells.
  const { dialog } = await renderLive(prepareAll(e2eFile("life-cleric-9"), "Cleric", ["command", "bane", "sanctuary", "guiding-bolt"]));
  expect(counts(dialog)).toEqual([]);
  fireEvent.click(modeButton(dialog));
  expect(counts(dialog)).toEqual([["at", "12 of 12 prepared"]]);
  // Nothing stops a 13th spell.
  fireEvent.click(box(dialog, "Detect Magic"));
  expect(counts(dialog)).toEqual([["over", "13 of 12 prepared. Remove 1 spell."]]);
  expect(liveText(dialog)).toBe("Cleric: 13 of 12 prepared. Remove 1 spell.");
  fireEvent.click(modeButton(dialog));
  expect(counts(dialog)).toEqual([["over", "13 of 12 prepared. Remove 1 spell."]]);
});

test("a class with no known limit shows the count in plain text", async () => {
  const { dialog } = await renderLive(e2eFile("life-cleric-9"), (spellcasting) => ({
    ...spellcasting,
    casters: spellcasting.casters.map((caster) => ({ ...caster, canPrepare: null })),
  }));
  expect(counts(dialog)).toEqual([["no-limit", "8 prepared"]]);
});

test("a sorcerer and a warlock: no count, no button and no boxes", async () => {
  const { dialog } = await renderLive(e2eFile("warlock-10-sorcerer-9"));
  expect(counts(dialog)).toEqual([]);
  expect(within(dialog).queryByRole("button", { name: "Prepare spells" })).toBeNull();
  expect(within(dialog).queryAllByRole("checkbox")).toEqual([]);
  // The bar has only the builder link.
  expect(within(dialog).getByRole("link", { name: "Change known spells in the builder" })).toBeTruthy();
});

test("two classes that prepare: each count has the class name first", async () => {
  const { dialog } = await renderLive(e2eFile("life-cleric-9"), (spellcasting) => ({
    ...spellcasting,
    casters: [...spellcasting.casters, { ...spellcasting.casters[0]!, name: "Wizard", canPrepare: 4 }],
  }));
  expect(counts(dialog)).toEqual([
    ["under", "Cleric: 8 of 12 prepared"],
    ["under", "Wizard: 0 of 4 prepared"],
  ]);
});

test("a cleric 3 / wizard 2: the counts follow the class line of the header, the cleric first", async () => {
  const e = engine();
  const q = (key: string) => `~:orcpub.dnd.e5.character/${key}`;
  let entity = e.setField(
    e.emptyCharacter(),
    ["ability-scores", "standard-scores"],
    Object.fromEntries(Object.entries({ str: 8, dex: 12, con: 13, int: 14, wis: 16, cha: 10 }).map(([a, n]) => [q(a), n])),
  );
  entity = e.setClass(entity, 0, "cleric");
  for (let n = 2; n <= 3; n++) entity = e.addLevel(entity, "cleric");
  entity = e.addClass(entity, "wizard");
  entity = e.addLevel(entity, "wizard");
  entity = e.select(entity, ["class", "cleric", "levels", "level-1", "divine-domain"], "life-domain");
  for (const key of ["alarm", "shield"]) entity = e.select(entity, ["class", "wizard", "wizard-spells-known"], key);
  const { dialog } = await renderLive(prepareAll(entity, "Cleric", ["command"]));
  expect(within(dialog).getByText("Cleric 3 / Wizard 2")).toBeTruthy();
  expect(counts(dialog).map(([, text]) => text!.split(":")[0])).toEqual(["Cleric", "Wizard"]);
  expect(counts(dialog)[0]![1]).toMatch(/^Cleric: 1 of \d+ prepared$/);
}, 20_000);

test("the prepare line of the spell view: the box, Prepared or Not prepared and the count; it works outside prepare mode, and the view keeps the spell", async () => {
  const { dialog, entities } = await renderLive(e2eFile("life-cleric-9"));
  fireEvent.click(row(dialog, "Healing Word"));
  const prepared = within(view(dialog)).getByRole("checkbox", { name: "Prepared" });
  expect(prepared.getAttribute("aria-checked")).toBe("true");
  expect(within(view(dialog)).getByText("Prepared")).toBeTruthy();
  expect(within(view(dialog)).getByText("8 of 12 prepared")).toBeTruthy();
  // The line is under the name and above the facts.
  const line = prepared.closest("div")!;
  expect(line.compareDocumentPosition(view(dialog).querySelector("h3")!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  expect(line.compareDocumentPosition(view(dialog).querySelector("dl")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(prepared);
  expect(entities).toHaveLength(1);
  // The row leaves the list, and the spell view keeps the spell, so a second click prepares it again.
  expect(within(dialog).queryByRole("button", { name: /^Healing Word/ })).toBeNull();
  expect(view(dialog).querySelector("h3")!.textContent).toBe("Healing Word");
  expect(within(view(dialog)).getByText("Not prepared")).toBeTruthy();
  fireEvent.click(within(view(dialog)).getByRole("checkbox", { name: "Prepared" }));
  expect(row(dialog, "Healing Word")).toBeTruthy();
  expect(counts(dialog)).toEqual([["under", "8 of 12 prepared"]]);
});

test("the first spell, selected at the open, stays selected after its box in the spell view takes it out of the list", async () => {
  const { dialog } = await renderLive(e2eFile("life-cleric-9"), (spellcasting) => ({
    ...spellcasting,
    // With no cantrips and no domain spells, the first spell of the list is Healing Word, a prepared spell.
    byLevel: spellcasting.byLevel
      .filter((level) => level.level > 0)
      .map((level) => ({ ...level, spells: level.spells.filter((spell) => !spell.alwaysPrepared) })),
  }));
  expect(view(dialog).querySelector("h3")!.textContent).toBe("Healing Word");
  fireEvent.click(within(view(dialog)).getByRole("checkbox", { name: "Prepared" }));
  expect(view(dialog).querySelector("h3")!.textContent).toBe("Healing Word");
});

test("an always-prepared spell has the lock line; a cantrip has no prepare line", async () => {
  const { dialog } = await renderLive(e2eFile("life-cleric-9"));
  fireEvent.click(row(dialog, "Bless"));
  expect(view(dialog).textContent).toContain("Always prepared. It does not count.");
  expect(within(view(dialog)).queryByRole("checkbox")).toBeNull();
  fireEvent.click(row(dialog, "Guidance"));
  expect(within(view(dialog)).queryByRole("checkbox")).toBeNull();
  expect(view(dialog).textContent).not.toContain("prepared");
});

test("a known spell of a source that does not prepare has the label Known in prepare mode, no box and no prepare line", async () => {
  // e2e/cleric-5-warlock-3.strict.json: the warlock spells are known spells.
  const { dialog } = await renderLive(e2eFile("cleric-5-warlock-3"));
  fireEvent.click(modeButton(dialog));
  const invisibility = row(dialog, "Invisibility");
  expect([invisibility.textContent, invisibility.getAttribute("aria-label")]).toEqual([
    "Invisibility\u00a0WarlockKnownC",
    "Invisibility, Warlock, known Concentration",
  ]);
  expect(within(invisibility.closest("li")!).queryByRole("checkbox")).toBeNull();
  fireEvent.click(invisibility);
  expect(within(view(dialog)).queryByRole("checkbox")).toBeNull();
});

test("a close ends prepare mode: the panel opens again with Prepare spells", async () => {
  const { dialog } = await renderLive(e2eFile("life-cleric-9"));
  fireEvent.click(modeButton(dialog));
  expect(modeButton(dialog).textContent).toBe("Done");
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Open spells" }));
  const again = await screen.findByRole("dialog", { name: "Spells" });
  expect(modeButton(again).textContent).toBe("Prepare spells");
  expect(within(again).queryAllByRole("checkbox")).toEqual([]);
});

test("Done: a selected spell that the user stopped preparing stays in the spell view, and its row is not in the list", async () => {
  const { dialog } = await renderLive(e2eFile("life-cleric-9"));
  fireEvent.click(modeButton(dialog));
  fireEvent.click(row(dialog, "Command"));
  fireEvent.click(modeButton(dialog));
  expect(within(dialog).queryByRole("button", { name: /^Command/ })).toBeNull();
  expect(view(dialog).querySelector("h3")!.textContent).toBe("Command");
  expect(within(view(dialog)).getByText("Not prepared")).toBeTruthy();
});
