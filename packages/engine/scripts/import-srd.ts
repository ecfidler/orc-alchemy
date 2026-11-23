// The import of the SRD 5.2.1 data (ORC-224). It reads a checkout of
// 5e-bits/5e-srd-api at the pinned commit and writes the built-in pack
// `srd52` in the content format (docs/design/2024-content-format.md,
// section "The source data"), with its provenance file and the MIT notice
// of 5e-bits.
//
//   bun scripts/import-srd.ts <checkout of 5e-srd-api>           write the files
//   bun scripts/import-srd.ts <checkout of 5e-srd-api> --check   compare with the committed files
//
// The script fills the display layer and the typed fields of each record.
// The effects come from the rules tickets. The output has no date of the
// run, so a second run on the same commit gives the same files. The
// upstream JSON is not committed.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { keyFromName, parseReference, referenceTo, SRD_PACK } from "../src/format/keys.ts";
import { loadPack } from "../src/format/load.ts";
import { CURRENT_VERSION, FORMAT } from "../src/format/schema.ts";
import { CORRECTIONS, type Corrections } from "./srd-corrections.ts";

export const UPSTREAM = {
  repository: "https://github.com/5e-bits/5e-srd-api",
  commit: "3b6da29a45b3b328c2409cf97a14e2507e291bf8",
  data: "packages/5e-database/src/2024/en",
};

/** The attribution statement of SRD 5.2.1. SRD 5.2.1 permits no other attribution to Wizards of the Coast. */
export const ATTRIBUTION =
  "This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.";

const CONTENT = resolve(import.meta.dirname, "../content");

// The upstream shapes, as far as the script reads them.

interface Ref {
  index: string;
  name: string;
  note?: string;
}
/** An upstream record: the script reads only the fields that it needs. */
type UpstreamRecord = Record<string, any>;

const ref = (key: string) => referenceTo(SRD_PACK, key);

/** The text of an upstream description: one string, with no indent at the start of a line and no line break in a sentence. */
function text(value: unknown): string {
  const joined = Array.isArray(value) ? value.join("\n") : String(value ?? "");
  return joined
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n(?=[a-z])/g, " ") // A line break in a sentence, from the upstream copy of the PDF.
    .trim();
}

/** Gold pieces. */
function gp(cost: { quantity: number; unit: string } | undefined): number | undefined {
  if (!cost) return undefined;
  const rate: Record<string, number> = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 };
  if (!(cost.unit in rate)) throw new Error(`Unknown coin ${cost.unit}`);
  return Math.round(cost.quantity * rate[cost.unit] * 100) / 100;
}

/** "1d8" as a count and a die. A flat number, such as the 1 of the Blowgun, is that many d1. */
function dice(value: string): { count: number; die: number } {
  const match = /^(\d+)(?:d(\d+))?$/.exec(value.trim());
  if (!match) throw new Error(`Not a damage value: ${value}`);
  return { count: Number(match[1]), die: match[2] ? Number(match[2]) : 1 };
}

const kebab = (snake: string) => snake.replaceAll("_", "-");

/** The name of a trait without the range that upstream adds: "Darkvision (120 ft.)" is "Darkvision". */
const traitName = (name: string) => name.replace(/ \(\d+ ft\.\)$/, "");

/** The key of each feature of a record from its name, with the level added when two features have one name. */
function featureKeys(features: readonly { name: string; level: number }[]): string[] {
  const counts = new Map<string, number>();
  for (const f of features) counts.set(keyFromName(f.name), (counts.get(keyFromName(f.name)) ?? 0) + 1);
  return features.map((f) => {
    const key = keyFromName(f.name);
    return (counts.get(key) ?? 0) > 1 ? `${key}-${f.level}` : key;
  });
}

/** The fields that start each record: the key and the name, and the upstream index in `source`. */
const head = (u: UpstreamRecord, name = u.name as string) => ({ key: u.index as string, name, source: { index: u.index as string } });

/** Drops the fields that are undefined, so that the JSON has no `null` for an absent value. */
function compact<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as T;
}

