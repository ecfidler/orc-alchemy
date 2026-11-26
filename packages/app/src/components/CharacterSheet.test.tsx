import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { engine, loadEngine } from "../engine/engine.ts";
import { newCharacter } from "../engine/new-character.ts";
import { bonusStr, toSheet } from "../engine/sheet.ts";
import { CharacterSheet } from "./CharacterSheet.tsx";
import { expectedOf, playMocks, renderAtWidth, sheet, sheetTestHooks } from "./test-sheet.ts";

sheetTestHooks();

test("renders the key values of a sheet", () => {
  render(<CharacterSheet sheet={sheet} />);
  expect(screen.getByRole("heading", { level: 1, name: "Brannor Ironfist" })).toBeTruthy();
  expect(screen.getByLabelText("Class").textContent).toBe("Fighter 3 (Champion)");
  expect(screen.getByLabelText("Armor Class").textContent).toBe("19");
  expect(screen.getByLabelText("Hit Points").textContent).toBe("28 / 28");
  expect(screen.getByLabelText("Initiative").textContent).toBe("+0");
  expect(screen.getByLabelText("STR").textContent).toBe("16+3");
  expect(screen.getByLabelText("INT").textContent).toBe("8-1");
  expect(within(screen.getByText("+5 Athletics").closest("li")!).getByRole("img", { name: "Proficient" })).toBeTruthy();
  expect(within(screen.getByText("-1 History").closest("li")!).queryByRole("img")).toBeNull();
  expect(screen.getByLabelText("Tools").textContent).toBe("Smith's Tools (+2)");
  // A race with only a cantrip is one line, not boxes and a table (ORC-176).
  expect(within(screen.getByRole("group", { name: "Spellcasting" })).getByRole("listitem").textContent).toBe("Guidance (Hill Dwarf, WIS, DC 11, +3)");
  expect(screen.getByText("Second Wind")).toBeTruthy();
  expect(screen.getByText("Hates boats")).toBeTruthy();
});

