// The app-owned character sheet (ORC-48, rules option E). Components render
// a Sheet and never read the engine's built character; toSheet is the one
// adapter from the 2014 engine. A later engine needs a second adapter, not a
// second sheet. Numbers stay numbers and components format them; only the
// ready-to-print feature and attack text is formatted here.
import type { Amount, Built2014, Feature, Inventory, StrictEntity } from "@pubdoor/dmv";
import { untag } from "./content.ts";
import { type HitDiceAction, type HitDie, hitDiceLeft, hitDiceTotals } from "./hit-dice.ts";
import type { HitPointAction } from "./hit-points.ts";
import { currentHitPoints, type DeathSaves, deathSaves, featureUsesSpent, hitDiceSpent, tempHitPoints } from "./play.ts";
import { preparedSpells, type SlotGroup, type SpentSlotGroups, slotLayout, spentSlotGroups } from "./spells.ts";

export type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";

/** A content key with its display name. */
export interface Named {
  key: string;
  name: string;
}

export interface SheetClass extends Named {
  level: number;
  hitDie: number;
  subclass: string | null;
}

export interface SheetAbility {
  ability: Ability;
  score: number;
  modifier: number;
  save: number;
  saveProficient: boolean;
}

export interface SheetSkill extends Named {
  ability: Ability;
  bonus: number;
  proficient: boolean;
  expertise: boolean;
}

export interface ArmorClassOption {
  armor: Named | null;
  shield: Named | null;
  ac: number;
}

export interface Speed {
  feet: number;
  /** null for the plain walking speed; "unarmored", "Hide armor", "swim", "fly" otherwise. */
  label: string | null;
}

export interface WeaponAttack extends Named {
  attackBonus: number;
  damageModifier: number;
  offHandDamageModifier: number | null;
  proficient: boolean;
  /** 2024: the damage dice with the modifier and the damage type, such as "2d6+3 Slashing". */
  damage?: string;
  /** 2024: the name of the mastery property when the character has the mastery of the weapon, such as "Graze". */
  mastery?: string;
}

/** A feature, action, or special attack, ready to print. */
export interface SheetFeature {
  name: string;
  /** Summary or description, with the old sheet's usage parenthetical, sentence-cased. */
  text: string;
  /**
   * For a limited-use feature: how many uses, and when they come back ("Short rest", "Long rest", "Dawn",
   * "Once per turn"), or null for a frequency with no unit. The amount is 1 or more: toSheet gives a feature with
   * 0 uses or fewer no `uses`, so it is a plain feature.
   */
  uses?: {
    amount: number;
    recharge: string | null;
    /**
     * The unit as built gives it, such as "orcpub.dnd.e5.units/long-rest", or null for none. With `name`, it is
     * the key of the spent count in the record (play.ts featureUsesSpent).
     */
    units: string | null;
    /** The feature name as built gives it: the other part of the key of the spent count. */
    name: string;
    /** The spent uses from the play state, from 0 to `amount`: a count above the amount reads as all spent. */
    spent: number;
    /** 2024: each rest that gives uses back and how many, when a rest gives back fewer than all or two rests apply. */
    recover?: { rest: string; amount: number | "all" }[];
  };
  /**
   * 2024: the category of the feat that gives the feature, such as "Origin feat". When the feature has another
   * name than the feat, the feat name comes first: "Grappler, General feat".
   */
  category?: string;
}

export interface SheetItem extends Named {
  quantity: number;
  equipped: boolean;
}

export interface Spellcaster {
  /** The class or race name, such as "Wizard" or "High Elf". */
  name: string;
  ability: Ability;
  saveDc: number;
  attackBonus: number;
  /** True for a class that prepares spells, such as a cleric or a wizard. */
  prepares: boolean;
  /** Spells it can prepare per day, or null when it does not prepare or the count is not known. */
  canPrepare: number | null;
}

/**
 * A known spell. name is the name that the app makes from the key: a
 * component shows the name from the spell record (see spell-records.ts), and
 * this name only for a spell with no record.
 */
