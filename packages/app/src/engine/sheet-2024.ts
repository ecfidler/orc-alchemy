// The second adapter to the app's Sheet (ORC-238, docs/design/2024-engine.md,
// "The seam to the app"): a character of the 2024 engine. toSheet in
// sheet.ts adapts the 2014 engine. Only the 2024 path loads this module, so
// the 2014 path loads no 2024 code. The names come from the records of the
// content; the 2024 spells, slots and lists arrive with ORC-229.

import { BUILT_IN, type Built2024, type Content, findRecord, isProficient, type RecordType, referenceTo, SRD_PACK } from "@orc-alchemy/engine";
import { hitDiceLeft, hitDiceTotals } from "./hit-dice.ts";
import { ABILITIES, byName, keyToName, type Named, type Sheet, type SheetFeature, type SheetItem, SKILLS } from "./sheet.ts";

type Feature2024 = Built2024["features"][number];

/** The name of a reference from its record, or the key part as words when the content has no such record. */
function nameOf(content: Content, type: RecordType, reference: string): string {
  const record = findRecord(content, type, reference) as { name?: string } | undefined;
  return record?.name ?? keyToName(reference.slice(reference.indexOf(":") + 1));
}

/** The Shield record: Built2024 says only whether the character uses a shield. */
const SHIELD = referenceTo(SRD_PACK, "shield");

const REST_NAMES: Record<string, string> = { "short-rest": "Short rest", "long-rest": "Long rest" };

const FEAT_CATEGORY_NAMES: Record<string, string> = {
  origin: "Origin feat",
  general: "General feat",
  "fighting-style": "Fighting Style feat",
  "epic-boon": "Epic Boon feat",
};

/** A feature on the sheet. One rule that gives back all uses is the plain `recharge`; else `recover` lists the rules. */
function toFeature(feature: Feature2024, category: string | undefined): SheetFeature {
  const { uses } = feature;
  const sheetFeature: SheetFeature = { name: feature.name, text: feature.summary, ...(category ? { category } : {}) };
  if (!uses || uses.amount < 1) return sheetFeature;
  const recover = uses.recover.map(({ on, amount }) => ({ rest: REST_NAMES[on] ?? keyToName(on), amount }));
  const plain = recover.length === 1 && recover[0].amount === "all";
  return {
    ...sheetFeature,
    // The 2024 sheet has no play state (sheet-interactivity.md, "Scope"): nothing is spent.
    uses: {
      amount: uses.amount,
      recharge: recover.length === 1 ? recover[0].rest : null,
      units: null,
      name: feature.name,
      spent: 0,
      ...(plain || recover.length === 0 ? {} : { recover }),
    },
  };
}

/** The modifier at the end of a damage roll: "2d6+3" → 3, "1d8-1" → -1, "1d4" → 0. */
const damageModifierOf = (damage: string) => Number(/[+-]\d+$/.exec(damage)?.[0] ?? 0);

const item = (content: Content, reference: string, quantity: number, equipped: boolean): SheetItem => ({
  key: reference,
  name: nameOf(content, "equipment", reference),
  quantity,
  equipped,
});

