// The built-in pack srd52 against SRD 5.2.1 (ORC-224). The fixture is the text of the PDF:
// scripts/extract-srd-text.ts writes it. The pack is the output of scripts/import-srd.ts.

import { describe, expect, it } from "vitest";
import pack from "../../content/srd52.json" with { type: "json" };
import provenance from "../../content/srd52.provenance.json" with { type: "json" };
import { CORRECTION_LIST } from "../../scripts/srd-corrections.ts";
import { referenceTo, SRD_PACK } from "../format/keys.ts";
import { loadPack } from "../format/load.ts";
import type { EquipmentRecord, SpellRecord } from "../format/schema.ts";
import { loadContentPack } from "../rules2024/packs.ts";
import srd from "./fixtures/srd-5.2.1-text.json" with { type: "json" };

// The expected value, so the test keeps its own copy and does not import the one of the script.
const ATTRIBUTION =
  "This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.";

const loaded = loadPack(pack);
if (!loaded.pack) throw new Error("The srd52 pack does not load");
const content = loaded.pack;

const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
const nameOf = (records: { key: string; name: string }[]) => {
  const names = new Map(records.map((r) => [referenceTo(SRD_PACK, r.key), r.name]));
  return (reference: string) => names.get(reference) ?? reference;
};

describe("the srd52 pack", () => {
  it("has the record counts of SRD 5.2.1", () => {
    const counts = Object.fromEntries(
      (["classes", "subclasses", "species", "backgrounds", "feats", "spells", "weaponMasteries"] as const).map((type) => [type, content[type].length]),
    );
    expect(counts).toEqual({ classes: 12, subclasses: 12, species: 9, backgrounds: 4, feats: 17, spells: 339, weaponMasteries: 8 });
  });

  it("loads with no issue, in the schema and in the engine", () => {
    expect(loaded.issues).toEqual([]);
    expect(loadContentPack(pack).issues).toEqual([]);
  });

  it("gives the SRD 5.2.1 attribution, says that the material is changed, and names the upstream commit", () => {
    expect(content.pack).toMatchObject({ id: "srd52", license: "CC-BY-4.0", attribution: ATTRIBUTION, modified: true });
    expect(provenance).toEqual({
      repository: "https://github.com/5e-bits/5e-srd-api",
      commit: "3b6da29a45b3b328c2409cf97a14e2507e291bf8",
      date: expect.stringMatching(/^2026-11-14T/),
      path: "packages/5e-database/src/2024/en",
    });
  });
});

// The spell header as the SRD prints it. The pack keeps "Concentration" and "Ritual" as flags.
function spellHeader(spell: SpellRecord, className: (reference: string) => string) {
  const school = capital(spell.school);
  const classes = spell.classes.map(className).join(", ");
  const { verbal, somatic, material } = spell.components;
  return {
    name: spell.name,
    header: `${spell.level === 0 ? `${school} Cantrip` : `Level ${spell.level} ${school}`} (${classes})`,
    castingTime: spell.ritual ? `${spell.castingTime} or Ritual` : spell.castingTime,
    range: spell.range,
    components: [verbal && "V", somatic && "S", material && `M (${material})`].filter(Boolean).join(", "),
    duration: spell.concentration ? `Concentration, ${spell.duration}` : spell.duration,
  };
}

// A typing error in the SRD text itself. The pack has the correct form: p157 has no comma after "Concentration".
const SRD_TYPING_ERRORS: Record<string, Partial<(typeof srd.spells)[number]>> = {
  "Protection from Evil and Good": { duration: "Concentration, up to 10 minutes" },
};

// Upstream writes straight quotes and hyphens where the SRD has curly quotes and dashes.
const straightQuotes = <T extends Record<string, unknown>>(row: T): T =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === "string" ? v.replace(/’/g, "'").replace(/—/g, "-") : v])) as T;

describe("the spells against the SRD 5.2.1 text", () => {
  const className = nameOf(content.classes);
  const byName = new Map(content.spells.map((s) => [s.name, s]));

  const spells = srd.spells.map(straightQuotes);

  it("has each spell of the SRD, and no other", () => {
    expect([...byName.keys()].sort()).toEqual(spells.map((s) => s.name).sort());
  });

  it.each(spells.map((s) => [s.name, s] as const))("%s has the header of the SRD", (name, text) => {
    const { page: _, ...expected } = { ...text, ...SRD_TYPING_ERRORS[name] };
    const spell = byName.get(name);
    if (!spell) throw new Error(`No spell ${name}`);
    expect(spellHeader(spell, className)).toEqual(expected);
  });
});