export interface KnownSpell extends Named {
  /** The class or race name it is known through. */
  source: string;
  ability: Ability;
  /** Always prepared, such as a domain spell: it takes no place in the prepared count. */
  alwaysPrepared: boolean;
  /** Always prepared, or in the entity's prepared spells, for a class that prepares; never for a cantrip. */
  prepared: boolean;
  /**
   * How the spell can be cast, such as "at will" or "ritual only": built's qualifier. null without one, and for
   * a domain spell, whose qualifier "Domain" says only what alwaysPrepared says.
   */
  castNote: string | null;
}

/** Sets the spent slots of a group to `spent`: the other slots of a spell level (ORC-282), or the pact slots (ORC-283). */
export type SpendSlots = (group: SlotGroup, spent: number) => void;

/** A known spell by its source and key, for example the spell that the user opens the Spells panel at. */
export type SpellRef = Pick<KnownSpell, "key" | "source">;

/** Prepares a spell of a class that prepares, or stops preparing it (ORC-287). The source of the spell is the class. */
export type PrepareSpell = (spell: SpellRef, prepared: boolean) => void;

/** Opens the Spells panel at a spell, or at the top of its list without one (ORC-285). */
export type OpenSpells = (spell?: SpellRef) => void;

/**
 * The play controls of the sheet (docs/design/sheet-interactivity.md): the
 * handlers that change the play state, and the text of the status line. The
 * sheet page gives it; without it, as in the builder preview, the sheet
 * shows the play state and cannot change it. Later tickets add a handler
 * for each new control.
 */
export interface SheetPlay {
  /** The text of the last action for the status line of the vitals panel: "" when the sheet opens. */
  status: string;
  /** Changes with each action, so that the status line also reads out a text that is the same as the last one. */
  statusKey?: number;
  /** Applies an action of the Hit points popup or the Temporary hit points popup, as one sheet change (ORC-314). */
  onHitPoints: (action: HitPointAction) => void;
  /** Applies an action of the Hit dice popup: Spend (also Roll for me) or Regain, as one sheet change (ORC-317). */
  onHitDice: (action: HitDiceAction) => void;
  /** Writes the death save counts after a click or an arrow key on the Death saves box, as one sheet change (ORC-315). */
  onDeathSaves: (saves: DeathSaves) => void;
  /**
   * Writes the spent uses of a feature, by its unit and name, after a change of its use bubble, as one sheet
   * change (ORC-316). Two features with the same name and unit share the count.
   */
  onUses: (feature: FeatureUsesKey, spent: number) => void;
}

/** The key of the spent count of a feature in the record: its unit and its name, as built gives them. */
export type FeatureUsesKey = Pick<NonNullable<SheetFeature["uses"]>, "units" | "name">;

export interface Spellcasting extends SpentSlotGroups {
  casters: Spellcaster[];
  /** Level 0 is cantrips. Spells sorted by key within a level; a component sorts them by the name it shows. */
  byLevel: { level: number; spells: KnownSpell[] }[];
  /** Class name to how it gets known spells; "all" when it knows its whole spell list, as a cleric. */
  knownModes: Record<string, string>;
}

export interface Sheet {
  name: string | null;
  /** The portrait's image URL. */
  portrait: string | null;
  playerName: string | null;
  factionName: string | null;
  /** The faction's image URL. */
  factionImage: string | null;
  race: string | null;
  subrace: string | null;
  background: string | null;
  alignment: string | null;
  classes: SheetClass[];
  totalLevel: number;
  xp: number | null;

  /** In the order str, dex, con, int, wis, cha. */
  abilities: SheetAbility[];
  proficiencyBonus: number;
  initiative: number;
  passivePerception: number;
  /** All 18 skills, sorted by name. */
  skills: SheetSkill[];

  /** The worn armor and wielded shield's AC; with neither, or no match, the best combination. */
  armorClass: number;
  armorClassOptions: ArmorClassOption[];
  maxHitPoints: number;
  /**
   * The current hit points that show: the lower of the stored value and the
   * maximum (ORC-119). null is full hit points: the record has no value.
   */
  currentHitPoints: number | null;
  /** The temporary hit points, 0 when there are none (play state). */
  tempHitPoints: number;
  /** The death save counts (play state). */
  deathSaves: DeathSaves;
  /**
   * The hit dice by die size, the largest die first, with the dice left
   * (play state). Two classes with the same die size share one entry.
   */
  hitDice: HitDie[];
  speeds: Speed[];
  darkvision: number;

  numberOfAttacks: number;
  weaponAttacks: WeaponAttack[];
  specialAttacks: SheetFeature[];