const unique = <T>(value: T, index: number, list: readonly T[]) => list.indexOf(value) === index;
const fail = (message: string): never => {
  throw new Error(message);
};
/** The level of a level index such as "barbarian-3". */
const levelOf = (levelIndex: string) => Number(levelIndex.split("-").at(-1));

// The reading of the upstream files.

class Upstream {
  constructor(readonly dir: string) {}
  private cache = new Map<string, UpstreamRecord[]>();
  read(name: string): UpstreamRecord[] {
    const cached = this.cache.get(name);
    if (cached) return cached;
    const data = JSON.parse(readFileSync(join(this.dir, `5e-SRD-${name}.json`), "utf8")) as UpstreamRecord[];
    this.cache.set(name, data);
    return data;
  }
  byIndex(name: string): Map<string, UpstreamRecord> {
    return new Map(this.read(name).map((r) => [r.index, r]));
  }
}

// Equipment.

const CATEGORY_ORDER: [string, string][] = [
  ["gaming-sets", "gaming-set"],
  ["artisans-tools", "artisans-tools"],
  ["musical-instruments", "musical-instrument"],
  ["other-tools", "tool"],
  ["ammunition", "ammunition"],
  ["equipment-packs", "equipment-pack"],
  ["arcane-foci", "arcane-focus"],
  ["druidic-foci", "druidic-focus"],
  ["holy-symbols", "holy-symbol"],
  ["weapons", "weapon"],
  ["armor", "armor"],
  ["adventuring-gear", "adventuring-gear"],
];

/** The equipment category of the format for an upstream category, for example "gaming-sets" is "gaming-set". */
export function categoryKey(upstream: string): string {
  const found = CATEGORY_ORDER.find(([from]) => from === upstream);
  if (!found) throw new Error(`No category for ${upstream}`);
  return found[1];
}

/** The upstream category indexes of an item, for example "martial-weapons". */
const categoriesOf = (item: UpstreamRecord) => new Set((item.equipment_categories as Ref[]).map((c) => c.index));

function equipmentCategory(item: UpstreamRecord): string {
  const indexes = categoriesOf(item);
  const found = CATEGORY_ORDER.find(([from]) => indexes.has(from));
  if (!found) throw new Error(`No category for ${item.index}`);
  return found[1];
}

function weapon(item: UpstreamRecord) {
  const categories = categoriesOf(item);
  const properties = (item.properties as Ref[]).map((p) => p.index);
  const range = properties.includes("thrown") ? item.throw_range : properties.includes("ammunition") ? item.range : undefined;
  return compact({
    category: categories.has("martial-weapons") ? ("martial" as const) : ("simple" as const),
    ranged: categories.has("ranged-weapons"),
    damage: { ...dice(item.damage.damage_dice), type: item.damage.damage_type.index as string },
    properties,
    mastery: item.mastery.index as string,
    range: range ? ([range.normal, range.long] as [number, number]) : undefined,
    versatile: item.two_handed_damage ? dice(item.two_handed_damage.damage_dice) : undefined,
  });
}

function armor(item: UpstreamRecord) {
  const categories = categoriesOf(item);
  const category = categories.has("shields") ? "shield" : categories.has("heavy-armor") ? "heavy" : categories.has("medium-armor") ? "medium" : "light";
  const ac = item.armor_class;
  return compact({
    category: category as "light" | "medium" | "heavy" | "shield",
    base: ac.base as number,
    dexLimit: ac.dex_bonus ? ((ac.max_bonus as number | undefined) ?? null) : 0,
    strength: item.str_minimum ? (item.str_minimum as number) : undefined,
    stealthDisadvantage: item.stealth_disadvantage ? true : undefined,
  });
}

/** The prose of a tool: its ability, what it can do, and what it can craft (SRD 5.2.1 p92). */
function toolText(item: UpstreamRecord, abilities: Map<string, UpstreamRecord>): string | undefined {
  const lines: string[] = [];
  if (item.ability) lines.push(`Ability: ${abilities.get(item.ability.index)?.full_name}`);
  if (item.utilize) lines.push(`Utilize: ${(item.utilize as UpstreamRecord[]).map((u) => (typeof u === "string" ? u : u.name)).join(", ")}`);
  if (item.craft) lines.push(`Craft: ${(item.craft as Ref[]).map((c) => c.name).join(", ")}`);
  if (item.description) lines.push(text(item.description));
  return lines.length ? lines.join("\n") : undefined;
}

