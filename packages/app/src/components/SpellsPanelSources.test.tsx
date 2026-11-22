import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test } from "vitest";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { type PrepareSpell, type SpellRef, toSheet } from "../engine/sheet.ts";
import { loadSpellContent, setPrepared } from "../engine/spells.ts";
import { SpellsPanel } from "./SpellsPanel.tsx";

// More than one source, and the cast note, in the Spells panel (ORC-289, docs/design/spells-panel.md "The header",
// "The list", "The spell view" and "The cast note").

beforeAll(async () => {
  await loadEngine();
  await loadSpellContent();
});

afterEach(cleanup);

const q = (key: string) => `~:orcpub.dnd.e5.character/${key}`;
const e2eFile = (name: string): StrictEntity => JSON.parse(readFileSync(join(import.meta.dirname, `../../e2e/${name}.strict.json`), "utf8"));
const pick = (path: string[]) => (key: string) => [path, key] as [string[], string];

/**
 * A High Elf cleric 3 / druid 1, by the builder's calls: three sources, the High Elf with only a cantrip. Healing
 * Word and Cure Wounds are on the two class lists. The cleric prepares Healing Word, and Cure Wounds is its Life
 * domain spell; the druid prepares Cure Wounds.
 */
function highElfCleric3Druid1(): StrictEntity {
  const e = engine();
  let entity = e.setField(
    e.emptyCharacter(),
    ["ability-scores", "standard-scores"],
    Object.fromEntries(Object.entries({ str: 8, dex: 12, con: 13, int: 10, wis: 15, cha: 14 }).map(([a, n]) => [q(a), n])),
  );
  entity = e.select(entity, ["race"], "elf");
  entity = e.select(entity, ["race", "elf", "subrace"], "high-elf");
  entity = e.select(entity, ["race", "elf", "subrace", "high-elf", "high-elf-cantrips-known"], "fire-bolt");
  entity = e.setClass(entity, 0, "cleric");
  for (let n = 2; n <= 3; n++) entity = e.addLevel(entity, "cleric");
  entity = e.addClass(entity, "druid");
  for (const [path, key] of [
    pick(["class", "cleric", "levels", "level-1", "divine-domain"])("life-domain"),
    ...["guidance", "sacred-flame", "spare-the-dying"].map(pick(["class", "cleric", "cleric-cantrips-known"])),
    ...["druidcraft", "produce-flame"].map(pick(["class", "druid", "druid-cantrips-known"])),
  ])
    entity = e.select(entity, path, key);
  for (const key of ["healing-word", "guiding-bolt", "sanctuary"]) entity = setPrepared(e, entity, "Cleric", key, true);
  entity = setPrepared(e, entity, "Druid", "cure-wounds", true);
  return e.setValue(entity, "character-name", "Sefa Linden");
}

/** The open panel of a character, with the sheet's prepare handler on a live entity. */
async function renderLive(start: StrictEntity, at?: SpellRef) {
  const entities: StrictEntity[] = [];
  function Live() {
    const [entity, setEntity] = useState(start);
    const sheet = toSheet(engine().evaluate(entity).built, entity);
    const prepare: PrepareSpell = (spell, prepared) =>
      setEntity((current) => {
        const next = setPrepared(engine(), current, spell.source, spell.key, prepared);
        entities.push(next);
        return next;
      });
    return (
      <SpellsPanel
        open
        onOpenChange={() => {}}
        spellcasting={sheet.spellcasting!}
        classes={sheet.classes}
        at={at}
        builderHref="/b"
        onSpendSlots={() => {}}
        onPrepare={prepare}
      />
    );
  }
  render(<RouterProvider router={createMemoryRouter([{ path: "/", element: <Live /> }], { initialEntries: ["/"] })} />);
  const dialog = await screen.findByRole("dialog", { name: "Spells" });
  await within(dialog).findAllByRole("heading", { level: 3 });
  return { dialog, entities };
}

