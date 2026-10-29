import { cleanup, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { bonusStr, toSheet, type Sheet } from "../engine/sheet.ts";
import { CharacterSheet } from "./CharacterSheet.tsx";

afterEach(cleanup);

const abilities = (["str", "dex", "con", "int", "wis", "cha"] as const).map((ability, i) => ({
  ability,
  score: [16, 10, 14, 8, 12, 9][i],
  modifier: [3, 0, 2, -1, 1, -1][i],
  save: [5, 0, 4, -1, 1, -1][i],
  saveProficient: ability === "str" || ability === "con",
}));

const sheet: Sheet = {
  name: "Brannor Ironfist",
  portrait: null,
  playerName: null,
  factionName: null,
  factionImage: null,
  race: "Dwarf",
  subrace: "Hill Dwarf",
  background: "Soldier",
  alignment: "Lawful Good",
  classes: [{ key: "fighter", name: "Fighter", level: 3, hitDie: 10, subclass: "Champion" }],
  totalLevel: 3,
  xp: 900,
  abilities,
  proficiencyBonus: 2,
  initiative: 0,
  passivePerception: 11,
  skills: [
    { key: "athletics", name: "Athletics", ability: "str", bonus: 5, proficient: true, expertise: false },
    { key: "history", name: "History", ability: "int", bonus: -1, proficient: false, expertise: false },
  ],
  armorClass: 19,
  armorClassOptions: [
    { armor: { key: "chain-mail", name: "Chain Mail" }, shield: { key: "shield", name: "Shield" }, ac: 19 },
    { armor: null, shield: null, ac: 10 },
  ],
  maxHitPoints: 28,
  currentHitPoints: null,
  speeds: [{ feet: 25, label: null }],
  darkvision: 60,
  numberOfAttacks: 1,
  weaponAttacks: [
    {
      key: "longsword",
      name: "Longsword",
      attackBonus: 5,
      damageModifier: 3,
      offHandDamageModifier: null,
      proficient: true,
    },
  ],
  specialAttacks: [],
  resistances: ["poison"],
  immunities: [],
  conditionImmunities: [],
  vulnerabilities: [],
  languages: ["Common", "Dwarvish"],
  tools: [{ key: "smiths-tools", name: "Smith's Tools", bonus: 2 }],
  weaponProficiencies: [],
  armorProficiencies: [],
  spellcasting: {
    slots: [],
    casters: [{ name: "Hill Dwarf", ability: "wis", saveDc: 11, attackBonus: 3, canPrepare: null }],
    byLevel: [{ level: 0, spells: [{ key: "guidance", name: "Guidance", source: "Hill Dwarf", ability: "wis", alwaysPrepared: false, prepared: false }] }],
    knownModes: {},
  },
  features: {
    actions: [{ name: "Second Wind", text: "Regain 1d10 + 3 hit points (1/rest)." }],
    bonusActions: [],
    reactions: [],
    traits: [],
  },
  equipment: { weapons: [], armor: [], magicItems: [], other: [], treasure: [] },
  details: {
    personalityTraits: [],
    ideals: null,
    bonds: null,
    flaws: null,
    description: null,
    age: null,
    sex: null,
    height: null,
    weight: null,
    hair: null,
    eyes: null,
    skin: null,
    notes: "Owes the guild\nHates boats",
  },
};

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
  const cantrips = screen.getByRole("table", { name: "Cantrips" });
  expect(within(cantrips).getByRole("cell", { name: "Guidance" })).toBeTruthy();
  expect(screen.getByText("Second Wind")).toBeTruthy();
  expect(screen.getByText("Hates boats")).toBeTruthy();
});