function equipmentRecords(up: Upstream) {
  const abilities = up.byIndex("Ability-Scores");
  return up.read("Equipment").map((item) =>
    compact({
      ...head(item),
      description: toolText(item, abilities),
      category: equipmentCategory(item),
      cost: gp(item.cost),
      weight: item.weight as number | undefined,
      weapon: item.damage ? weapon(item) : undefined,
      armor: item.armor_class ? armor(item) : undefined,
      contents: item.contents
        ? (item.contents as { item: Ref; quantity: number }[]).map((c) => ({ item: ref(c.item.index), quantity: c.quantity }))
        : undefined,
    }),
  );
}

// Starting equipment.

type Item = { item: string | { chosen: string } | { category: string }; quantity: number };

const TOOL_CATEGORIES = new Set(["artisans-tools", "gaming-sets", "musical-instruments"]);

/** The equipment categories of a choice, through the choices nested in it. */
function toolCategories(choice: UpstreamRecord): string[] {
  if (choice.from.option_set_type === "equipment_category") return [choice.from.equipment_category.index];
  return (choice.from.options as UpstreamRecord[]).flatMap((o) => {
    if (o.option_type !== "choice") throw new Error(`Unknown equipment choice: ${choice.desc}`);
    return toolCategories(o.choice);
  });
}

/** One upstream equipment option as items and gold. `chosen` is the key of the typed field whose choice an item takes. */
function equipmentOption(option: UpstreamRecord, chosen: string): { items?: Item[]; gold?: number } {
  const parts: UpstreamRecord[] = option.option_type === "multiple" ? option.items : [option];
  const items: Item[] = [];
  let gold = 0;
  for (const part of parts) {
    if (part.option_type === "money") gold += gp({ quantity: part.count, unit: part.unit }) ?? 0;
    else if (part.option_type === "counted_reference") {
      const isCategory = String(part.of.url).includes("/equipment-categories/");
      items.push({ item: isCategory ? { category: categoryKey(part.of.index) } : ref(part.of.index), quantity: part.count });
    } else if (part.option_type === "choice") {
      // The tool of the tool proficiency: "Gaming Set (same as above)", or the Monk's "Artisan's Tools or
      // Musical Instrument chosen for the tool proficiency above". Upstream gives a choice of tool categories.
      const categories = toolCategories(part.choice);
      if (!categories.every((c) => TOOL_CATEGORIES.has(c))) throw new Error(`Unknown equipment choice: ${categories.join(", ")}`);
      items.push({ item: { chosen }, quantity: 1 });
    } else throw new Error(`Unknown equipment option ${part.option_type}`);
  }
  return compact({ items: items.length ? items : undefined, gold: gold || undefined });
}

function startingEquipment(options: UpstreamRecord[] | undefined, chosen: string) {
  if (!options?.length) return undefined;
  if (options.length !== 1 || options[0].choose !== 1) throw new Error("A starting equipment list that is not one choice");
  return (options[0].from.options as UpstreamRecord[]).map((option) => equipmentOption(option, chosen));
}

// Proficiencies.

const skillKey = (proficiency: string) => {
  if (!proficiency.startsWith("skill-")) throw new Error(`Not a skill: ${proficiency}`);
  return proficiency.slice("skill-".length);
};

const WEAPON_TRAINING: Record<string, string[]> = { "simple-weapons": ["simple"], "martial-weapons": ["martial"] };
const ARMOR_TRAINING: Record<string, string[]> = {
  "light-armor": ["light"],
  "medium-armor": ["medium"],
  "heavy-armor": ["heavy"],
  "all-armor": ["light", "medium", "heavy"],
  shields: ["shield"],
};

/** The upstream items of one equipment category of the format. */
const inCategory = (equipment: Map<string, UpstreamRecord>, category: string) => [...equipment.values()].filter((e) => equipmentCategory(e) === category);