/** The rows of the list: [visible text, accessible name]. */
const rowNames = (dialog: HTMLElement) => [...dialog.querySelectorAll("[data-spell-row]")].map((row) => [row.textContent, row.getAttribute("aria-label")]);
/** The source lines of the header: [source, save DC, attack, ability], each number by its full name. */
const sourceLines = (dialog: HTMLElement) =>
  ["Cleric", "Druid", "Warlock", "High Elf", "Tiefling"].flatMap((name) => {
    const line = within(dialog).queryByRole("group", { name });
    if (!line) return [];
    const number = (label: string) => within(line).queryByRole("group", { name: label })?.textContent ?? null;
    return [[name, number("Spell save DC"), number("Spell attack"), number("Spellcasting ability")]];
  });
const view = (dialog: HTMLElement) => within(dialog.querySelector<HTMLElement>("[data-pane=spell]")!).getByRole("region");
const modeButton = (dialog: HTMLElement) => within(dialog).getByRole("button", { name: /^(Prepare spells|Done)$/ });

test("e2e/high-elf-cleric-3-druid-1.strict.json is the High Elf cleric 3 / druid 1, by the builder's calls", () => {
  expect(e2eFile("high-elf-cleric-3-druid-1")).toEqual(JSON.parse(JSON.stringify(highElfCleric3Druid1())));
});

test("a cleric 5 / warlock 3: each row has its source tag and has the source in its name; the header has a line of numbers for each source", async () => {
  const { dialog } = await renderLive(e2eFile("cleric-5-warlock-3"));
  expect(sourceLines(dialog)).toEqual([
    ["Cleric", "12", "+4", "WIS"],
    ["Warlock", "13", "+5", "CHA"],
  ]);
  // The lines take the place of the three boxes.
  expect(dialog.querySelector(".ui-framed-box")).toBeNull();
  // The column labels show once, and a screen reader does not read them.
  const header = within(dialog).getByRole("group", { name: "Cleric" }).parentElement!;
  expect(header.querySelector("[aria-hidden]")!.textContent).toBe("Save DCAttackAbility");
  expect(rowNames(dialog).slice(0, 3)).toEqual([
    ["Eldritch Blast Warlock", "Eldritch Blast, Warlock"],
    ["Guidance ClericC", "Guidance, Cleric Concentration"],
    ["Mage Hand Warlock", "Mage Hand, Warlock"],
  ]);
  // Every row has a tag.
  expect(rowNames(dialog).every(([, name]) => /, (Cleric|Warlock)( |$)/.test(name!))).toBe(true);
  // In prepare mode the state follows the source.
  fireEvent.click(modeButton(dialog));
  expect(within(dialog).getByRole("button", { name: "Bless, Cleric, always prepared Concentration" })).toBeTruthy();
  expect(within(dialog).getByRole("checkbox", { name: "Prepared: Bless, Cleric" })).toBeTruthy();
});

test("a single-class character has no source tags and the three boxes", async () => {
  const { dialog } = await renderLive(e2eFile("life-cleric-9"));
  expect(dialog.querySelectorAll(".ui-framed-box")).toHaveLength(3);
  expect(sourceLines(dialog)).toEqual([]);
  expect(rowNames(dialog).slice(0, 2)).toEqual([
    ["GuidanceC", null],
    ["Light", null],
  ]);
  expect(dialog.querySelector("[data-pane=list]")!.textContent).not.toMatch(/cleric/i);
});

test("three sources: a line for each, the High Elf with only a cantrip too; the classes first, in the order taken", async () => {
  const { dialog } = await renderLive(e2eFile("high-elf-cleric-3-druid-1"));
  expect(within(dialog).getByText("Cleric 3 / Druid 1")).toBeTruthy();
  expect(sourceLines(dialog)).toEqual([
    ["Cleric", "12", "+4", "WIS"],
    ["Druid", "12", "+4", "WIS"],
    ["High Elf", "10", "+2", "INT"],
  ]);
  expect(rowNames(dialog)[1]).toEqual(["Fire Bolt High Elf", "Fire Bolt, High Elf"]);
});