/** The Sheet of a built 2024 character. `content` names the records: the built-in pack unless the character has homebrew. */
export function toSheet2024(built: Built2024, content: Content = BUILT_IN): Sheet {
  const name = (type: RecordType) => (reference: string) => nameOf(content, type, reference);
  const named =
    (type: RecordType) =>
    (reference: string): Named => ({ key: reference, name: nameOf(content, type, reference) });
  const feats = new Map(built.feats.map((feat) => [feat.key, feat]));
  // A feat with several traits gives several features: each names the feat too.
  const featLabel = (feature: Feature2024) => {
    const feat = feats.get(feature.source);
    if (!feat) return undefined;
    const category = FEAT_CATEGORY_NAMES[feat.category] ?? keyToName(feat.category);
    return feature.name === feat.name ? category : `${feat.name}, ${category}`;
  };
  const weaponOf = (reference: string) => built.weapons.find((weapon) => weapon.key === reference);
  const classes = built.classes.map((key) => {
    const subclass = built.subclasses[key];
    return {
      key,
      name: name("classes")(key),
      level: built.classLevels[key] ?? 0,
      hitDie: built.hitDice[key] ?? 0,
      subclass: subclass ? name("subclasses")(subclass) : null,
    };
  });

  return {
    name: built.name || null,
    portrait: null,
    playerName: null,
    factionName: null,
    factionImage: null,
    race: built.species === null ? null : name("species")(built.species),
    subrace: built.lineage === null ? null : keyToName(built.lineage),
    background: built.background === null ? null : name("backgrounds")(built.background),
    alignment: null,
    classes,
    totalLevel: built.totalLevel,
    xp: null,

    abilities: ABILITIES.map((ability) => ({
      ability,
      score: built.abilities[ability],
      modifier: built.abilityModifiers[ability],
      save: built.saveBonuses[ability],
      saveProficient: built.savingThrowProficiencies.includes(ability),
    })),
    proficiencyBonus: built.proficiencyBonus,
    initiative: built.initiative,
    passivePerception: built.passivePerception,
    skills: SKILLS.map(([key, skillName, ability]) => ({
      key,
      name: skillName,
      ability,
      bonus: built.skillBonuses[key as keyof Built2024["skillBonuses"]] ?? 0,
      proficient: built.skillProficiencies.includes(key as Built2024["skillProficiencies"][number]),
      expertise: built.expertise.includes(key as Built2024["expertise"][number]),
    })),

    armorClass: built.armorClass,
    armorClassOptions: [
      {
        armor: built.wornArmor === null ? null : named("equipment")(built.wornArmor),
        shield: built.shield ? named("equipment")(SHIELD) : null,
        ac: built.armorClass,
      },
    ],
    maxHitPoints: built.maxHitPoints,
    currentHitPoints: null,
    // A 2024 character has no play state (sheet-interactivity.md, "Scope").
    tempHitPoints: 0,
    deathSaves: { successes: 0, failures: 0 },
    exhaustion: 0,
    concentration: null,
    conditions: [],
    conditionImmune: [],
    hitDice: hitDiceLeft(hitDiceTotals(classes), new Map()),
    speeds: [{ feet: built.speed, label: null }],
    speedCause: null,
    darkvision: built.darkvision,

    numberOfAttacks: built.attacksPerAction,
    weaponAttacks: byName(
      built.weaponAttacks.map((attack) => {
        const weapon = weaponOf(attack.weapon);
        return {
          key: attack.weapon,
          name: attack.name,
          attackBonus: attack.attackBonus,
          damageModifier: damageModifierOf(attack.damage),
          offHandDamageModifier: null,
          // The Unarmed Strike has no weapon record, and every character has proficiency with it (SRD 5.2.1 p190).
          proficient: weapon ? isProficient(weapon, built.weaponProficiencies) : true,
          damage: `${attack.damage} ${name("damageTypes")(attack.damageType)}`,
          ...(attack.mastery ? { mastery: name("weaponMasteries")(referenceTo(SRD_PACK, attack.mastery)) } : {}),
        };
      }),
    ),
    specialAttacks: byName(
      built.savingThrowAttacks.map((attack) => ({
        name: attack.name,
        text: `DC ${attack.dc} ${name("abilities")(referenceTo(SRD_PACK, attack.save))} saving throw, ${attack.damage} ${name("damageTypes")(attack.damageType)} damage.`,
      })),
    ),

    resistances: built.resistances.map(name("damageTypes")),
    immunities: [],
    conditionImmunities: [],
    vulnerabilities: [],

    languages: built.languages.map(name("languages")),
    tools: byName(built.toolProficiencies.map((tool) => ({ ...named("equipment")(tool), bonus: built.proficiencyBonus }))),
    weaponProficiencies: built.weaponProficiencies.map(keyToName),
    armorProficiencies: built.armorTraining.map(keyToName),

    // The 2024 spellcasting arrives with ORC-229.
    spellcasting: null,

    features: {
      actions: [],
      bonusActions: [],
      reactions: [],
      traits: byName(built.features.map((feature) => toFeature(feature, featLabel(feature)))),
    },

    equipment: {
      weapons: byName(built.weapons.map((weapon) => item(content, weapon.key, 1, true))),
      armor: byName([
        ...(built.wornArmor === null ? [] : [item(content, built.wornArmor, 1, true)]),
        ...(built.shield ? [item(content, SHIELD, 1, true)] : []),
      ]),
      magicItems: [],
      other: byName(built.inventory.map((carried) => item(content, carried.item, carried.quantity, false))),
      treasure: built.gold > 0 ? [{ key: "gp", name: "Gp", quantity: built.gold, equipped: false }] : [],
    },

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
      notes: null,
    },
  };
}