/** The equipment record that a tool proficiency names. */
function toolReference(proficiency: string, proficiencies: Map<string, UpstreamRecord>): string {
  const target = proficiencies.get(proficiency)?.reference as Ref & { url: string };
  if (!target || !target.url.includes("/equipment/")) throw new Error(`Not a tool: ${proficiency}`);
  return ref(target.index);
}

/** A choice of tools: from the equipment of one category when the options are that category, else a list. */
function toolChoice(choice: UpstreamRecord, proficiencies: Map<string, UpstreamRecord>, equipment: Map<string, UpstreamRecord>) {
  const options = choice.from.options as UpstreamRecord[];
  if (options.every((o) => o.option_type === "reference")) {
    const refs = options.map((o) => toolReference(o.item.index, proficiencies));
    const categories = new Set(refs.map((r) => equipmentCategory(equipment.get(parseReference(r).key) as UpstreamRecord)));
    const [only] = categories;
    const all = only && inCategory(equipment, only).length === refs.length;
    return { choose: choice.choose as number, from: categories.size === 1 && all ? { category: only } : refs };
  }
  // The Monk: one kind of Artisan's Tools or one Musical Instrument. Two categories, so the list of both.
  const refs = options.flatMap((o) => {
    if (o.option_type !== "choice") throw new Error("Unknown tool choice");
    if (o.choice.from.option_set_type === "equipment_category") {
      const category = categoryKey(o.choice.from.equipment_category.index);
      return inCategory(equipment, category).map((e) => ref(e.index));
    }
    return (o.choice.from.options as UpstreamRecord[]).map((inner) => toolReference(inner.item.index, proficiencies));
  });
  return { choose: choice.choose as number, from: refs };
}

// Records.

/** An upstream feature with its level as a number. */
type Feature = UpstreamRecord & { index: string; name: string; level: number };

/**
 * The features of one class or subclass in level order, each with its upstream index and its record form.
 * The level is a number upstream, or a level index such as "barbarian-3".
 */
function ownFeatures(upstream: UpstreamRecord[], corrections: Corrections) {
  const own = upstream.map((f) => ({ ...f, level: f.level.index ? levelOf(f.level.index) : f.level }) as Feature).sort((a, b) => a.level - b.level);
  const keys = featureKeys(own);
  return own.map((f, i) => ({
    index: f.index,
    feature: { key: keys[i], name: f.name, text: corrections.featureText(f.index, text(f.description)), level: f.level },
  }));
}