test("a spell on the cleric and the druid lists is two rows, each with its tag; each row prepares apart, for its own class", async () => {
  const { dialog, entities } = await renderLive(e2eFile("high-elf-cleric-3-druid-1"));
  const names = () => rowNames(dialog).map(([, name]) => name);
  // Outside prepare mode: the Cleric's Healing Word, the two Cure Wounds (a domain spell, and the druid's).
  expect(names().filter((name) => /^(Healing Word|Cure Wounds)/.test(name!))).toEqual(["Cure Wounds, Cleric", "Cure Wounds, Druid", "Healing Word, Cleric"]);
  fireEvent.click(modeButton(dialog));
  expect(names().filter((name) => /^(Healing Word|Cure Wounds)/.test(name!))).toEqual([
    "Cure Wounds, Cleric, always prepared",
    "Cure Wounds, Druid, prepared",
    "Healing Word, Cleric, prepared",
    "Healing Word, Druid, not prepared",
  ]);
  const box = (name: string) => within(dialog).getByRole("checkbox", { name: `Prepared: ${name}` });
  fireEvent.click(box("Healing Word, Druid"));
  expect(box("Healing Word, Druid").getAttribute("aria-checked")).toBe("true");
  expect(box("Healing Word, Cleric").getAttribute("aria-checked")).toBe("true");
  const prepared = (entity: StrictEntity) => toSheet(engine().evaluate(entity).built, entity).spellcasting!.byLevel[1]!.spells;
  const healingWord = (entity: StrictEntity) =>
    prepared(entity)
      .filter((spell) => spell.key === "healing-word")
      .map((spell) => [spell.source, spell.prepared]);
  expect(healingWord(entities.at(-1)!)).toEqual([
    ["Cleric", true],
    ["Druid", true],
  ]);
  // The cleric's box stops the cleric's Healing Word only.
  fireEvent.click(box("Healing Word, Cleric"));
  expect(healingWord(entities.at(-1)!)).toEqual([
    ["Cleric", false],
    ["Druid", true],
  ]);
  // Space on a row changes the box of that row's class.
  const druidRow = within(dialog).getByRole("button", { name: "Cure Wounds, Druid, prepared" });
  fireEvent.keyDown(druidRow, { key: " " });
  fireEvent.keyUp(druidRow, { key: " " });
  expect(box("Cure Wounds, Druid").getAttribute("aria-checked")).toBe("false");
  expect(box("Cure Wounds, Cleric").getAttribute("aria-checked")).toBe("true");
}, 20_000);

test("a spell with a cast note shows it in muted text after its name on its row, and as a line in its spell view", async () => {
  // e2e/warlock-20.strict.json: Mask of Many Faces gives Disguise Self at will.
  const { dialog } = await renderLive(e2eFile("warlock-20"), { key: "disguise-self", source: "Warlock" });
  const row = within(dialog).getByRole("button", { name: "Disguise Self, at will, Warlock" });
  expect(row.textContent).toBe("Disguise Self at will Warlock");
  expect(within(row).getByText("at will").className).toContain("text-paper");
  expect(view(dialog).querySelector("h3")!.textContent).toBe("Disguise Self");
  expect(within(view(dialog)).getByText("At will")).toBeTruthy();
  // On a row that is not selected, the note is muted.
  expect(within(within(dialog).getByRole("button", { name: "Silent Image, at will, Warlock Concentration" })).getByText("at will").className).toContain(
    "text-ink-muted",
  );
});

test("the note Domain does not show, on the row and in the spell view", async () => {
  const { dialog } = await renderLive(e2eFile("life-cleric-9"), { key: "bless", source: "Cleric" });
  expect(within(dialog).getByRole("button", { name: /^Bless/ }).textContent).toBe("BlessC");
  expect(view(dialog).textContent).not.toMatch(/domain/i);
});
