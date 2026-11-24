// The schema of a 2024 content pack (docs/design/2024-content-format.md).
// One schema validates the built-in packs and homebrew, and gives the
// TypeScript types of the records. The library is Zod 4: each issue has the
// path of the bad value, and the types come from the schema.

import { z } from "zod";
import { KEY_PATTERN, REFERENCE_PATTERN } from "./keys.ts";

/** The `format` of every pack. */
export const FORMAT = "alchemy-content";
/** The version of the format that this engine reads and writes. */
export const CURRENT_VERSION = 1;

/**
 * The record types, in the order of a pack file. The last seven are the
 * reference data: the words that the rules records use, with their prose.
 */
export const RECORD_TYPES = [
  "classes",
  "subclasses",
  "species",
  "backgrounds",
  "feats",
  "spells",
  "equipment",
  "monsters",
  "abilities",
  "skills",
  "languages",
  "conditions",
  "damageTypes",
  "weaponMasteries",
  "weaponProperties",
] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

// The building blocks.

export const ContentKey = z.string().regex(KEY_PATTERN, "A key has lowercase letters, digits and hyphens only");
export const ContentReference = z.string().regex(REFERENCE_PATTERN, "A reference is a pack id, a colon and a key, for example srd52:fireball");
/** The name of a value of the built character, in camel case: `maxHitPoints`. The engine checks that it exists. */
export const SheetValue = z.string().regex(/^[a-z][A-Za-z0-9]*$/, "A sheet value name is in camel case, for example maxHitPoints");

export const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
export const Ability = z.enum(ABILITY_KEYS);
export const Size = z.enum(["tiny", "small", "medium", "large", "huge", "gargantuan"]);
export const Rest = z.enum(["short-rest", "long-rest"]);

/** A choice in a typed field: `{ "choose": 1, "from": [...] }`. */
export const choiceOf = <T extends z.ZodType>(item: T) => z.strictObject({ choose: z.int().min(1), from: z.array(item).min(1) });

/** Where an effect or a record came from upstream. */
export const Source = z.strictObject({ index: z.string().optional() });

/** One trait of a species, or one benefit of a feat: display only. Its key is unique in its record. */
export const Trait = z.strictObject({ key: ContentKey, name: z.string().min(1), text: z.string() });

// Values and conditions. Keep them few: a rule that needs more is a hook.

export type Value = number | string | boolean | { read: string; entry?: string } | { sum: Value[]; min?: number } | { steps: [number, Value][]; by: Value };

/**
 * A value in an effect.
 *
 * - A constant: a number, a string, or a boolean.
 * - `{ "read": "proficiencyBonus" }`: a sheet value. With `entry`, one
 *   entry of a sheet value that is a record: `{ "read": "classLevels", "entry": "srd52:fighter" }`.
 * - `{ "sum": [...], "min": 1 }`: the sum of numbers, and not less than `min`.
 * - `{ "steps": [[1, 2], [4, 3], [10, 4]], "by": ... }`: the value of the
 *   highest step whose number is at most `by`, and 0 below the first step.
 *   For example, uses by class level.
 */
export const Value: z.ZodType<Value> = z.lazy(() =>
  z.union([
    z.number(),
    z.string(),
    z.boolean(),
    z.strictObject({ read: SheetValue, entry: z.string().optional() }),
    z.strictObject({ sum: z.array(Value).min(1), min: z.number().optional() }),
    z.strictObject({ steps: z.array(z.tuple([z.number(), Value])).min(1), by: Value }),
  ]),
);

export type Condition =
  | { has: string; item?: string }
  | { atLeast: [Value, Value] }
  | { equals: [Value, Value] }
  | { not: Condition }
  | { any: Condition[] }
  | { all: Condition[] };

/**
 * A condition on an effect or a prerequisite of an option.
 *
 * - `{ "has": "wornArmor" }`: the sheet value is not empty. With `item`, the
 *   list has the item, or an item with that `key`.
 * - `{ "atLeast": [a, b] }`: a is at least b.
 * - `{ "equals": [a, b] }`.
 * - `{ "not": ... }`, `{ "any": [...] }`, `{ "all": [...] }`.
 */
export const Condition: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.strictObject({ has: SheetValue, item: z.string().optional() }),
    z.strictObject({ atLeast: z.tuple([Value, Value]) }),
    z.strictObject({ equals: z.tuple([Value, Value]) }),
    z.strictObject({ not: Condition }),
    z.strictObject({ any: z.array(Condition).min(1) }),
    z.strictObject({ all: z.array(Condition).min(1) }),
  ]),
);

/** A prerequisite of a record or of an option: the label that the builder shows, and the test. */
export const Prerequisite = z.strictObject({ label: z.string().min(1), test: Condition });

// Effects: the rules layer.