function classRecords(up: Upstream, corrections: Corrections) {
  const proficiencies = up.byIndex("Proficiencies");
  const equipment = up.byIndex("Equipment");
  const features = up.read("Features");
  const levels = up.read("Levels");
  return up.read("Classes").map((c) => {
    const own = ownFeatures(
      features.filter((f) => f.class.index === c.index && !f.subclass),
      corrections,
    );
    const keyByIndex = new Map(own.map((f) => [f.index, f.feature.key]));
    const profs = (c.proficiencies as Ref[]).map((p) => p.index).filter((p) => !p.startsWith("saving-throw-"));
    const skillChoice = (c.proficiency_choices as UpstreamRecord[]).find((pc) =>
      (pc.from.options as UpstreamRecord[]).every((o) => o.item?.index?.startsWith("skill-")),
    );
    const toolChoices = (c.proficiency_choices as UpstreamRecord[]).filter((pc) => pc !== skillChoice);
    if (!skillChoice || toolChoices.length > 1) throw new Error(`Unknown proficiency choices of ${c.index}`);
    const tools = profs.filter((p) => !WEAPON_TRAINING[p] && !ARMOR_TRAINING[p] && proficiencies.get(p)?.type !== "Weapons");
    const rows = levels
      .filter((l) => l.class.index === c.index && !l.subclass)
      .sort((a, b) => a.level - b.level)
      .map((l) =>
        compact({
          level: l.level as number,
          proficiencyBonus: l.prof_bonus as number,
          features: (l.features as Ref[]).map((f) => keyByIndex.get(f.index) ?? fail(`No feature ${f.index}`)).filter(unique),
          columns: l.class_specific
            ? Object.fromEntries(
                Object.entries(l.class_specific as Record<string, unknown>).map(([k, v]) => [
                  kebab(k),
                  typeof v === "object" && v ? `${(v as UpstreamRecord).dice_count}d${(v as UpstreamRecord).dice_value}` : (v as number),
                ]),
              )
            : undefined,
          spellcasting: l.spellcasting
            ? {
                cantrips: l.spellcasting.cantrips_known as number,
                preparedSpells: l.spellcasting.prepared_spells as number,
                slots: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (l.spellcasting[`spell_slots_level_${n}`] as number) ?? 0),
              }
            : undefined,
        }),
      );
    return compact({
      ...head(c),
      hitDie: c.hit_die as 6 | 8 | 10 | 12,
      primaryAbility: c.primary_ability.ability_scores
        ? (c.primary_ability.ability_scores as Ref[]).map((a) => a.index)
        : {
            choose: c.primary_ability.ability_score_options.choose,
            from: (c.primary_ability.ability_score_options.from.options as { item: Ref }[]).map((o) => o.item.index),
          },
      savingThrows: (c.saving_throws as Ref[]).map((a) => a.index) as [string, string],
      skills: { choose: skillChoice.choose as number, from: (skillChoice.from.options as UpstreamRecord[]).map((o) => skillKey(o.item.index)) },
      weaponProficiencies: profs.flatMap(
        (p) => WEAPON_TRAINING[p] ?? (proficiencies.get(p)?.type === "Weapons" ? [(proficiencies.get(p)?.reference as Ref).index] : []),
      ),
      armorTraining: profs.flatMap((p) => ARMOR_TRAINING[p] ?? []),
      tools: toolChoices.length
        ? corrections.classTools(c.index, toolChoice(toolChoices[0], proficiencies, equipment))
        : tools.length
          ? tools.map((t) => toolReference(t, proficiencies))
          : undefined,
      startingEquipment: startingEquipment(c.starting_equipment_options, "tools"),
      features: own.map((f) => f.feature),
      table: rows,
    });
  });
}

function subclassRecords(up: Upstream, corrections: Corrections) {
  const features = up.read("Features");
  return up.read("Subclasses").map((s) => {
    const own = ownFeatures(
      features.filter((f) => f.subclass?.index === s.index),
      corrections,
    );
    return compact({
      ...head(s),
      summary: s.summary as string,
      description: text(s.description),
      class: ref(s.class.index),
      features: own.map((f) => f.feature),
    });
  });
}

function speciesRecords(up: Upstream, corrections: Corrections) {
  const traits = up.byIndex("Traits");
  return up.read("Species").map((s) => {
    const sizes = s.size_options ? (s.size_options.from.options as UpstreamRecord[]).map((o) => String(o.size).toLowerCase()) : undefined;
    const size = corrections.speciesSize(s.index, String(s.size)) ?? (sizes ? { choose: 1, from: sizes } : String(s.size).toLowerCase());
    return {
      ...head(s),
      traits: corrections.speciesTraits(
        s.index,
        (s.traits as Ref[]).map((t) => {
          const trait = traits.get(t.index) ?? fail(`No trait ${t.index}`);
          const name = traitName(trait.name);
          return { key: keyFromName(name), name, text: text(trait.description) };
        }),
      ),
      creatureType: String(s.type).toLowerCase(),
      size,
      speed: s.speed as number,
    };
  });
}

