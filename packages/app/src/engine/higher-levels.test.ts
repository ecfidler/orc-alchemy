import { beforeAll, expect, test } from "vitest";
import { amountAt, higherLevels, readHigherAmount } from "./higher-levels.ts";
import type { SpellRecord } from "./spell-records.ts";
import { loadSpellContent, type SpellContent } from "./spells.ts";

let srd: SpellContent;
beforeAll(async () => {
  srd = await loadSpellContent();
});
const spell = (key: string): SpellRecord => srd.get(key)!;

/** The amount of a spell at 1 and at 2 slot levels above its level, or "text" when the menu shows the text. */
function read(record: SpellRecord): string {
  const higher = higherLevels(record);
  return higher.kind === "amount" ? `${amountAt(higher.amount, 1)} | ${amountAt(higher.amount, 2)}` : higher.kind;
}

/**
 * Each SRD spell whose "At Higher Levels" text says "for each slot level
 * above", with the amount at 1 and 2 levels above. "text": the sentence has
 * no amount or more than one, so the menu shows the text.
 */
const EXPECTED: Record<string, string> = {
  "acid-arrow": "+1d4 | +2d4",
  aid: "+5 | +10",
  "animal-friendship": "+1 beast | +2 beasts",
  "animal-messenger": "+48 hours | +96 hours",
  "animate-dead": "+2 undead creatures | +4 undead creatures",
  "animate-objects": "+2 objects | +4 objects",
  // "the clenched fist … increases by 2d8 and the … grasping hand increases by 2d6": two amounts.
  "arcane-hand": "text",
  bane: "+1 creature | +2 creatures",
  banishment: "+1 creature | +2 creatures",
  bless: "+1 creature | +2 creatures",
  blight: "+1d8 | +2d8",
  "blindness-deafness": "+1 creature | +2 creatures",
  "burning-hands": "+1d6 | +2d6",
  "call-lightning": "+1d10 | +2d10",
  "chain-lightning": "+1 bolt | +2 bolts",
  "charm-person": "+1 creature | +2 creatures",
  "circle-of-death": "+2d6 | +4d6",
  cloudkill: "+1d8 | +2d8",
  "color-spray": "+2d10 | +4d10",
  command: "+1 creature | +2 creatures",
  "cone-of-cold": "+1d8 | +2d8",
  confusion: "+5 feet | +10 feet",
  "conjure-elemental": "+1 | +2",
  "conjure-fey": "+1 | +2",
  // "10 additional gallons of water, or the size of the cube increases by 5 feet": two amounts.
  "create-or-destroy-water": "text",
  creation: "+5 feet | +10 feet",
  "cure-wounds": "+1d8 | +2d8",
  "delayed-blast-fireball": "+1d6 | +2d6",
  disintegrate: "+3d6 | +6d6",
  "enhance-ability": "+1 creature | +2 creatures",
  // "up to three willing creatures (including you)": no word "additional".
  etherealness: "text",
  "false-life": "+5 temporary hit points | +10 temporary hit points",
  fireball: "+1d6 | +2d6",
  "flame-strike": "+1d6 | +2d6",
  "flaming-sphere": "+1d6 | +2d6",
  fly: "+1 creature | +2 creatures",
  "fog-cloud": "+20 feet | +40 feet",
  "freezing-sphere": "+1d6 | +2d6",
  // "blocks spells of one level higher": no amount.
  "globe-of-invulnerability": "text",
  "glyph-of-warding": "+1d8 | +2d8",
  "guiding-bolt": "+1d6 | +2d6",
  heal: "+10 | +20",
  "healing-word": "+1d4 | +2d4",
  "heat-metal": "+1d8 | +2d8",
  "hellish-rebuke": "+1d10 | +2d10",
  heroism: "+1 creature | +2 creatures",
  "hold-monster": "+1 creature | +2 creatures",
  "hold-person": "+1 humanoid | +2 humanoids",
  "ice-storm": "+1d8 | +2d8",
  "inflict-wounds": "+1d10 | +2d10",
  "insect-plague": "+1d10 | +2d10",
  invisibility: "+1 creature | +2 creatures",
  "lightning-bolt": "+1d6 | +2d6",
  longstrider: "+1 creature | +2 creatures",
  "magic-circle": "+1 hour | +2 hours",
  "magic-missile": "+1 dart | +2 darts",
  "mass-cure-wounds": "+1d8 | +2d8",
  "mass-healing-word": "+1d4 | +2d4",
  moonbeam: "+1d10 | +2d10",
  "phantasmal-killer": "+1d10 | +2d10",
  "prayer-of-healing": "+1d8 | +2d8",
  "scorching-ray": "+1 ray | +2 rays",
  shatter: "+1d8 | +2d8",
  sleep: "+2d8 | +4d8",
  "spirit-guardians": "+1d8 | +2d8",
  thunderwave: "+1d8 | +2d8",
  "vampiric-touch": "+1d6 | +2d6",
  "wall-of-fire": "+1d8 | +2d8",
  // "increases by 2d6, and the damage from passing through … increases by 1d6": two amounts.
  "wall-of-ice": "text",
  "wall-of-thorns": "+1d8 | +2d8",
};