  resistances: string[];
  immunities: string[];
  conditionImmunities: string[];
  vulnerabilities: string[];

  languages: string[];
  tools: (Named & { bonus: number })[];
  weaponProficiencies: string[];
  armorProficiencies: string[];

  /** null when the character knows no spells. */
  spellcasting: Spellcasting | null;

  /** Each list sorted by name, case-insensitive. */
  features: {
    actions: SheetFeature[];
    bonusActions: SheetFeature[];
    reactions: SheetFeature[];
    traits: SheetFeature[];
  };

  equipment: {
    weapons: SheetItem[];
    armor: SheetItem[];
    magicItems: SheetItem[];
    other: SheetItem[];
    treasure: SheetItem[];
  };

  /** Blank fields are null. */
  details: {
    personalityTraits: string[];
    ideals: string | null;
    bonds: string | null;
    flaws: string | null;
    description: string | null;
    age: string | null;
    sex: string | null;
    height: string | null;
    weight: string | null;
    hair: string | null;
    eyes: string | null;
    skin: string | null;
    notes: string | null;
  };
}

export const ABILITIES: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

/** The name of each ability. */
export const ABILITY_NAMES: Record<Ability, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

/** The ability of a stored or built ability key, bare or qualified ("~:wis", "orcpub.dnd.e5.character/wis"), or null for another value. */
export function abilityOfKey(key: unknown): Ability | null {
  if (typeof key !== "string") return null;
  const name = unqualify(untag(key));
  return (ABILITIES as string[]).includes(name) ? (name as Ability) : null;
}

/** The 18 skills, in name order. */
export const SKILLS: [key: string, name: string, ability: Ability][] = [
  ["acrobatics", "Acrobatics", "dex"],
  ["animal-handling", "Animal Handling", "wis"],
  ["arcana", "Arcana", "int"],
  ["athletics", "Athletics", "str"],
  ["deception", "Deception", "cha"],
  ["history", "History", "int"],
  ["insight", "Insight", "wis"],
  ["intimidation", "Intimidation", "cha"],
  ["investigation", "Investigation", "int"],
  ["medicine", "Medicine", "wis"],
  ["nature", "Nature", "int"],
  ["perception", "Perception", "wis"],
  ["performance", "Performance", "cha"],
  ["persuasion", "Persuasion", "cha"],
  ["religion", "Religion", "int"],
  ["sleight-of-hand", "Sleight of Hand", "dex"],
  ["stealth", "Stealth", "dex"],
  ["survival", "Survival", "wis"],
];

const EQUIPMENT_NS = "orcpub.dnd.e5.character.equipment/";

/** The name part of a keyword string: "orcpub.dnd.e5.units/long-rest" → "long-rest". */
export const unqualify = (key: string) => key.slice(key.lastIndexOf("/") + 1);

/** The old app's capitalised kw-to-name: "crossbow-light" → "Crossbow Light". */
export const keyToName = (key: string) =>
  unqualify(key)
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const named = (key: string): Named => ({ key, name: keyToName(key) });

/** The old app's sentensize: capitalise the first letter and end with a full stop. */
const sentence = (text: string) => {
  const trimmed = text.trim();
  if (trimmed === "") return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1) + (trimmed.endsWith(".") ? "" : ".");
};

export const byName = <T extends { name: string }>(items: T[]) => items.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

/** The name a feature or special attack shows when the engine gives it none. */
export const UNNAMED_FEATURE = "Unnamed feature";
// The engine's types say every feature has a name, but homebrew can leave a
// name out. Engine 0.3.1 also gave the Hunter's Evasion feature none (ORC-177).
const nameOf = (feature: { name?: string | null }) => feature.name || UNNAMED_FEATURE;

/** The old app's bonus-str, for ability, save, skill and other bonuses: "+3", "-1", and "0" for zero. */
export const bonusStr = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** The old app's mod-str, for initiative and attack and damage rolls: "+0" for zero. */
export const modStr = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** A number as an English ordinal for a level: 1st, 2nd, 3rd, 4th. */
export const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

const blankToNull = (value: unknown) => ((typeof value === "string" && value.trim() !== "") || typeof value === "number" ? String(value) : null);