// A weight as the SRD prints it: "2 lb.", "1/4 lb.", or "—".
const weight = (pounds = 0) => (pounds === 0 ? "—" : `${pounds === 0.25 ? "1/4" : pounds} lb.`);
// A cost in the largest coin that gives a whole number.
function cost(gp = 0) {
  const [amount, coin] = gp >= 1 ? [gp, "GP"] : gp >= 0.1 ? [gp * 10, "SP"] : [gp * 100, "CP"];
  return `${Math.round(amount).toLocaleString("en-US")} ${coin}`;
}

function weaponRow(item: EquipmentRecord, propertyName: (reference: string) => string) {
  const weapon = item.weapon;
  if (!weapon) throw new Error(`${item.key} is not a weapon`);
  const dice = (d: { count: number; die: number }) => (d.die === 1 ? `${d.count}` : `${d.count}d${d.die}`);
  const properties = weapon.properties.map((key) => {
    const name = propertyName(referenceTo(SRD_PACK, key));
    if (key === "thrown" || key === "ammunition") return `${name} (Range ${weapon.range?.join("/")})`;
    if (key === "versatile" && weapon.versatile) return `${name} (${dice(weapon.versatile)})`;
    return name;
  });
  return {
    group: `${capital(weapon.category)} ${weapon.ranged ? "Ranged" : "Melee"} Weapons`,
    name: item.name,
    damage: `${dice(weapon.damage)} ${capital(weapon.damage.type)}`,
    properties: properties.join(", ") || "—",
    mastery: capital(weapon.mastery),
    weight: weight(item.weight),
    cost: cost(item.cost),
  };
}

// The format has no field for the kind of ammunition ("Bolt") or for "unless mounted" (the Lance).
const withoutUnmodeled = (properties: string) => properties.replace(/; [A-Z][a-z]+\)/g, ")").replace(" (unless mounted)", "");

function armorRow(item: EquipmentRecord) {
  const armor = item.armor;
  if (!armor) throw new Error(`${item.key} is not armor`);
  const armorClass =
    armor.category === "shield"
      ? `+${armor.base}`
      : armor.dexLimit === 0
        ? `${armor.base}`
        : `${armor.base} + Dex modifier${armor.dexLimit === null ? "" : ` (max ${armor.dexLimit})`}`;
  return {
    group: armor.category === "shield" ? "Shield" : `${capital(armor.category)} Armor`,
    name: item.name,
    armorClass,
    strength: armor.strength ? `Str ${armor.strength}` : "—",
    stealth: armor.stealthDisadvantage ? "Disadvantage" : "—",
    weight: weight(item.weight),
    cost: cost(item.cost),
  };
}

describe("the weapon and armor tables against SRD 5.2.1 p91 and p92", () => {
  const propertyName = nameOf(content.weaponProperties);
  const weapons = content.equipment.filter((e) => e.weapon);
  const armor = content.equipment.filter((e) => e.armor);

  it("has each weapon of the table, in its row", () => {
    expect(weapons.map((w) => weaponRow(w, propertyName)).sort((a, b) => a.name.localeCompare(b.name))).toEqual(
      srd.weapons.map((row) => ({ ...row, properties: withoutUnmodeled(row.properties) })).sort((a, b) => a.name.localeCompare(b.name)),
    );
  });

  it("has each armor of the table, in its row", () => {
    expect(armor.map(armorRow).sort((a, b) => a.name.localeCompare(b.name))).toEqual([...srd.armor].sort((a, b) => a.name.localeCompare(b.name)));
  });
});

describe("the corrections of the upstream data", () => {
  const spellPage = new Map(srd.spells.map((s) => [straightQuotes(s).name, s.page]));
  const records: Record<string, { key: string; name: string }[]> = {
    spell: content.spells,
    class: content.classes,
    condition: content.conditions,
    species: content.species,
    equipment: content.equipment,
    feature: content.classes.flatMap((c) => c.features ?? []),
  };

  it.each(CORRECTION_LIST.map((c) => [c.record, c] as const))("%s names a record of the pack and its SRD page", (_, correction) => {
    const [type, key] = correction.record.split(" ");
    const record = records[type]?.find((r) => r.key === key);
    expect(record, correction.record).toBeDefined();
    if (type === "spell") expect(correction.page).toBe(spellPage.get(record?.name ?? ""));
    const item = content.equipment.find((e) => e.key === key);
    if (item?.weapon) expect(correction.page).toBe(91);
    if (item?.armor) expect(correction.page).toBe(92);
  });
});