test("the app reads the amount of each of the 70 SRD spells that say 'for each slot level above', or else shows the text", () => {
  const forEach = [...srd.values()].filter((record) => /for each slot level above/.test(record.description ?? ""));
  expect(forEach).toHaveLength(70);
  expect(Object.fromEntries(forEach.map((record) => [record.key, read(record)]))).toEqual(EXPECTED);
});

test("the amount multiplies by the levels above the spell level, as the spec examples say", () => {
  // "1d6 for each slot level above 1st" gives "+2d6" at 3rd level.
  const burning = higherLevels(spell("burning-hands"));
  expect(burning.kind === "amount" && amountAt(burning.amount, 3 - 1)).toBe("+2d6");
  // "one more dart" gives "+2 darts".
  const missile = higherLevels(spell("magic-missile"));
  expect(missile.kind === "amount" && [1, 2, 8].map((n) => amountAt(missile.amount, n))).toEqual(["+1 dart", "+2 darts", "+8 darts"]);
  // Hellish Rebuke of a warlock with 5th-level pact slots: 4 levels above.
  const rebuke = higherLevels(spell("hellish-rebuke"));
  expect(rebuke.kind === "amount" && amountAt(rebuke.amount, 4)).toBe("+4d10");
  // At the spell level there is no amount.
  expect(burning.kind === "amount" && amountAt(burning.amount, 0)).toBe("");
});

test("a spell with other words gives its text, and a spell with no 'At Higher Levels' text gives none", () => {
  const weapon = higherLevels(spell("magic-weapon"));
  expect(weapon).toEqual({
    kind: "text",
    text: expect.stringMatching(/^When you cast this spell using a spell slot of 4th level or higher, the bonus increases to \+2\./),
  });
  expect(higherLevels(spell("misty-step"))).toEqual({ kind: "none" });
  expect(higherLevels(undefined)).toEqual({ kind: "none" });
  // The SRD has 21 spells with other words.
  const other = [...srd.values()].filter((record) => higherLevels(record).kind === "text" && !/for each slot level above/.test(record.description ?? ""));
  expect(other).toHaveLength(21);
});

test("a pack spell with the same words gets the same rule; a sentence the app cannot read gives no amount", () => {
  expect(
    readHigherAmount("When you cast this spell using a spell slot of 3rd level or higher, the damage increases by 2d12 for each slot level above 2nd."),
  ).toEqual({
    kind: "dice",
    count: 2,
    die: 12,
  });
  expect(readHigherAmount("You create one more beam for each slot level above 1st.")).toEqual({ kind: "count", count: 1, one: "beam", many: "beams" });
  expect(readHigherAmount("The range increases by 10 feet for each slot level above 1st.")).toEqual({ kind: "count", count: 10, one: "foot", many: "feet" });
  expect(readHigherAmount("The damage grows for each slot level above 1st.")).toBeNull();
  expect(readHigherAmount("The damage increases by 1d6 and the healing by 1d4 for each slot level above 1st.")).toBeNull();
  expect(readHigherAmount("The damage increases by 1d6 when you cast it at a higher level.")).toBeNull();
});