/** The old display's unit-amount-description: "1 minute", "60 feet", "2 rounds". */
const unitAmount = (value: Amount) => {
  const { amount = 1, units, singular, plural } = value as Amount & { singular?: string; plural?: string };
  const unit = unqualify(units);
  if (amount === 1) return `${amount} ${singular ? unqualify(singular) : unit}`;
  return `${amount} ${plural ? unqualify(plural) : unit === "feet" ? unit : `${unit}s`}`;
};

/** The name of the unit `day` on the sheet and in the forms (sheet-interactivity.md, "Feature uses"). The stored unit stays `day`. */
export const DAWN = "Dawn";

/** Whether a unit, bare or qualified, is `turn`: a feature with uses each turn has no circles. */
const isTurn = (units: string | null | undefined) => typeof units === "string" && unqualify(untag(units)) === "turn";

/**
 * When a feature's uses come back. A DMV "rest" is a short or a long rest, so a short rest is enough. The unit
 * `day` is "Dawn", and a turn says how many: "Once per turn", "2 per turn". A frequency with no unit, which a pack
 * can have, gives null: the bubble has no tag.
 */
const recharge = (units: string | undefined, amount: number) => {
  if (typeof units !== "string" || units === "") return null;
  if (isTurn(units)) return amount === 1 ? "Once per turn" : `${amount} per turn`;
  const unit = unqualify(units).replace(/-/g, " ");
  if (unit === "rest" || unit === "short rest") return "Short rest";
  if (unit === "long rest") return "Long rest";
  if (unit === "day") return DAWN;
  return `Each ${unit}`;
};

/** A section of "Features & traits" on the sheet. */
export type FeatureSection = keyof Sheet["features"];

/**
 * How a feature's uses show: in a use bubble with circles, in a use bubble
 * with a pool, in a use bubble with no circles for uses each turn, or as
 * plain text with no bubble.
 */
export type UsesDisplay = { kind: "circles"; count: number } | { kind: "pool"; max: number } | { kind: "turn" } | { kind: "plain" };

/** The section of each homebrew feature type. A type the sheet does not know, "other", or none, is a trait. */
const SECTION_OF_TYPE: Record<string, FeatureSection> = {
  action: "actions",
  "b-action": "bonusActions",
  reaction: "reactions",
};

/**
 * How the uses of a feature show (homebrew-forms.md, "On the sheet"). toSheet
 * calls it to drop uses that show as plain text, and the sheet calls it to
 * draw circles or a pool. No frequency is plain text. A frequency with no
 * amount is 1 use. An amount of 0 or fewer is plain text. The unit `turn` has
 * no circles (sheet-interactivity.md, "Feature uses"). 8 uses or fewer are
 * circles; more than 8 are a pool, such as Lay on Hands' 25 hit points.
 */
export function usesDisplay(frequency: { amount?: number | null; units?: string | null } | null | undefined): UsesDisplay {
  if (!frequency) return { kind: "plain" };
  const amount = frequency.amount ?? 1;
  if (amount <= 0) return { kind: "plain" };
  if (isTurn(frequency.units)) return { kind: "turn" };
  if (amount > 8) return { kind: "pool", max: amount };
  return { kind: "circles", count: amount };
}

/**
 * The tag of a use bubble: when the uses come back. With 2024 recovery
 * rules, each rest, and the number of uses it gives back when it is not all:
 * "Short rest (1), Long rest".
 */
export function recoveryTag(uses: Pick<NonNullable<SheetFeature["uses"]>, "recharge" | "recover">): string | undefined {
  if (!uses.recover?.length) return uses.recharge ?? undefined;
  return uses.recover.map(({ rest, amount }) => (amount === "all" ? rest : `${rest} (${amount})`)).join(", ");
}

/**
 * The sheet section of a feature (homebrew-forms.md, "On the sheet"). `type`
 * is the feature's homebrew type: "action", "b-action", "reaction" or
 * "other", bare or as a qualified keyword. toSheet calls it for each trait,
 * and so does the uses preview of the homebrew forms (uses-preview.ts).
 */
export function sectionOf(type: string | null | undefined): FeatureSection {
  return SECTION_OF_TYPE[unqualify(type ?? "")] ?? "traits";
}