function backgroundRecords(up: Upstream) {
  const proficiencies = up.byIndex("Proficiencies");
  const equipment = up.byIndex("Equipment");
  return up.read("Backgrounds").map((b) => {
    const profs = (b.proficiencies as Ref[]).map((p) => p.index);
    const skills = profs.filter((p) => p.startsWith("skill-")).map(skillKey);
    const tools = profs.filter((p) => !p.startsWith("skill-"));
    const choices = (b.proficiency_choices ?? []) as UpstreamRecord[];
    if (skills.length !== 2 || tools.length + choices.length !== 1) throw new Error(`Unknown proficiencies of ${b.index}`);
    return compact({
      ...head(b),
      abilityScores: (b.ability_scores as Ref[]).map((a) => a.index) as [string, string, string],
      feat: ref(b.feat.index),
      // "Magic Initiate (Cleric)": upstream gives the spell list as a note.
      featSpellList: b.feat.note ? ref(keyFromName(b.feat.note)) : undefined,
      skills: skills as [string, string],
      tool: tools.length ? toolReference(tools[0], proficiencies) : toolChoice(choices[0], proficiencies, equipment),
      startingEquipment: startingEquipment(b.equipment_options, "tool"),
    });
  });
}

const BENEFIT = /^\*\*(.+?)\.\*\*\s*(.*)$/;

/** The prose of a feat: the lines before the first benefit, and each benefit as a trait (SRD 5.2.1 p87). */
function featProse(feat: UpstreamRecord) {
  let description: string[] = [];
  const traits: { key: string; name: string; text: string }[] = [];
  for (const line of text(feat.description).split("\n")) {
    const benefit = BENEFIT.exec(line);
    if (benefit) traits.push({ key: keyFromName(benefit[1]), name: benefit[1], text: benefit[2] });
    else if (traits.length) traits[traits.length - 1].text += `\n${line}`;
    else description = [...description, line];
  }
  if (feat.repeatable) traits.push({ key: "repeatable", name: "Repeatable", text: text(feat.repeatable) });
  return { description: description.join("\n") || undefined, traits: traits.length ? traits : undefined };
}

/** The prerequisites of a feat. A feature prerequisite passes when the character has a feature of that name from any class. */
function featPrerequisites(feat: UpstreamRecord, classFeatures: { reference: string; key: string; name: string }[]) {
  const list: { label: string; test: unknown }[] = [];
  const p = feat.prerequisites as UpstreamRecord | undefined;
  if (p?.minimum_level) list.push({ label: `Level ${p.minimum_level}+`, test: { atLeast: [{ read: "totalLevel" }, p.minimum_level] } });
  if (feat.prerequisite_options) {
    const choice = feat.prerequisite_options;
    const tests = (choice.from.options as UpstreamRecord[]).map((o) => {
      if (o.option_type !== "score_prerequisite") throw new Error(`Unknown prerequisite of ${feat.index}`);
      return { atLeast: [{ read: "abilities", entry: String(o.ability_score.index).trim() }, o.minimum_score] };
    });
    list.push({ label: choice.desc as string, test: { any: tests } });
  }
  if (p?.feature_named) {
    const named = classFeatures.filter((f) => f.name === p.feature_named);
    if (!named.length) throw new Error(`No feature named ${p.feature_named}`);
    list.push({ label: `${p.feature_named} Feature`, test: { any: named.map((f) => ({ has: "features", item: `${f.reference}/${f.key}` })) } });
  }
  return list.length ? list : undefined;
}

function featRecords(up: Upstream, classes: ReturnType<typeof classRecords>) {
  const classFeatures = classes.flatMap((c) => c.features.map((f) => ({ reference: ref(c.key), key: f.key, name: f.name })));
  return up.read("Feats").map((f) =>
    compact({
      ...head(f),
      ...featProse(f),
      category: f.type as string,
      repeatable: Boolean(f.repeatable),
      prerequisites: featPrerequisites(f, classFeatures),
    }),
  );
}

function spellRecords(up: Upstream, corrections: Corrections) {
  return up.read("Spells").map((s) => {
    const fixed = corrections.spell(s.index, {
      range: s.range as string,
      components: s.components as string[],
      material: s.material as string | undefined,
      duration: s.duration as string,
      concentration: Boolean(s.concentration),
    });
    return compact({
      ...head(s),
      description: corrections.spellText(s.index, text(s.description)),
      level: s.level as number,
      school: s.school.index as string,
      classes: (s.classes as Ref[]).map((c) => ref(c.index)),
      castingTime: s.casting_time as string,
      ritual: Boolean(s.ritual),
      range: fixed.range,
      components: compact({
        verbal: fixed.components.includes("V"),
        somatic: fixed.components.includes("S"),
        material: fixed.components.includes("M") ? fixed.material : undefined,
      }),
      duration: fixed.duration,
      concentration: fixed.concentration,
      higherLevels: s.higher_level ? text(s.higher_level) : undefined,
    });
  });
}