const common = { name: z.string().min(1).optional() };
const conditional = { ...common, when: Condition.optional() };

export const Recovery = z.strictObject({ on: Rest, amount: z.union([z.int().min(1), z.literal("all")]) });

export type Effect =
  | { set: string; value: Value; name?: string; when?: Condition }
  | { add: string; value: Value; name?: string; when?: Condition }
  | { push: string; value: Value; name?: string; when?: Condition }
  | { uses: { trait: string; amount: Value; recover: z.infer<typeof Recovery>[] }; name?: string }
  | { grantFeat: string; name?: string }
  | { selection: SelectionEffect; name?: string }
  | { hook: string; args?: Record<string, unknown>; name?: string };

export interface SelectionOption {
  key: string;
  name: string;
  effects?: Effect[];
  prerequisites?: z.infer<typeof Prerequisite>[];
}

export interface SelectionEffect {
  key: string;
  name: string;
  choose: number;
  from: SelectionOption[];
}

export const SelectionOption: z.ZodType<SelectionOption> = z.lazy(() =>
  z.strictObject({
    key: ContentKey,
    name: z.string().min(1),
    effects: z.array(Effect).optional(),
    prerequisites: z.array(Prerequisite).optional(),
  }),
);

/**
 * One rule of a record.
 *
 * - `set`, `add`, `push`: change a sheet value. `add` needs a number, and
 *   `push` adds one item to a list.
 * - `uses`: give uses and their recovery to a trait of the record.
 * - `grantFeat`: give a feat with its effects and its choices.
 * - `selection`: a choice with a count and a list of options.
 * - `hook`: call a named rule of the engine with arguments.
 */
export const Effect: z.ZodType<Effect> = z.lazy(() =>
  z.union([
    z.strictObject({ set: SheetValue, value: Value, ...conditional }),
    z.strictObject({ add: SheetValue, value: Value, ...conditional }),
    z.strictObject({ push: SheetValue, value: Value, ...conditional }),
    z.strictObject({ uses: z.strictObject({ trait: ContentKey, amount: Value, recover: z.array(Recovery).min(1) }), ...common }),
    z.strictObject({ grantFeat: ContentReference, ...common }),
    z.strictObject({
      selection: z.strictObject({ key: ContentKey, name: z.string().min(1), choose: z.int().min(1), from: z.array(SelectionOption).min(1) }),
      ...common,
    }),
    z.strictObject({ hook: ContentKey, args: z.record(z.string(), z.unknown()).optional(), ...common }),
  ]),
);

/** The fields of every record: the display layer, and the optional rules layer. */
const recordFields = {
  key: ContentKey,
  name: z.string().min(1),
  source: Source.optional(),
  description: z.string().optional(),
  traits: z.array(Trait).optional(),
  effects: z.array(Effect).optional(),
};

/** A feature of a class or a subclass: a trait at a class level. */
export const LevelFeature = Trait.extend({ level: z.int().min(1).max(20) });

/** The effects that a class or a subclass gives at one class level. */
export const LevelEffects = z.strictObject({ level: z.int().min(1).max(20), effects: z.array(Effect) });

/**
 * An item of starting equipment or of the contents of a pack: a reference,
 * the item that the character chose in a typed field (`{ "chosen": "tool" }`),
 * or one item of an equipment category that the character chooses
 * (`{ "category": "holy-symbol" }`).
 */
export const EquipmentItem = z.strictObject({
  item: z.union([ContentReference, z.strictObject({ chosen: ContentKey }), z.strictObject({ category: ContentKey })]),
  quantity: z.int().min(1),
});

/** One option of the starting equipment: items and gold pieces. */
export const EquipmentOption = z.strictObject({ items: z.array(EquipmentItem).optional(), gold: z.number().min(0).optional() });

/** A list of references, or a choice from a list or from the equipment of a category. */
const ReferenceChoice = z.strictObject({
  choose: z.int().min(1),
  from: z.union([z.array(ContentReference).min(1), z.strictObject({ category: ContentKey })]),
});

/**
 * One row of the table of a class: the values at one class level. `columns`
 * holds the class columns, for example `{ "rage-count": 2 }`. A die is its
 * size, and a number of dice is a string such as "1d6".
 */
export const ClassLevelRow = z.strictObject({
  level: z.int().min(1).max(20),
  proficiencyBonus: z.int().min(2).max(6),
  /** The keys of the features that the class gives at this level. */
  features: z.array(ContentKey),
  columns: z.record(ContentKey, z.union([z.int(), z.string()])).optional(),
  spellcasting: z
    .strictObject({
      cantrips: z.int().min(0),
      preparedSpells: z.int().min(0),
      /** The spell slots of levels 1 to 9. */
      slots: z.array(z.int().min(0)).length(9),
    })
    .optional(),
});

// The record types.