/** The numbers of a character that a scaled amount reads. */
export interface ScaleNumbers {
  /** The level that a level amount counts: the class level for a class or subclass feature, else the character level. */
  level: number;
  proficiencyBonus: number;
  abilityModifier: (ability: Ability) => number;
}

/** Clojure truth, which the engine uses for a base: any stored value but absent, null and false. */
const truthy = (value: unknown) => value !== undefined && value !== null && value !== false;
/** A stored number, or the default when the value is absent or is not a number. */
const numberOr = (value: unknown, fallback: number) => (typeof value === "number" ? value : fallback);

/**
 * The base that the engine reads from a scaled amount map: the stored
 * ability key, "prof", "level", or undefined for no base. scaledAmount has
 * the order and the rules. The uses control of the homebrew forms shows the
 * same base.
 */
export function scaledBase(amount: Record<string, unknown>): { ability: string } | "prof" | "level" | undefined {
  const ability = amount["~:ability"];
  if (typeof ability === "string") return { ability };
  if (truthy(amount["~:prof-bonus"])) return "prof";
  if (truthy(amount["~:level"])) return "level";
  return undefined;
}

/**
 * A scaled amount of a pack feature as a number, as engine 0.4.0 resolves it
 * when it evaluates a character (the fork's scaled-amount, patch D8;
 * homebrew-forms.md, "Stored shape"). `amount` is the stored map in verbose
 * Transit-JSON. The engine reads the bases in this order:
 *
 * - `:ability`, only when it is a keyword (a string here): the modifier of
 *   that ability, bare or qualified key. A key that is none of the six
 *   abilities gives 0.
 * - `:prof-bonus`, when it is truthy in Clojure (any value but absent, null
 *   and false): the proficiency bonus.
 * - `:level`, when it is truthy: the level times `:times` (1 when it is
 *   absent or not a number).
 * - No base gives 0.
 *
 * It adds `:plus` (0 when it is absent or not a number), then applies `:min`
 * only when it is a number. The uses preview of the homebrew forms calls it
 * for its example character; the sheet gets the engine's number. The app
 * computes the amount because one engine evaluation takes about 100 ms, too
 * slow for each change in the form. scaled-amount.test.ts compares it with
 * the golden character's numbers, and uses-parity.test.tsx with an engine
 * evaluation, so that drift in the engine is caught.
 */
export function scaledAmount(amount: Record<string, unknown>, numbers: ScaleNumbers): number {
  const from = scaledBase(amount);
  let base = 0;
  if (from === "prof") base = numbers.proficiencyBonus;
  else if (from === "level") base = numbers.level * numberOr(amount["~:times"], 1);
  else if (from !== undefined) {
    const known = abilityOfKey(from.ability);
    base = known === null ? 0 : numbers.abilityModifier(known);
  }
  const total = base + numberOr(amount["~:plus"], 0);
  const min = amount["~:min"];
  return typeof min === "number" ? Math.max(total, min) : total;
}

/**
 * The old display's action-description: text, then "(qualifier, range …, lasts …)".
 * A limited-use feature gets its uses in `uses`, not in the text, because the
 * sheet shows them in a use bubble. A feature whose uses show as plain text
 * (an amount of 0 or fewer) gets no `uses`. With the entity, the uses carry
 * the spent count of the play state; without it, as in the uses preview of the
 * homebrew forms, which calls it with the feature as the engine builds it
 * (uses-preview.ts), none is spent.
 */
export function toSheetFeature(feature: Feature, entity?: StrictEntity): SheetFeature {
  const { summary, description, frequency, duration } = feature;
  const name = nameOf(feature);
  const { range, qualifier } = feature as Feature & { range?: Amount; qualifier?: string | null };
  let text = summary ?? description ?? "";
  if (range || duration) {
    const concentration = (duration as { concentration?: boolean } | undefined)?.concentration ? "conc. " : "";
    const parts = [qualifier, range && `range ${unitAmount(range)}`, duration && `lasts ${concentration}${unitAmount(duration)}`];
    text += ` (${parts.filter(Boolean).join(", ")})`;
  }
  if (frequency && usesDisplay(frequency).kind !== "plain") {
    const amount = frequency.amount ?? 1;
    const units = typeof frequency.units === "string" && frequency.units !== "" ? frequency.units : null;
    // The record key is the name as built gives it; nameOf only fills a missing name.
    const key = typeof feature.name === "string" ? feature.name : name;
    const spent = entity ? featureUsesSpent(entity, units, key, amount) : 0;
    return { name, text: sentence(text), uses: { amount, recharge: recharge(frequency.units, amount), units, name: key, spent } };
  }
  return { name, text: sentence(text) };
}

