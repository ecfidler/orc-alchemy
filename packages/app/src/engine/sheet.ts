// The app-owned character sheet (ORC-48, rules option E). Components render
// a Sheet and never read the engine's built character; toSheet is the one
// adapter from the 2014 engine. A later engine needs a second adapter, not a
// second sheet. Numbers stay numbers and components format them; only the
// ready-to-print feature and attack text is formatted here.
import type { Amount, Built2014, Feature, Inventory } from "@pubdoor/dmv";

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
}

/** A feature, action, or special attack, ready to print. */
export interface SheetFeature {
  name: string;
  /** Summary or description, with the old sheet's usage parenthetical, sentence-cased. */
  text: string;
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
  /** Spells it can prepare per day, or null when it does not prepare. */
  canPrepare: number | null;
}

export interface KnownSpell extends Named {
  /** The class or race name it is known through. */
  source: string;
  ability: Ability;
}

export interface Spellcasting {
  slots: { level: number; count: number }[];
  casters: Spellcaster[];
  /** Level 0 is cantrips. Spells sorted by key within a level. */
  byLevel: { level: number; spells: KnownSpell[] }[];
}

export interface Sheet {
  name: string | null;
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
  currentHitPoints: number | null;
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

const ABILITIES: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

/** The 18 skills, in name order. */
const SKILLS: [key: string, name: string, ability: Ability][] = [
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
const unqualify = (key: string) => key.slice(key.lastIndexOf("/") + 1);

/** The old app's capitalised kw-to-name: "crossbow-light" → "Crossbow Light". */
const keyToName = (key: string) =>
  unqualify(key)
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const named = (key: string): Named => ({ key, name: keyToName(key) });

const abilityOf = (key: string) => unqualify(key) as Ability;

/** The old app's sentensize: capitalise the first letter and end with a full stop. */
const sentence = (text: string) => {
  const trimmed = text.trim();
  if (trimmed === "") return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1) + (trimmed.endsWith(".") ? "" : ".");
};

const byName = <T extends { name: string }>(items: T[]) =>
  items.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

/** The old app's bonus-str ("0" for zero) and mod-str ("+0"), for the ready-to-print attack text. */
const bonusStr = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const modStr = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

const blankToNull = (value: unknown) =>
  (typeof value === "string" && value.trim() !== "") || typeof value === "number" ? String(value) : null;

/** The old display's unit-amount-description: "1 minute", "60 feet", "2 rounds". */
const unitAmount = ({ amount = 1, units }: Amount) => {
  const unit = unqualify(units).replace(/-/g, " ");
  return `${amount} ${amount === 1 || unit === "feet" ? unit : `${unit}s`}`;
};

const timesWord = (amount: number) => (amount === 1 ? "once" : amount === 2 ? "twice" : `${amount} times`);

/** The old display's action-description: text, then "(qualifier, range …, lasts …, use twice/long rest)". */
function toFeature(feature: Feature): SheetFeature {
  const { name, summary, description, frequency, duration } = feature;
  const { range, qualifier } = feature as Feature & { range?: Amount; qualifier?: string | null };
  let text = summary ?? description ?? "";
  if (range || duration || frequency) {
    const concentration = (duration as { concentration?: boolean } | undefined)?.concentration ? "conc. " : "";
    const parts = [
      qualifier,
      range && `range ${unitAmount(range)}`,
      duration && `lasts ${concentration}${unitAmount(duration)}`,
      frequency && `use ${timesWord(frequency.amount ?? 1)}/${unqualify(frequency.units).replace(/-/g, " ")}`,
    ];
    text += ` (${parts.filter(Boolean).join(", ")})`;
  }
  return { name, text: sentence(text) };
}

const toFeatures = (features: Feature[] | null | undefined) => byName((features ?? []).map(toFeature));

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

/** Resistance-like accessors hold { value, qualifier } entries: "fire", "magical-sleep (qualifier)". */
const toResistances = (...lists: unknown[]) =>
  lists.flatMap((list) =>
    ((list as { value: string; qualifier?: string | null }[] | null) ?? []).map(
      ({ value, qualifier }) => keyToName(value) + (qualifier ? ` (${qualifier})` : ""),
    ),
  );

function toSpeeds(built: Built2014): Speed[] {
  const withArmor = built["speed-with-armor"];
  const bonus = built["unarmored-speed-bonus"];
  const base = built["base-land-speed"];
  const unarmored = withArmor?.find((entry) => entry.armor === null)?.speed ?? base;
  const speeds: Speed[] = [
    { feet: unarmored + (bonus ?? 0), label: withArmor !== null || bonus !== null ? "unarmored" : null },
  ];
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
          : ""
      : type === "ranged"
        ? "ranged"
        : "melee";
  const toHit = type !== "area" && a["attack-modifier"] != null ? `${bonusStr(a["attack-modifier"])} to hit, ` : "";
  const modifier = a["damage-modifier"] != null ? modStr(a["damage-modifier"]) : "";
  const damageType = a["damage-type"] ? unqualify(a["damage-type"]) : "";
  const save = a.save ? `, DC${a["save-dc"]} ${unqualify(a.save)} save` : "";
  const summary = a.summary ?? a.description;
  const text =
    `${summary ? `${summary}, ` : ""}${shape}, ${toHit}` +
    `${a["damage-die-count"]}d${a["damage-die"]}${modifier} ${damageType} damage${save}`;
  return { name: a.name, text: sentence(text) };
}

function toSpellcasting(built: Built2014): Spellcasting | null {
  const known = Object.entries(built["spells-known"] ?? {});
  if (known.length === 0) return null;
  const prepares = built["prepares-spells"] ?? {};
  return {
    slots: Object.entries(built["spell-slots"] ?? {})
      .map(([level, count]) => ({ level: Number(level), count }))
      .sort((a, b) => a.level - b.level),
    casters: Object.values(built["spell-modifiers"] ?? {}).map((caster) => ({
      name: caster.class,
      ability: abilityOf(caster.ability),
      saveDc: caster["spell-save-dc"],
      attackBonus: caster["spell-attack-modifier"],
      canPrepare: prepares[caster.class] ? (built["prepare-spell-count"]?.[caster.class] ?? null) : null,
    })),
    byLevel: known
      .map(([level, spells]) => ({
        level: Number(level),
        spells: (spells?.__entries ?? [])
          .map(([[source, key], spell]) => ({
            ...named(key),
            source: spell.class ?? source,
            ability: abilityOf(spell.ability),
          }))
          .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
      }))
      .sort((a, b) => a.level - b.level),
  };
}

export function toSheet(built: Built2014): Sheet {
  const abilityKey = (ability: Ability) => `orcpub.dnd.e5.character/${ability}` as const;
  const skillProfs = built["skill-profs"] ?? {};
  const expertise = built["skill-expertise"] ?? [];
  const acOptions = built["armor-class-with-armor"] ?? [];
  const wornArmor = (built["worn-armor"] as string | null | undefined) ?? null;
  const wieldedShield = (built["wielded-shield"] as string | null | undefined) ?? null;
  const bestAc = Math.max(built["armor-class"], ...acOptions.map((option) => option.ac));
  // As the old app: with nothing worn or wielded, the best combination; otherwise the worn one.
  const worn =
    wornArmor === null && wieldedShield === null
      ? undefined
      : acOptions.find((option) => option.armor === wornArmor && option.shield === wieldedShield);
  const text = (key: string) => blankToNull(built[key]);

  return {
    name: blankToNull(built["character-name"]),
    race: built.race,
    subrace: built.subrace,
    background: built.background,
    alignment: text("alignment"),
    classes: built.classes.map((key) => {
      const levels = built.levels[key];
      return {
        key,
        name: levels?.["class-name"] ?? keyToName(key),
        level: levels?.["class-level"] ?? 0,
        hitDie: levels?.["hit-die"] ?? 0,
        subclass: levels?.["subclass-name"] ?? (levels?.subclass ? keyToName(levels.subclass) : null),
      };
    }),
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
    currentHitPoints: built["current-hit-points"],
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
    tools: byName(
      Object.keys(built["tool-profs"] ?? {}).map((key) => ({ ...named(key), bonus: built["tool-bonus"]?.[key] ?? 0 })),
    ),
    weaponProficiencies: (built["weapon-profs"] ?? []).map(keyToName),
    armorProficiencies: (built["armor-profs"] ?? []).map(keyToName),

    spellcasting: toSpellcasting(built),

    features: {
      actions: toFeatures(built.actions),
      bonusActions: toFeatures(built["bonus-actions"]),
      reactions: toFeatures(built.reactions),
      traits: toFeatures(built.traits),
    },

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