export const ClassRecord = z.strictObject({
  ...recordFields,
  hitDie: z.union([z.literal(6), z.literal(8), z.literal(10), z.literal(12)]),
  /** All of the abilities ("Dexterity and Wisdom"), or a choice of them ("Strength or Dexterity"). */
  primaryAbility: z.union([z.array(Ability).min(1), choiceOf(Ability)]).optional(),
  savingThrows: z.tuple([Ability, Ability]),
  skills: choiceOf(ContentKey),
  weaponProficiencies: z.array(ContentKey).optional(),
  armorTraining: z.array(ContentKey).optional(),
  tools: z.union([z.array(ContentReference), ReferenceChoice]).optional(),
  startingEquipment: z.array(EquipmentOption).optional(),
  /**
   * The traits of the class that a character gets when the class is not the
   * first class ("As a Multiclass Character"): the Hit Point Die and the
   * level 1 features always, and these proficiencies. Data for ORC-234.
   */
  multiclass: z
    .strictObject({
      weaponProficiencies: z.array(ContentKey).optional(),
      armorTraining: z.array(ContentKey).optional(),
      skills: choiceOf(ContentKey).optional(),
      tools: z.union([z.array(ContentReference), ReferenceChoice]).optional(),
    })
    .optional(),
  features: z.array(LevelFeature).optional(),
  levels: z.array(LevelEffects).optional(),
  /** The class table, one row for each level from 1 to 20. Display only: the rules are in `levels`. */
  table: z.array(ClassLevelRow).optional(),
});

export const SubclassRecord = z.strictObject({
  ...recordFields,
  class: ContentReference,
  /** The line under the name of the subclass, for example "Channel Rage into Violent Fury". */
  summary: z.string().optional(),
  features: z.array(LevelFeature).optional(),
  levels: z.array(LevelEffects).optional(),
});

export const SpeciesRecord = z.strictObject({
  ...recordFields,
  creatureType: ContentKey,
  size: z.union([Size, choiceOf(Size)]),
  speed: z.int().min(0),
});

export const BackgroundRecord = z.strictObject({
  ...recordFields,
  abilityScores: z.tuple([Ability, Ability, Ability]),
  feat: ContentReference,
  /** For Magic Initiate: the class whose spell list the feat uses, for example `srd52:cleric`. */
  featSpellList: ContentReference.optional(),
  skills: z.tuple([ContentKey, ContentKey]),
  tool: z.union([ContentReference, ReferenceChoice]),
  startingEquipment: z.array(EquipmentOption).optional(),
});

export const FEAT_CATEGORIES = ["origin", "general", "fighting-style", "epic-boon"] as const;

export const FeatRecord = z.strictObject({
  ...recordFields,
  category: z.enum(FEAT_CATEGORIES),
  repeatable: z.boolean(),
  prerequisites: z.array(Prerequisite).optional(),
});

export const SPELL_SCHOOLS = ["abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion", "necromancy", "transmutation"] as const;

export const SpellRecord = z.strictObject({
  ...recordFields,
  level: z.int().min(0).max(9),
  school: z.enum(SPELL_SCHOOLS),
  classes: z.array(ContentReference),
  castingTime: z.string().min(1),
  ritual: z.boolean(),
  range: z.string().min(1),
  components: z.strictObject({ verbal: z.boolean(), somatic: z.boolean(), material: z.string().nullable().optional() }),
  duration: z.string().min(1),
  concentration: z.boolean(),
  higherLevels: z.string().optional(),
});

export const WEAPON_MASTERIES = ["cleave", "graze", "nick", "push", "sap", "slow", "topple", "vex"] as const;

export const Weapon = z.strictObject({
  category: z.enum(["simple", "martial"]),
  ranged: z.boolean(),
  damage: z.strictObject({ count: z.int().min(1), die: z.int().min(1), type: ContentKey }),
  properties: z.array(ContentKey),
  mastery: z.enum(WEAPON_MASTERIES),
  /** Feet: the normal range and the long range. */
  range: z.tuple([z.int().min(0), z.int().min(0)]).optional(),
  /** The damage with two hands, for a Versatile weapon. */
  versatile: z.strictObject({ count: z.int().min(1), die: z.int().min(1) }).optional(),
});

export const Armor = z.strictObject({
  category: z.enum(["light", "medium", "heavy", "shield"]),
  /** The Armor Class before the Dexterity modifier, or the bonus of a shield. */
  base: z.int().min(0),
  /** The most Dexterity modifier that counts: null for no limit. */
  dexLimit: z.int().min(0).nullable(),
  strength: z.int().min(0).optional(),
  stealthDisadvantage: z.boolean().optional(),
});

