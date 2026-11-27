// The app-owned character sheet (ORC-48, rules option E). Components render
// a Sheet and never read the engine's built character; toSheet is the one
// adapter from the 2014 engine. A later engine needs a second adapter, not a
// second sheet. Numbers stay numbers and components format them; only the
// ready-to-print feature and attack text is formatted here.
import type { Built2014, Inventory, StrictEntity } from "@pubdoor/dmv";
import { acShown } from "./ac-pick.ts";
import { type ConcentrationNote, type ConditionAction, conditionsOf, shownMaxHitPoints, shownSpeeds } from "./conditions.ts";
import { type HitDiceAction, type HitDie, hitDiceLeft, hitDiceTotals } from "./hit-dice.ts";
import type { HitPointAction } from "./hit-points.ts";
import {
  type AcPick,
  acPick,
  type Condition,
  concentration,
  conditions,
  currentHitPoints,
  type DeathSaves,
  deathSaves,
  exhaustion,
  type FeatureUsesKey,
  hitDiceSpent,
  inspiration,
  tempHitPoints,
} from "./play.ts";
import { toFeatureSections, toSpecialAttack } from "./sheet-features.ts";
import { toSpellcasting } from "./sheet-spellcasting.ts";
import { ABILITIES, blankToNull, byName, keyToName, named, SKILLS } from "./sheet-text.ts";
import type { SlotGroup, SpentSlotGroups } from "./spells.ts";

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
  /** The worn pair: the row has the tag "worn" (ORC-325). */
  worn: boolean;
  /** The row whose AC the Armor Class box shows: it has the dot and bold text (ORC-325). */
  shown: boolean;
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
 * handlers that change the play state, and the text of the status toast. The
 * sheet page gives it; without it, as in the builder preview, the sheet
 * shows the play state and cannot change it. Later tickets add a handler
 * for each new control.
 */
export interface SheetPlay {
  /** The text of the last action for the status toast of the sheet (ORC-326): "" when the sheet opens. */
  status: string;
  /** Changes with each action, so that the toast also shows and reads out a text that is the same as the last one. */
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
  /** Applies an action of the Conditions and statuses box: add or remove a condition, or end the concentration mark (ORC-322). */
  onConditions: (action: ConditionAction) => void;
  /** Sets inspiration (true) or removes it (false) after a click on the Inspiration box, as one sheet change (ORC-324). */
  onInspiration: (on: boolean) => void;
  /** Writes the AC pick after a pick in the menu of the Armor Class box, as one sheet change; null is "Worn armor" (ORC-325). */
  onAcPick: (pick: AcPick | null) => void;
  /**
   * The concentration note after Damage with a concentration mark, or null (ORC-322). It shows in the status toast.
   * The next action removes it, and so does its Dismiss button, which calls `onDismissNote`.
   */
  concentrationNote?: ConcentrationNote | null;
  /** Takes the concentration note away after a click on its Dismiss button (ORC-326). */
  onDismissNote: () => void;
}

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

  /** The AC that the Armor Class box shows: the AC of the AC pick, or else `wornArmorClass` (ORC-325). */
  armorClass: number;
  /** The worn armor and wielded shield's AC; with neither, or no match, the best combination. */
  wornArmorClass: number;
  /** The AC pick when it names a row of `armorClassOptions`; null without one, or for a pair that is not in the table (play state). */
  acPick: AcPick | null;
  armorClassOptions: ArmorClassOption[];
  /** The hit point maximum that shows: the engine value, halved from exhaustion level 4 (ORC-323). */
  maxHitPoints: number;
  /** The hit point maximum of the engine, before exhaustion. The hit point rules write null (full) only at it. */
  baseMaxHitPoints: number;
  /**
   * The current hit points that show: the lower of the stored value and the
   * maximum that shows (ORC-119). null is full hit points: the record has no
   * value.
   */
  currentHitPoints: number | null;
  /** The temporary hit points, 0 when there are none (play state). */
  tempHitPoints: number;
  /** The death save counts (play state). */
  deathSaves: DeathSaves;
  /** The exhaustion level, from 0 to 6 (play state). Its effects are in the speeds, the maximum and the death saves (ORC-323). */
  exhaustion: number;
  /** The spell key of the concentration mark, or null (play state). */
  concentration: string | null;
  /** True when the character has inspiration (play state). No rest changes it (ORC-324). */
  inspiration: boolean;
  /** The conditions that are set, in the order of the Add condition menu (play state). */
  conditions: Condition[];
  /** The conditions that the character is immune to with no qualifier, such as "poisoned". */
  conditionImmune: Condition[];
  /**
   * The hit dice by die size, the largest die first, with the dice left
   * (play state). Two classes with the same die size share one entry.
   */
  hitDice: HitDie[];
  /** The speeds that show: a condition can set each to 0 (ORC-322), and exhaustion can halve them (ORC-323). */
  speeds: Speed[];
  /** The cause of a change of the speeds, for the caption under the speed, such as "Restrained"; null for none. */
  speedCause: string | null;
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

const EQUIPMENT_NS = "orcpub.dnd.e5.character.equipment/";

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
  // As the old app: with nothing worn or wielded, the best combination; otherwise the worn one. The AC pick can show
  // another row (ORC-325). "none", which the builder's <none> stores, is no armor or no shield.
  const noneToNull = (key: string | null) => (key === "none" ? null : key);
  const ac = acShown(
    acOptions,
    wornArmor === null && wieldedShield === null ? null : { armor: noneToNull(wornArmor), shield: noneToNull(wieldedShield) },
    built["armor-class"],
    acPick(entity),
  );
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
  const level = exhaustion(entity);
  const maxHitPoints = shownMaxHitPoints(built["max-hit-points"], level);
  const play = {
    conditions: [...conditions(entity)],
    currentHitPoints: currentHitPoints(entity, maxHitPoints),
    deathSaves: deathSaves(entity),
    exhaustion: level,
  };
  const speeds = shownSpeeds(toSpeeds(built), play);
  const immunities = (built["condition-immunities"] as Resistance[] | null | undefined) ?? [];

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

    armorClass: ac.ac,
    wornArmorClass: ac.wornAc,
    acPick: ac.pick,
    armorClassOptions: acOptions.map(({ armor, shield, ac: value }, i) => ({
      armor: armor === null ? null : named(armor),
      shield: shield === null ? null : named(shield),
      ac: value,
      worn: i === ac.wornRow,
      shown: i === ac.shownRow,
    })),
    maxHitPoints,
    baseMaxHitPoints: built["max-hit-points"],
    currentHitPoints: play.currentHitPoints,
    tempHitPoints: tempHitPoints(entity),
    deathSaves: play.deathSaves,
    exhaustion: level,
    concentration: concentration(entity),
    inspiration: inspiration(entity),
    conditions: play.conditions,
    conditionImmune: conditionsOf(immunities.filter((immunity) => !immunity.qualifier).map((immunity) => immunity.value)),
    hitDice: hitDiceLeft(hitDice, hitDiceSpent(entity, hitDice)),
    speeds: speeds.speeds,
    speedCause: speeds.cause,
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