test("omits empty sections", () => {
  render(<CharacterSheet sheet={{ ...sheet, name: null, spellcasting: null, darkvision: 0 }} />);
  expect(screen.getByRole("heading", { level: 1, name: "Unnamed character" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Spells" })).toBeNull();
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
const expectedOf = (name: string) =>
  JSON.parse(readFileSync(join(import.meta.dirname, `../../../../fixtures/characters/${name}.expected.json`), "utf8"));

test.each(["fighter-20", "wizard-20"])("%s shows its expected.json values", (name) => {
  const built = expectedOf(name);
  render(<CharacterSheet sheet={toSheet(built, {})} />);

  expect(screen.getByRole("heading", { level: 1, name: built["character-name"] })).toBeTruthy();
  expect(screen.getByLabelText("Hit Points").textContent).toBe(`${built["max-hit-points"]} / ${built["max-hit-points"]}`);
  expect(screen.getByLabelText("Proficiency Bonus").textContent).toBe(bonusStr(built["proficiency-bonus"]));
  expect(screen.getByLabelText("Passive Perception").textContent).toBe(String(built["passive-perception"]));
  for (const ability of ["str", "dex", "con", "int", "wis", "cha"]) {
    const key = `orcpub.dnd.e5.character/${ability}`;
    expect(screen.getByLabelText(ability.toUpperCase()).textContent).toBe(
      `${built.abilities[key]}${bonusStr(built["ability-bonuses"][key])}`,
    );
  }
  expect(screen.getByText(`${bonusStr(built["skill-bonuses"].perception)} Perception`)).toBeTruthy();
  const worn = built["armor-class-with-armor"].find(
    (o: { armor: string | null; shield: string | null }) =>
      o.armor === built["worn-armor"] && o.shield === built["wielded-shield"],
  );
  expect(screen.getByLabelText("Armor Class").textContent).toBe(String(worn.ac));
  const acRows = within(screen.getByRole("table", { name: "Armor class options" })).getAllByRole("row").slice(1);
  expect(acRows.map((row) => Number(row.lastElementChild?.textContent))).toEqual(
    built["armor-class-with-armor"].map((o: { ac: number }) => o.ac),
  );
});

test("wizard-20 shows its slots and every known spell", () => {
  const built = expectedOf("wizard-20");
  render(<CharacterSheet sheet={toSheet(built, {})} />);
  const slots = within(screen.getByRole("table", { name: "Spell Slots" })).getAllByRole("cell");
  expect(slots.map((cell) => Number(cell.textContent))).toEqual(Object.values(built["spell-slots"]));
  const knownCount = Object.values(built["spells-known"] as Record<string, { __entries: unknown[] }>).reduce(
    (n, level) => n + level.__entries.length,
    0,
  );
  const spellRows = screen
    .getAllByRole("table")
    .filter((table) => /Cantrips|Level/.test(table.querySelector("caption")?.textContent ?? ""))
    .flatMap((table) => within(table).getAllByRole("row").slice(1));
  expect(spellRows).toHaveLength(knownCount);
});

test("wizard-1 marks its prepared spells in a Prepared column, which cantrips do not have", () => {
  const strict = JSON.parse(readFileSync(join(import.meta.dirname, "../../../../fixtures/characters/wizard-1.strict.json"), "utf8"));
  render(<CharacterSheet sheet={toSheet(expectedOf("wizard-1"), strict)} />);
  const first = screen.getByRole("table", { name: "1st Level" });
  expect(within(first).getByRole("columnheader", { name: "Prepared" })).toBeTruthy();
  const preparedOf = (name: string) => within(first).getByRole("cell", { name }).closest("tr")!.lastElementChild!.textContent;
  expect(preparedOf("Alarm")).toBe("Yes");
  expect(preparedOf("Detect Magic")).toBe("—");
  const cantrips = screen.getByRole("table", { name: "Cantrips" });
  expect(within(cantrips).queryByRole("columnheader", { name: "Prepared" })).toBeNull();
});

test("layout F: header details, hit dice, empty death saves, and HP as current / max", () => {
  render(<CharacterSheet sheet={{ ...sheet, currentHitPoints: 20 }} />);
  expect(screen.getByLabelText("Background").textContent).toBe("Soldier");
  expect(screen.getByLabelText("Race").textContent).toBe("Dwarf (Hill Dwarf)");
  expect(screen.getByLabelText("Hit Points").textContent).toBe("20 / 28");
  expect(screen.getByLabelText("Temporary").textContent).toBe("");
  expect(within(screen.getByRole("group", { name: "Hit dice" })).getByText("3d10")).toBeTruthy();
  expect(screen.getByRole("img", { name: "Successes: 0 of 3" })).toBeTruthy();
  expect(screen.getByRole("img", { name: "Failures: 0 of 3" })).toBeTruthy();
  expect(screen.getByLabelText("Inspiration").textContent).toBe("");
});

test("the Gold box adds up the coins as gold pieces, and the coins leave the equipment list", () => {
  const coin = (key: string, quantity: number) => ({ key, name: key.toUpperCase(), quantity, equipped: false });
  const treasure = [coin("cp", 5), coin("sp", 14), coin("ep", 1), coin("gp", 37), coin("pp", 2), { key: "ruby", name: "Ruby", quantity: 1, equipped: false }];
  render(<CharacterSheet sheet={{ ...sheet, equipment: { ...sheet.equipment, treasure } }} />);
  // 0.05 + 1.4 + 0.5 + 37 + 20
  expect(screen.getByLabelText("Gold").textContent).toBe("58.95");
  const equipment = within(screen.getByRole("group", { name: "Equipment" }));
  expect(equipment.getByText("Ruby")).toBeTruthy();
  expect(equipment.queryByText("GP")).toBeNull();
});

test("a limited-use feature sits in a use bubble, with circles, or a pool for more than 8 uses", () => {
  const features = {
    ...sheet.features,
    actions: [
      { name: "Second Wind", text: "Regain hit points.", uses: { amount: 1, recharge: "Short rest" } },
      { name: "Lay on Hands", text: "Restore hit points.", uses: { amount: 25, recharge: "Long rest" } },
      { name: "Dash", text: "Move again." },
    ],
  };
  render(<CharacterSheet sheet={{ ...sheet, features }} />);
  expect(within(screen.getByRole("group", { name: "Second Wind" })).getByRole("button", { name: "Use 1" })).toBeTruthy();
  expect(within(screen.getByRole("group", { name: "Second Wind" })).getByText("Short rest")).toBeTruthy();
  expect(within(screen.getByRole("group", { name: "Lay on Hands" })).getByRole("button", { name: "25 / 25 left. Spend 5" })).toBeTruthy();
  expect(screen.queryByRole("group", { name: "Dash" })).toBeNull();
  expect(screen.getByText("Move again.")).toBeTruthy();
});