const toFeatures = (features: Feature[], entity: StrictEntity) => byName(features.map((feature) => toSheetFeature(feature, entity)));

/** The uses of each feature of the sheet that has them, in the order of the sheet. */
export function featureUses(sheet: Pick<Sheet, "features">): NonNullable<SheetFeature["uses"]>[] {
  const { actions, bonusActions, reactions, traits } = sheet.features;
  return [...actions, ...bonusActions, ...reactions, ...traits].flatMap((feature) => (feature.uses ? [feature.uses] : []));
}

/**
 * The four feature lists, each sorted by name. The engine puts every homebrew
 * feature in `traits`, with its `type`; sectionOf moves it to the section of
 * that type. The engine's own actions, bonus actions and reactions keep their
 * list.
 */
function toFeatureSections(built: Built2014, entity: StrictEntity): Sheet["features"] {
  const traits = built.traits ?? [];
  const typed = (section: FeatureSection) => traits.filter((trait) => sectionOf(trait.type) === section);
  return {
    actions: toFeatures([...(built.actions ?? []), ...typed("actions")], entity),
    bonusActions: toFeatures([...(built["bonus-actions"] ?? []), ...typed("bonusActions")], entity),
    reactions: toFeatures([...(built.reactions ?? []), ...typed("reactions")], entity),
    traits: toFeatures(typed("traits"), entity),
  };
}

const toItems = (...inventories: Inventory[]): SheetItem[] =>
  byName(
    inventories.flatMap((inventory) =>
      Object.entries(inventory ?? {}).map(([key, item]) => ({
        ...named(key),
        quantity: item[`${EQUIPMENT_NS}quantity`],
        equipped: item[`${EQUIPMENT_NS}equipped?`] === true,
      })),
    ),
  );

/** An entry of a resistance-like accessor of the built character, such as resistances: the value, and a qualifier or null. */
export interface Resistance {
  value: string;
  qualifier?: string | null;
}

/** Resistance-like accessors hold { value, qualifier } entries: "fire", "magical-sleep (qualifier)". */
const toResistances = (...lists: unknown[]) =>
  lists.flatMap((list) => ((list as Resistance[] | null) ?? []).map(({ value, qualifier }) => keyToName(value) + (qualifier ? ` (${qualifier})` : "")));

function toSpeeds(built: Built2014): Speed[] {
  const withArmor = built["speed-with-armor"];
  const bonus = built["unarmored-speed-bonus"];
  const base = built["base-land-speed"];
  const unarmored = withArmor?.find((entry) => entry.armor === null)?.speed ?? base;
  const speeds: Speed[] = [{ feet: unarmored + (bonus ?? 0), label: withArmor !== null || bonus !== null ? "unarmored" : null }];
  if (withArmor !== null) {
    for (const { armor, speed } of withArmor) {
      if (armor !== null) speeds.push({ feet: speed, label: `${keyToName(armor)} armor` });
    }
  } else if (bonus !== null) {
    speeds.push({ feet: base, label: "armored" });
  }
  if (built["base-swimming-speed"] > 0) speeds.push({ feet: built["base-swimming-speed"], label: "swim" });
  if (built["base-flying-speed"] > 0) speeds.push({ feet: built["base-flying-speed"], label: "fly" });
  return speeds;
}

