// Test helpers for the tests of the character sheet and its sections: the test hooks, a sample sheet, the fixtures,
// the play handlers as mocks, and a render at a phone width.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeAll, vi } from "vitest";
import type { Sheet } from "../engine/sheet.ts";
import { loadSpellContent } from "../engine/spells.ts";
import { useHomebrew } from "../state/homebrew.ts";

/** Adds the hooks of a sheet test file: the SRD spells load first, and each test ends with a clean page and state. */
export function sheetTestHooks() {
  // The Spellcasting section shows spell names only once the SRD spells are loaded.
  beforeAll(() => loadSpellContent());

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useHomebrew.setState({ homebrew: undefined });
  });
}

const abilities = (["str", "dex", "con", "int", "wis", "cha"] as const).map((ability, i) => ({
  ability,
  score: [16, 10, 14, 8, 12, 9][i],
  modifier: [3, 0, 2, -1, 1, -1][i],
  save: [5, 0, 4, -1, 1, -1][i],
  saveProficient: ability === "str" || ability === "con",
}));

export const sheet: Sheet = {
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
  wornArmorClass: 19,
  acPick: null,
  armorClassOptions: [
    { armor: { key: "chain-mail", name: "Chain Mail" }, shield: { key: "shield", name: "Shield" }, ac: 19, worn: true, shown: true },
    { armor: null, shield: null, ac: 10, worn: false, shown: false },
  ],
  maxHitPoints: 28,
  baseMaxHitPoints: 28,
  currentHitPoints: null,
  tempHitPoints: 0,
  deathSaves: { successes: 0, failures: 0 },
  exhaustion: 0,
  concentration: null,
  conditions: [],
  conditionImmune: [],
  inspiration: false,
  hitDice: [{ die: 10, total: 3, left: 3 }],
  speeds: [{ feet: 25, label: null }],
  speedCause: null,
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
    pact: null,
    casters: [{ name: "Hill Dwarf", ability: "wis", saveDc: 11, attackBonus: 3, prepares: false, canPrepare: null }],
    byLevel: [
      {
        level: 0,
        spells: [{ key: "guidance", name: "Guidance", source: "Hill Dwarf", ability: "wis", alwaysPrepared: false, prepared: false, castNote: null }],
      },
    ],
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

/** A character fixture of the oracle, from `fixtures/characters/`. */
const fixture = (file: string) => JSON.parse(readFileSync(join(import.meta.dirname, `../../../../fixtures/characters/${file}`), "utf8"));
export const expectedOf = (name: string) => fixture(`${name}.expected.json`);
export const strictOf = (name: string) => fixture(`${name}.strict.json`);

/** The play handlers of the sheet page, as mocks. */
export const playMocks = () => ({
  status: "",
  onHitPoints: vi.fn(),
  onHitDice: vi.fn(),
  onDeathSaves: vi.fn(),
  onUses: vi.fn(),
  onConditions: vi.fn(),
  onInspiration: vi.fn(),
  onAcPick: vi.fn(),
  onDismissNote: vi.fn(),
});

/** Renders the sheet as a phone does: the sheet is `width` pixels wide. */
export function renderAtWidth(width: number, element: ReactElement) {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
  render(element);
}