test("omits empty sections", () => {
  render(<CharacterSheet sheet={{ ...sheet, name: null, spellcasting: null, darkvision: 0 }} />);
  expect(screen.getByRole("heading", { level: 1, name: "Unnamed character" })).toBeTruthy();
  expect(screen.queryByRole("group", { name: "Spellcasting" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Equipment" })).toBeNull();
  expect(screen.queryByLabelText("Darkvision")).toBeNull();
});

// The theme spec, "Not on the sheet in M8": the record keeps these, and the sheet does not show them.
test("does not show the player, XP, alignment, faction, images, appearance or personality", () => {
  render(
    <CharacterSheet
      sheet={{
        ...sheet,
        playerName: "Ana",
        factionName: "Harpers",
        portrait: "https://example.com/p.png",
        factionImage: "https://example.com/f.png",
        details: { ...sheet.details, personalityTraits: ["Brave"], ideals: "Honor", bonds: "Kin", flaws: "Pride", description: "Tall", hair: "Red" },
      }}
    />,
  );
  for (const label of ["Player", "XP", "Alignment", "Faction", "Personality Traits", "Ideals", "Bonds", "Flaws", "Description", "Hair"]) {
    expect(screen.queryByLabelText(label)).toBeNull();
  }
  for (const text of ["Ana", "900", "Lawful Good", "Harpers", "Brave", "Honor", "Kin", "Pride", "Tall", "Red"]) {
    expect(screen.queryByText(text)).toBeNull();
  }
  expect(screen.queryByRole("img", { name: /Portrait|Faction/ })).toBeNull();
});

// On-screen spot checks against the oracle's built values (ORC-48 done-when).
test.each(["fighter-20", "wizard-20"])("%s shows its expected.json values", (name) => {
  const built = expectedOf(name);
  render(<CharacterSheet sheet={toSheet(built, {})} />);

  expect(screen.getByRole("heading", { level: 1, name: built["character-name"] })).toBeTruthy();
  expect(screen.getByLabelText("Hit Points").textContent).toBe(`${built["max-hit-points"]} / ${built["max-hit-points"]}`);
  expect(screen.getByLabelText("Proficiency Bonus").textContent).toBe(bonusStr(built["proficiency-bonus"]));
  expect(screen.getByLabelText("Passive Perception").textContent).toBe(String(built["passive-perception"]));
  for (const ability of ["str", "dex", "con", "int", "wis", "cha"]) {
    const key = `orcpub.dnd.e5.character/${ability}`;
    expect(screen.getByLabelText(ability.toUpperCase()).textContent).toBe(`${built.abilities[key]}${bonusStr(built["ability-bonuses"][key])}`);
  }
  expect(screen.getByText(`${bonusStr(built["skill-bonuses"].perception)} Perception`)).toBeTruthy();
  const worn = built["armor-class-with-armor"].find(
    (o: { armor: string | null; shield: string | null }) => o.armor === built["worn-armor"] && o.shield === built["wielded-shield"],
  );
  expect(screen.getByLabelText("Armor Class").textContent).toBe(String(worn.ac));
  const acRows = within(screen.getByRole("table", { name: "Armor class options" }))
    .getAllByRole("row")
    .slice(1);
  // The AC cell keeps the width of its bold form with a hidden copy, so read the text that shows.
  expect(acRows.map((row) => Number(row.lastElementChild?.querySelector("span > span:not([aria-hidden])")?.textContent))).toEqual(
    built["armor-class-with-armor"].map((o: { ac: number }) => o.ac),
  );
});

test("layout F: header details, hit dice, empty death saves, and HP as current / max", () => {
  render(<CharacterSheet sheet={{ ...sheet, currentHitPoints: 20 }} />);
  expect(screen.getByLabelText("Background").textContent).toBe("Soldier");
  expect(screen.getByLabelText("Race").textContent).toBe("Dwarf (Hill Dwarf)");
  // A long value is truncated; a hover shows the whole value.
  expect(screen.getByLabelText("Race").title).toBe("Dwarf (Hill Dwarf)");
  expect(screen.getByLabelText("Hit Points").textContent).toBe("20 / 28");
  expect(screen.getByLabelText("Temporary").textContent).toBe("");
  // Without play, the Hit dice box is not a button: it shows the dice left / the dice of each die size.
  expect(screen.getByRole("group", { name: "Hit dice" }).textContent).toBe("3 / 3d10");
  expect(screen.getByRole("img", { name: "Successes: 0 of 3" })).toBeTruthy();
  expect(screen.getByRole("img", { name: "Failures: 0 of 3" })).toBeTruthy();
  expect(screen.getByLabelText("Inspiration").textContent).toBe("");
});

test("a character with no class shows with play: the class line, the hit points and the hit dice are empty (ORC-342)", async () => {
  await loadEngine();
  const entity = newCharacter(engine());
  const play = playMocks();
  render(<CharacterSheet sheet={toSheet(engine().evaluate(entity).built, entity)} play={play} />);
  expect(screen.getByLabelText("Class", { exact: true }).textContent).toBe("");
  // The engine gives 1 for the maximum with no class: the box shows no number and has no popup, also for the
  // temporary hit points.
  expect(screen.getByRole("group", { name: "Hit Points" }).textContent).toBe("");
  expect(screen.getByRole("group", { name: "Temporary" }).textContent).toBe("");
  expect(screen.queryByRole("button", { name: /hit points/i })).toBeNull();
  expect(screen.queryByRole("button", { name: /^Hit dice/ })).toBeNull();
  // The other play controls stay.
  expect(screen.getByRole("button", { name: "Inspiration" })).toBeTruthy();
});

test("under 720px the sheet is in tabs: Stats, Spells, Features and More, under the header", () => {
  renderAtWidth(390, <CharacterSheet sheet={sheet} />);
  const tabs = screen.getByRole("tablist", { name: "Sheet sections" });
  expect(
    within(tabs)
      .getAllByRole("tab")
      .map((tab) => tab.textContent),
  ).toEqual(["Stats", "Spells", "Features", "More"]);
  expect(screen.getByRole("heading", { level: 1, name: "Brannor Ironfist" })).toBeTruthy();
  expect(screen.getByLabelText("Race").textContent).toBe("Dwarf (Hill Dwarf)");

  // Stats is open first: the vitals, the attacks, then the ability column.
  let panel = screen.getByRole("tabpanel");
  expect(within(panel).getByLabelText("Armor Class").textContent).toBe("19");
  expect(within(panel).getByRole("group", { name: "Attacks" })).toBeTruthy();
  expect(within(panel).getByLabelText("STR").textContent).toBe("16+3");
  expect(within(panel).getByLabelText("Passive Perception").textContent).toBe("11");
  expect(screen.queryByText("Second Wind")).toBeNull();

  fireEvent.click(within(tabs).getByRole("tab", { name: "Spells" }));
  expect(within(screen.getByRole("tabpanel")).getByRole("group", { name: "Spellcasting" })).toBeTruthy();

  fireEvent.click(within(tabs).getByRole("tab", { name: "Features" }));
  expect(within(screen.getByRole("tabpanel")).getByText("Second Wind")).toBeTruthy();

  fireEvent.click(within(tabs).getByRole("tab", { name: "More" }));
  panel = screen.getByRole("tabpanel");
  expect(within(panel).getByRole("group", { name: "Equipment" })).toBeTruthy();
  expect(within(panel).getByLabelText("Tools").textContent).toBe("Smith's Tools (+2)");
  expect(within(panel).getByLabelText("Resistances").textContent).toBe("poison");
  expect(within(panel).getByRole("group", { name: "AC by armor" })).toBeTruthy();
  expect(within(panel).getByText("Hates boats")).toBeTruthy();
});

test("a tab with nothing in it does not show: no Spells tab for a non-caster, no Features tab without features", () => {
  renderAtWidth(390, <CharacterSheet sheet={{ ...sheet, spellcasting: null, features: { ...sheet.features, actions: [] } }} />);
  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Stats", "More"]);
});

test("at 720px and wider, and in the builder preview, the sheet has no tabs", () => {
  renderAtWidth(720, <CharacterSheet sheet={sheet} />);
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(screen.getByText("Second Wind")).toBeTruthy();
  cleanup();
  renderAtWidth(390, <CharacterSheet sheet={sheet} preview />);
  expect(screen.queryByRole("tablist")).toBeNull();
});

test("with play, the status text and the concentration note show in the toast, not in the vitals panel (ORC-326)", () => {
  const onDismissNote = vi.fn();
  const play = { ...playMocks(), status: "24 damage.", statusKey: 1, concentrationNote: { spell: "bless", dc: 12 }, onDismissNote };
  render(<CharacterSheet sheet={{ ...sheet, concentration: "bless" }} play={play} />);
  const toast = document.querySelector(".ui-toast")!;
  // The toast is out of the sheet, at the end of the body, so it takes no space in the vitals panel.
  expect(toast.parentElement).toBe(document.body);
  expect(screen.getByRole("article").querySelector("[role=status]")).toBeNull();
  expect(toast.querySelector("[data-toast-status]")?.textContent).toBe("24 damage.");
  const note = screen.getByRole("status", { name: "Concentration note" });
  expect(note.textContent).toBe("Concentration on Bless: Constitution save, DC 12. Dismiss");
  fireEvent.click(within(note).getByRole("button", { name: "Dismiss the concentration note" }));
  expect(onDismissNote).toHaveBeenCalledOnce();
});

test("without play, as a read-only sheet, there is no toast (ORC-326)", () => {
  render(<CharacterSheet sheet={sheet} />);
  expect(document.querySelector(".ui-toast")).toBeNull();
});
