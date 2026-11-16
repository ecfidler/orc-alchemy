// The facade of the spike: an `evaluate` with the shape of the one in
// `@pubdoor/dmv`, for `rules: "2024"`. Its types come from the 0.4.0
// `types/index.d.ts`, so this file records where those types describe a
// second engine and where they do not.

import type { AbilityKey, AvailableSelection, BuiltCharacter, Feature as SharedFeature } from "@pubdoor/dmv";
import { actualPath, availableSelections, build, countRemaining, selectedKeys } from "../core/build.ts";
import type { StrictEntity } from "../core/entity.ts";
import { ARMOR } from "./content/armor.ts";
import { ABILITIES, type Ability, type AbilityScores, type FeatTaken, type Feature, type Sheet, type WeaponAttack } from "./sheet.ts";
import { template2024 } from "./template.ts";

/** A stored 2024 character: the choices, and the free values. */
export type Entity2024 = StrictEntity<Pick<Sheet, "name">>;

/**
 * The keys of the shared `BuiltCharacter` that the slice fills with the
 * meaning the type documents.
 */
export type SharedKey =
  | "character-name"
  | "background"
  | "classes"
  | "levels"
  | "total-levels"
  | "class-level"
  | "abilities"
  | "ability-bonuses"
  | "proficiency-bonus"
  | "saving-throws"
  | "save-bonuses"
  | "skill-profs"
  | "skill-bonuses"
  | "passive-perception"
  | "initiative"
  | "armor-profs"
  | "weapon-profs"
  | "tool-profs"
  | "languages"
  | "armor-class"
  | "armor-class-with-armor"
  | "max-hit-points"
  | "base-land-speed"
  | "darkvision"
  | "number-of-attacks"
  | "traits"
  | "feats";

/**
 * The other keys of `BuiltCharacter`, each with the reason the slice leaves
 * it out. "Not in the slice" marks a key that the spike did not reach and
 * that gives no evidence. Any other reason is a finding about the type. The
 * `Record` type makes the list complete: a key of `BuiltCharacter` that is
 * in neither list is a compile error.
 */
export const NOT_SHARED: Record<Exclude<keyof BuiltCharacter, SharedKey>, string> = {
  race: 'The 2024 rules have species, not races. The value fits, the name does not. The slice returns "species".',
  subrace: "The 2024 rules have no subraces. A lineage is a choice inside the species.",
  "skill-expertise": "Not in the slice.",
  "tool-bonus": "Not in the slice.",
  "current-hit-points": "Not in the slice.",
  "base-flying-speed": "Not in the slice.",
  "base-swimming-speed": "Not in the slice.",
  "unarmored-speed-bonus": "Not in the slice.",
  "speed-with-armor": "Not in the slice.",
  "weapon-modifiers":
    'The value has the 2014 attack model: "standard" and "finesse" numbers, a "dual-wield?" flag, and no place for a mastery property or a bonus for Ranged weapons only. The slice returns "weaponAttacks".',
  attacks: "Not in the slice.",
  "spell-slots": "Not in the slice.",
  "spells-known": "Not in the slice.",
  "spell-modifiers": "Not in the slice.",
  "spell-save-dc": "Not in the slice.",
  "spell-attack-modifier": "Not in the slice.",
  "prepares-spells": "Not in the slice.",
  "prepare-spell-count": "Not in the slice.",
  actions: "Not in the slice.",
  "bonus-actions": "Not in the slice.",
  reactions: "Not in the slice.",
  weapons:
    'An inventory with namespaced 2014 keys such as "orcpub.dnd.e5.character.equipment/quantity". The slice returns the carried weapon keys in "weaponAttacks".',
  armor: 'An inventory with namespaced 2014 keys. The slice returns the worn armor in "armor-class-with-armor".',
  equipment: "Not in the slice.",
  treasure: "Not in the slice.",
  "magic-weapons": "Not in the slice.",
  "magic-armor": "Not in the slice.",
  "magic-items": "Not in the slice.",
};

/** What the 2024 slice has and the shared type has no key for. */
export interface Extension2024 {
  species: string | null;
  creatureType: string;
  size: Sheet["size"];
  /** Each feat with its category. The shared "feats" has only the keys. */
  featsTaken: readonly FeatTaken[];
  /** Weapon keys. */
  weaponMasteries: readonly string[];
  weaponAttacks: readonly WeaponAttack[];
  /** The lowest d20 roll that is a Critical Hit. */
  criticalHitMinimum: number;
  resistances: readonly string[];
  /**
   * Every feature with its key, its source and its uses. The shared
   * "traits" has the same features, but its "frequency" holds one amount
   * and one unit, so it cannot say that Second Wind regains one use on a
   * Short Rest and all uses on a Long Rest.
   */
  features: readonly Feature[];
}

export type Built2024 = Pick<BuiltCharacter, SharedKey> & Extension2024;

export interface Evaluation2024 {
  built: Built2024;
  selections: AvailableSelection[];
}