/** The old display's attack-description: "Melee, +5 to hit, 1d12+3 slashing damage, DC13 dex save." */
function toSpecialAttack(attack: NonNullable<Built2014["attacks"]>[number]): SheetFeature {
  const a = attack as typeof attack & {
    "area-type"?: string;
    length?: number;
    "line-width"?: number;
    "line-length"?: number;
    "attack-modifier"?: number;
    description?: string;
  };
  const type = unqualify(a["attack-type"] ?? "melee");
  const area = unqualify(a["area-type"] ?? "");
  const shape =
    type === "area"
      ? area === "line"
        ? `${a["line-width"]} x ${a["line-length"]} ft. line`
        : area === "cone"
          ? `${a.length} ft. cone`
          : null
      : type === "ranged"
        ? "ranged"
        : "melee";
  const toHit = type !== "area" && a["attack-modifier"] != null ? `${bonusStr(a["attack-modifier"])} to hit` : null;
  const die = a["damage-die"];
  const damage =
    die != null
      ? [
          `${a["damage-die-count"] ?? 1}d${die}${a["damage-modifier"] != null ? modStr(a["damage-modifier"]) : ""}`,
          a["damage-type"] && unqualify(a["damage-type"]),
          "damage",
        ]
          .filter(Boolean)
          .join(" ")
      : null;
  const save = a.save ? `DC${a["save-dc"]} ${unqualify(a.save)} save` : null;
  const text = [a.summary ?? a.description, shape, toHit, damage, save].filter(Boolean).join(", ");
  return { name: nameOf(a), text: sentence(text) };
}

function toSpellcasting(built: Built2014, entity: StrictEntity): Spellcasting | null {
  const known = Object.entries(built["spells-known"] ?? {});
  if (known.length === 0) return null;
  const prepares = built["prepares-spells"] ?? {};
  const prepared = preparedSpells(entity);
  const { slots, pact } = spentSlotGroups(entity, slotLayout(built));
  return {
    slots,
    pact,
    casters: Object.values(built["spell-modifiers"] ?? {}).map((caster) => ({
      name: caster.class,
      ability: unqualify(caster.ability) as Ability,
      saveDc: caster["spell-save-dc"],
      attackBonus: caster["spell-attack-modifier"],
      prepares: prepares[caster.class] === true,
      canPrepare: prepares[caster.class] ? (built["prepare-spell-count"]?.[caster.class] ?? null) : null,
    })),
    byLevel: known
      .map(([level, spells]) => ({
        level: Number(level),
        spells: (spells?.__entries ?? [])
          .map(([[source, key], spell]) => {
            const caster = spell.class ?? source;
            // built marks a domain or oath spell always-prepared?, and the
            // old sheet shows it prepared.
            const preparer = Number(level) > 0 && prepares[caster] === true;
            const always = preparer && (spell as { "always-prepared?"?: boolean })["always-prepared?"] === true;
            return {
              ...named(key),
              source: caster,
              ability: unqualify(spell.ability) as Ability,
              alwaysPrepared: always,
              prepared: always || (preparer && (prepared[caster]?.has(key) ?? false)),
              castNote: castNoteOf(spell.qualifier),
            };
          })
          .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
      }))
      .sort((a, b) => a.level - b.level),
    knownModes: built["spells-known-modes"] ?? {},
  };
}

/** The qualifier of a cleric's domain spell (options.cljc cleric-spell). */
const DOMAIN_QUALIFIER = "Domain";

/** A known spell's qualifier as its cast note: null for none, for blank text and for the domain qualifier. */
const castNoteOf = (qualifier: string | null | undefined) => {
  const note = qualifier?.trim();
  return note && note !== DOMAIN_QUALIFIER ? note : null;
};

/**
 * The built character as a Sheet. The entity it was built from gives what
 * built lacks: the prepared spells, the spent slots and the play state.
 */