function referenceRecords(up: Upstream, corrections: Corrections) {
  const plain = (file: string) => up.read(file).map((r) => compact({ ...head(r), description: text(r.description) || undefined }));
  return {
    abilities: up.read("Ability-Scores").map((a) => ({ ...head(a, a.full_name), description: text(a.description) })),
    skills: up.read("Skills").map((s) => ({ ...head(s), description: text(s.description), ability: s.ability_score.index })),
    languages: up.read("Languages").map((l) => compact({ ...head(l), description: text(l.note) || undefined, rare: Boolean(l.is_rare) })),
    conditions: plain("Conditions").map((c) => ({ ...c, description: corrections.conditionText(c.key, c.description ?? "") })),
    damageTypes: plain("Damage-Types"),
    weaponMasteries: plain("Weapon-Mastery-Properties"),
    weaponProperties: plain("Weapon-Properties"),
  };
}

/** The srd52 pack from an upstream checkout. */
export function buildPack(dataDir: string, corrections: Corrections = CORRECTIONS) {
  const up = new Upstream(dataDir);
  const classes = classRecords(up, corrections);
  const equipment = corrections.equipment(equipmentRecords(up));
  return {
    format: FORMAT,
    version: CURRENT_VERSION,
    rules: "2024",
    pack: { id: SRD_PACK, name: "SRD 5.2.1", license: "CC-BY-4.0", attribution: ATTRIBUTION, modified: true },
    classes,
    subclasses: subclassRecords(up, corrections),
    species: speciesRecords(up, corrections),
    backgrounds: backgroundRecords(up),
    feats: featRecords(up, classes),
    spells: spellRecords(up, corrections),
    equipment,
    ...referenceRecords(up, corrections),
  };
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

function notice(checkout: string): string {
  const license = readFileSync(join(checkout, "LICENSE.md"), "utf8").trim();
  return `# 5e-bits notice

\`srd52.json\` is converted from the SRD 5.2 data of 5e-bits/5e-srd-api
(${UPSTREAM.repository}), at the commit in \`srd52.provenance.json\`. The
structure and the text that 5e-bits wrote have this license:

${license}
`;
}

function main(argv: string[]) {
  const [checkout, flag] = argv;
  if (!checkout) throw new Error("Usage: bun scripts/import-srd.ts <checkout of 5e-srd-api> [--check]");
  const git = (...args: string[]) => execFileSync("git", ["-C", checkout, ...args], { encoding: "utf8" }).trim();
  const commit = git("rev-parse", "HEAD");
  if (commit !== UPSTREAM.commit) throw new Error(`The checkout is at ${commit}. Check out ${UPSTREAM.commit}, or change the pin in this script.`);

  const pack = buildPack(join(checkout, UPSTREAM.data));
  const { issues } = loadPack(pack);
  if (issues.length) throw new Error(`The pack does not load:\n${issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n")}`);

  const files: Record<string, string> = {
    "srd52.json": json(pack),
    "srd52.provenance.json": json({ repository: UPSTREAM.repository, commit, date: git("log", "-1", "--format=%cI"), path: UPSTREAM.data }),
    "NOTICE-5e-bits.md": notice(checkout),
  };
  if (flag === "--check") {
    const stale = Object.entries(files).filter(([name, content]) => readFileSync(join(CONTENT, name), "utf8") !== content);
    if (stale.length) throw new Error(`These files differ from a new run: ${stale.map(([name]) => name).join(", ")}`);
    console.log("The committed files are the same as a new run.");
    return;
  }
  mkdirSync(CONTENT, { recursive: true });
  for (const [name, content] of Object.entries(files)) writeFileSync(join(CONTENT, name), content);
  console.log(`Wrote ${Object.keys(files).join(", ")} to ${CONTENT}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