export const EquipmentRecord = z.strictObject({
  ...recordFields,
  /** For example "weapon", "armor", "gaming-set" or "adventuring-gear". */
  category: ContentKey,
  /** Gold pieces. */
  cost: z.number().min(0).optional(),
  /** Pounds. */
  weight: z.number().min(0).optional(),
  weapon: Weapon.optional(),
  armor: Armor.optional(),
  /** What an equipment pack holds. */
  contents: z.array(EquipmentItem).optional(),
});

export const MonsterRecord = z.strictObject({
  ...recordFields,
  size: Size,
  creatureType: ContentKey,
  challengeRating: z.number().min(0),
  armorClass: z.int().min(0),
  hitPoints: z.int().min(1),
  /** Feet, for each kind of speed: { "walk": 40, "swim": 40 }. */
  speed: z.record(ContentKey, z.int().min(0)),
  abilities: z.strictObject(Object.fromEntries(ABILITY_KEYS.map((a) => [a, z.int().min(1).max(30)])) as Record<(typeof ABILITY_KEYS)[number], z.ZodInt>),
});

// The reference data. Display only: a record has no effects, and the rules
// records name it by its key, for example "poison" in `resistances`.

const referenceFields = { key: ContentKey, name: z.string().min(1), source: Source.optional(), description: z.string().optional() };

export const AbilityRecord = z.strictObject({ ...referenceFields, key: Ability });
export const SkillRecord = z.strictObject({ ...referenceFields, ability: Ability });
export const LanguageRecord = z.strictObject({ ...referenceFields, rare: z.boolean() });
export const ConditionRecord = z.strictObject(referenceFields);
export const DamageTypeRecord = z.strictObject(referenceFields);
export const WeaponMasteryRecord = z.strictObject({ ...referenceFields, key: z.enum(WEAPON_MASTERIES) });
export const WeaponPropertyRecord = z.strictObject(referenceFields);

/** The schema of each record type. */
export const RECORD_SCHEMAS = {
  classes: ClassRecord,
  subclasses: SubclassRecord,
  species: SpeciesRecord,
  backgrounds: BackgroundRecord,
  feats: FeatRecord,
  spells: SpellRecord,
  equipment: EquipmentRecord,
  monsters: MonsterRecord,
  abilities: AbilityRecord,
  skills: SkillRecord,
  languages: LanguageRecord,
  conditions: ConditionRecord,
  damageTypes: DamageTypeRecord,
  weaponMasteries: WeaponMasteryRecord,
  weaponProperties: WeaponPropertyRecord,
} as const satisfies Record<RecordType, z.ZodType>;

export type ClassRecord = z.infer<typeof ClassRecord>;
export type SubclassRecord = z.infer<typeof SubclassRecord>;
export type SpeciesRecord = z.infer<typeof SpeciesRecord>;
export type BackgroundRecord = z.infer<typeof BackgroundRecord>;
export type FeatRecord = z.infer<typeof FeatRecord>;
export type SpellRecord = z.infer<typeof SpellRecord>;
export type EquipmentRecord = z.infer<typeof EquipmentRecord>;
export type MonsterRecord = z.infer<typeof MonsterRecord>;
export type ClassLevelRow = z.infer<typeof ClassLevelRow>;
export type Trait = z.infer<typeof Trait>;
export type Prerequisite = z.infer<typeof Prerequisite>;
export type Recovery = z.infer<typeof Recovery>;

/** The record of each type. */
export interface Records {
  classes: ClassRecord;
  subclasses: SubclassRecord;
  species: SpeciesRecord;
  backgrounds: BackgroundRecord;
  feats: FeatRecord;
  spells: SpellRecord;
  equipment: EquipmentRecord;
  monsters: MonsterRecord;
  abilities: z.infer<typeof AbilityRecord>;
  skills: z.infer<typeof SkillRecord>;
  languages: z.infer<typeof LanguageRecord>;
  conditions: z.infer<typeof ConditionRecord>;
  damageTypes: z.infer<typeof DamageTypeRecord>;
  weaponMasteries: z.infer<typeof WeaponMasteryRecord>;
  weaponProperties: z.infer<typeof WeaponPropertyRecord>;
}
export type AnyRecord = Records[RecordType];

/** The envelope of a pack: everything but the record lists. */
export const PackInfo = z.strictObject({
  id: ContentKey,
  name: z.string().min(1),
  license: z.string().optional(),
  /** The statement that the license of the content requires. Optional for homebrew. */
  attribution: z.string().optional(),
  /** true when the content differs from its source. CC-BY-4.0 requires that we say so. */
  modified: z.boolean().optional(),
});
export type PackInfo = z.infer<typeof PackInfo>;

export const Envelope = z.object({
  format: z.literal(FORMAT),
  version: z.int().min(1),
  rules: z.literal("2024"),
  pack: PackInfo,
});

/** A pack after the loader: the envelope and a list for each record type. */
export type Pack = z.infer<typeof Envelope> & { [T in RecordType]: Records[T][] };