export interface EvaluateOptions2024 {
  rules: "2024";
}

// The shared type names each ability with the 2014 engine's namespace.
const abilityKey = (ability: Ability) => `orcpub.dnd.e5.character/${ability}` as AbilityKey;

function byAbilityKey(scores: AbilityScores): Record<AbilityKey, number> {
  return Object.fromEntries(ABILITIES.map((ability) => [abilityKey(ability), scores[ability]])) as Record<AbilityKey, number>;
}

/** Each key as proficient, with no source named: the slice does not record sources. */
function withoutSources(keys: readonly string[]): Record<string, Record<string, boolean>> {
  return Object.fromEntries(keys.map((key) => [key, { nil: true }]));
}

function sharedFeature(feature: Feature): SharedFeature {
  return {
    name: feature.name,
    summary: feature.summary,
    ...(feature.level === undefined ? {} : { "class-key": feature.source, level: feature.level }),
    ...(feature.uses ? { frequency: { amount: feature.uses.amount, units: feature.uses.recharge } } : {}),
  };
}

/** The built 2024 sheet of an entity, as prerequisites read it. */
export function buildSheet(entity: Entity2024): Sheet {
  return build<Sheet>(entity, template2024);
}

/**
 * Builds a 2024 character. Throws when options.rules is not "2024": the
 * 2014 rules are in `@pubdoor/dmv`.
 */
export function evaluate(entity: Entity2024, options: EvaluateOptions2024): Evaluation2024 {
  if (options.rules !== "2024") throw new Error(`Unsupported rules edition: ${String(options.rules)}`);
  const sheet = buildSheet(entity);
  const wornArmor = ARMOR.find((armor) => armor.key === sheet.wornArmor);
  const classNames = new Map(template2024.selections.find((s) => s.key === "class")?.options.map((o) => [o.key, o.name]));

  const built: Built2024 = {
    "character-name": sheet.name || null,
    background: sheet.background,
    classes: [...sheet.classes],
    levels: Object.fromEntries(
      sheet.classes.map((key) => [
        key,
        {
          "class-level": sheet.classLevels[key] ?? 0,
          "class-name": classNames.get(key) ?? key,
          "hit-die": sheet.hitDice[key] ?? 0,
          ...(sheet.subclasses[key] ? { subclass: sheet.subclasses[key] } : {}),
        },
      ]),
    ),
    "total-levels": sheet.totalLevel,
    "class-level": { ...sheet.classLevels },
    abilities: byAbilityKey(sheet.abilities),
    "ability-bonuses": byAbilityKey(sheet.abilityModifiers),
    "proficiency-bonus": sheet.proficiencyBonus,
    "saving-throws": sheet.savingThrowProficiencies.map(abilityKey),
    "save-bonuses": byAbilityKey(sheet.saveBonuses),
    "skill-profs": withoutSources(sheet.skillProficiencies),
    "skill-bonuses": { ...sheet.skillBonuses },
    "passive-perception": sheet.passivePerception,
    initiative: sheet.initiative,
    "armor-profs": [...sheet.armorTraining],
    "weapon-profs": [...sheet.weaponProficiencies],
    "tool-profs": withoutSources(sheet.toolProficiencies),
    languages: [...sheet.languages],
    "armor-class": sheet.unarmoredArmorClass,
    "armor-class-with-armor":
      wornArmor || sheet.shield ? [{ armor: wornArmor?.key ?? null, shield: sheet.shield ? "shield" : null, ac: sheet.armorClass }] : [],
    "max-hit-points": sheet.maxHitPoints,
    "base-land-speed": sheet.speed,
    darkvision: sheet.darkvision,
    "number-of-attacks": sheet.attacksPerAction,
    traits: sheet.features.map(sharedFeature),
    feats: sheet.feats.map((feat) => feat.key),

    species: sheet.species,
    creatureType: sheet.creatureType,
    size: sheet.size,
    featsTaken: sheet.feats,
    weaponMasteries: sheet.weaponMasteries,
    weaponAttacks: sheet.weaponAttacks,
    criticalHitMinimum: sheet.criticalHitMinimum,
    resistances: sheet.resistances,
    features: sheet.features,
  };

  const selections = availableSelections(entity, sheet, template2024).map((selection): AvailableSelection => {
    const selected = selectedKeys(entity, selection);
    return {
      key: selection.key,
      name: selection.name,
      path: selection.path,
      actualPath: [...actualPath(selection)],
      min: selection.min,
      max: selection.max,
      remaining: countRemaining(entity, selection),
      optionCount: selection.options.length,
      selected,
      ...(selection.ref ? { ref: [...selection.ref] } : {}),
      ...(selection.multiselect ? { multiselect: true as const } : {}),
      ...(selection.sequential ? { sequential: true as const } : {}),
      ...(selection.requireValue ? { requireValue: true as const } : {}),
    };
  });

  return { built, selections };
}