export function toSheet(built: Built2014, entity: StrictEntity): Sheet {
  const abilityKey = (ability: Ability) => `orcpub.dnd.e5.character/${ability}` as const;
  const skillProfs = built["skill-profs"] ?? {};
  const expertise = built["skill-expertise"] ?? [];
  const acOptions = built["armor-class-with-armor"] ?? [];
  const wornArmor = (built["worn-armor"] as string | null | undefined) ?? null;
  const wieldedShield = (built["wielded-shield"] as string | null | undefined) ?? null;
  const bestAc = Math.max(built["armor-class"], ...acOptions.map((option) => option.ac));
  // As the old app: with nothing worn or wielded, the best combination; otherwise the worn one.
  // "none", which the builder's <none> stores, is no armor or no shield.
  const noneToNull = (key: string | null) => (key === "none" ? null : key);
  const worn =
    wornArmor === null && wieldedShield === null
      ? undefined
      : acOptions.find((option) => option.armor === noneToNull(wornArmor) && option.shield === noneToNull(wieldedShield));
  const text = (key: string) => blankToNull(built[key]);
  const classes = built.classes.map((key) => {
    const levels = built.levels[key];
    return {
      key,
      name: levels?.["class-name"] ?? keyToName(key),
      level: levels?.["class-level"] ?? 0,
      hitDie: levels?.["hit-die"] ?? 0,
      subclass: levels?.["subclass-name"] ?? (levels?.subclass ? keyToName(levels.subclass) : null),
    };
  });
  const hitDice = hitDiceTotals(classes);

  return {
    name: blankToNull(built["character-name"]),
    portrait: text("image-url"),
    playerName: text("player-name"),
    factionName: text("faction-name"),
    factionImage: text("faction-image-url"),
    race: built.race,
    subrace: built.subrace,
    background: built.background,
    alignment: text("alignment"),
    classes,
    totalLevel: built["total-levels"],
    xp: (built.xps as number | null | undefined) ?? null,

    abilities: ABILITIES.map((ability) => ({
      ability,
      score: built.abilities[abilityKey(ability)],
      modifier: built["ability-bonuses"][abilityKey(ability)],
      save: built["save-bonuses"][abilityKey(ability)],
      saveProficient: built["saving-throws"].includes(abilityKey(ability)),
    })),
    proficiencyBonus: built["proficiency-bonus"],
    initiative: built.initiative,
    passivePerception: built["passive-perception"],
    skills: SKILLS.map(([key, name, ability]) => ({
      key,
      name,
      ability,
      bonus: built["skill-bonuses"][key] ?? 0,
      proficient: key in skillProfs,
      expertise: expertise.includes(key),
    })),

    armorClass: worn?.ac ?? bestAc,
    armorClassOptions: acOptions.map(({ armor, shield, ac }) => ({
      armor: armor === null ? null : named(armor),
      shield: shield === null ? null : named(shield),
      ac,
    })),
    maxHitPoints: built["max-hit-points"],
    currentHitPoints: currentHitPoints(entity, built["max-hit-points"]),
    tempHitPoints: tempHitPoints(entity),
    deathSaves: deathSaves(entity),
    hitDice: hitDiceLeft(hitDice, hitDiceSpent(entity, hitDice)),
    speeds: toSpeeds(built),
    darkvision: built.darkvision ?? 0,

    numberOfAttacks: built["number-of-attacks"],
    weaponAttacks: byName(
      Object.entries(built["weapon-modifiers"] ?? {}).flatMap(([key, modifiers]) =>
        modifiers === null
          ? []
          : [
              {
                ...named(key),
                attackBonus: modifiers["best-attack"],
                damageModifier: modifiers["best-damage"],
                offHandDamageModifier: modifiers["dual-wield?"] ? modifiers["best-damage-off-hand"] : null,
                proficient: modifiers["has-prof?"],
              },
            ],
      ),
    ),
    specialAttacks: byName((built.attacks ?? []).map(toSpecialAttack)),

    resistances: toResistances(built.resistances),
    immunities: toResistances(built["damage-immunities"], built.immunities),
    conditionImmunities: toResistances(built["condition-immunities"]),
    vulnerabilities: toResistances(built["damage-vulnerabilities"]),

    languages: (built.languages ?? []).map(keyToName),
    tools: byName(Object.keys(built["tool-profs"] ?? {}).map((key) => ({ ...named(key), bonus: built["tool-bonus"]?.[key] ?? 0 }))),
    weaponProficiencies: (built["weapon-profs"] ?? []).map(keyToName),
    armorProficiencies: (built["armor-profs"] ?? []).map(keyToName),

    spellcasting: toSpellcasting(built, entity),

    features: toFeatureSections(built, entity),

    equipment: {
      weapons: toItems(built.weapons),
      armor: toItems(built.armor),
      magicItems: toItems(built["magic-weapons"], built["magic-armor"], built["magic-items"]),
      other: toItems(built.equipment),
      treasure: toItems(built.treasure),
    },

    details: {
      personalityTraits: [text("personality-trait-1"), text("personality-trait-2")].filter((trait) => trait !== null),
      ideals: text("ideals"),
      bonds: text("bonds"),
      flaws: text("flaws"),
      description: text("description"),
      age: text("age"),
      sex: text("sex"),
      height: text("height"),
      weight: text("weight"),
      hair: text("hair"),
      eyes: text("eyes"),
      skin: text("skin"),
      notes: text("notes"),
    },
  };
}
