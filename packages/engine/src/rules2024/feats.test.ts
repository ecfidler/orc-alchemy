// The 17 feats of SRD 5.2.1 (ORC-227), p87 to p88. The character is a
// Wizard of the pack with no background and no species, so each value below
// comes from the feat. The Fighting Style feats need the Fighting Style
// feature, so they are on the test Fighter. Each expected number has
// its arithmetic in a comment.

import { describe, expect, it } from "vitest";
import { buildWithContributions, canChoose, findProblems } from "../core/build.ts";
import type { StrictOption, StrictSelection } from "../core/entity.ts";
import type { Template } from "../core/template.ts";
import type { Built2024 } from "./built.ts";
import { BUILT_IN } from "./built-in.ts";
import { recordsOf } from "./content.ts";
import type { Entity2024 } from "./evaluate.ts";
import { featSelection } from "./records.ts";
import { template2024 } from "./template.ts";
import { fighterCharacter } from "./testing.ts";

/** The template with one more choice: a feat of any category. */
const extraFeat = featSelection(BUILT_IN, "Extra Feat");
const template: Template<Built2024> = { ...template2024, selections: [...template2024.selections, extraFeat] };

// Standard Array: Str 8, Dex 14, Con 13, Int 15, Wis 12, Cha 10.
const SCORES = { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 };

function wizard(
  level: number,
  feat?: StrictOption,
  { scores = SCORES, more = [] }: { scores?: Record<string, number>; more?: StrictSelection[] } = {},
): Entity2024 {
  return {
    selections: [
      { key: "ability-scores", option: { key: "manual", value: scores } },
      {
        key: "class",
        options: [
          {
            key: "srd52:wizard",
            selections: [
              { key: "skill-proficiencies", options: [{ key: "arcana" }, { key: "history" }] },
              { key: "levels", options: Array.from({ length: level }, (_, i) => ({ key: `level-${i + 1}` })) },
            ],
          },
        ],
      },
      ...more,
      ...(feat ? [{ key: "extra-feat", option: feat }] : []),
    ],
  };
}

function build(entity: Entity2024) {
  const { built, contributions } = buildWithContributions(entity, template);
  return { built, contributions, problems: findProblems(entity, built, template).map((p) => p.reason) };
}

const feat = (key: string, selections?: StrictSelection[]): StrictOption => ({ key: `srd52:${key}`, ...(selections ? { selections } : {}) });
const one = (key: string, option: string, selections?: StrictSelection[]): StrictSelection => ({
  key,
  option: { key: option, ...(selections ? { selections } : {}) },
});
const many = (key: string, options: string[]): StrictSelection => ({ key, options: options.map((o) => ({ key: o })) });
const featureNames = (built: Built2024, feat: string) => built.features.filter((f) => f.source === `srd52:${feat}`).map((f) => f.name);

/** The feat keys that the Extra Feat choice offers to a Wizard of a level. */
function offered(level: number, scores = SCORES): string[] {
  const { built } = build(wizard(level, undefined, { scores }));
  return extraFeat.options.filter((o) => canChoose(o, built)).map((o) => o.key.replace("srd52:", ""));
}

describe("the feat records", () => {
  it("are the 17 feats in four categories", () => {
    const byCategory = Object.groupBy(
      recordsOf(BUILT_IN, "feats").map(({ record }) => record),
      (f) => f.category,
    );
    expect(Object.fromEntries(Object.entries(byCategory).map(([category, feats]) => [category, feats?.length]))).toEqual({
      origin: 4,
      general: 2,
      "fighting-style": 4,
      "epic-boon": 7,
    });
  });

  it("offers a feat only when the character meets its prerequisites", () => {
    // Level 1: the Origin feats only. The General feats need level 4, the Fighting Style feats the feature, the Epic Boons level 19.
    expect(offered(1)).toEqual(["alert", "magic-initiate", "savage-attacker", "skilled"]);
    expect(offered(4)).toEqual(["alert", "magic-initiate", "savage-attacker", "skilled", "ability-score-improvement", "grappler"]);
    // Grappler needs Strength or Dexterity 13.
    expect(offered(4, { ...SCORES, dex: 12 })).not.toContain("grappler");
    // Level 19: the Epic Boons. Spell Recall needs the Spellcasting feature, which the Wizard has.
    expect(offered(19).filter((key) => key.startsWith("boon-"))).toHaveLength(7);
  });

  it("gives a problem for a chosen feat whose prerequisite fails", () => {
    // Level 3 is below the Level 4+ prerequisite.
    expect(build(wizard(3, feat("ability-score-improvement"))).problems).toEqual(['"Ability Score Improvement" needs: Level 4+']);
    // Str 8 and Dex 12: Grappler fails.
    const weak = wizard(4, feat("grappler", [one("ability", "str")]), { scores: { ...SCORES, dex: 12 } });
    expect(build(weak).problems).toEqual(['"Grappler" needs: Strength or Dexterity 13+']);
    // The Wizard has no Fighting Style feature.
    expect(build(wizard(1, feat("archery"))).problems).toEqual(['"Archery" needs: Fighting Style Feature']);
  });
});

describe("Origin feats", () => {
  it("Alert adds the Proficiency Bonus to Initiative", () => {
    const { built, contributions } = build(wizard(1, feat("alert")));
    // Dex +2, then Alert: the Proficiency Bonus +2.
    expect(built.initiative).toBe(4);
    expect(contributions.initiative).toEqual([{ name: "Alert", source: ["extra-feat", "srd52:alert"], from: 2, to: 4 }]);
    expect(featureNames(built, "alert")).toEqual(["Initiative Proficiency", "Initiative Swap"]);
  });

  it("Savage Attacker is one feature with its description", () => {
    const { built } = build(wizard(1, feat("savage-attacker")));
    expect(built.features.find((f) => f.source === "srd52:savage-attacker")).toMatchObject({
      key: "srd52:savage-attacker/savage-attacker",
      name: "Savage Attacker",
      summary: expect.stringContaining("roll the weapon's damage dice twice"),
    });
  });

  it("Skilled gives three skills or tools", () => {
    const { built, problems } = build(wizard(1, feat("skilled", [many("skilled", ["athletics", "stealth", "thieves-tools"])])));
    expect(problems).toEqual([]);
    expect(built.skillProficiencies).toEqual(["arcana", "history", "athletics", "stealth"]);
    expect(built.toolProficiencies).toEqual(["srd52:thieves-tools"]);
    // The Repeatable trait is the typed field `repeatable`, not a feature: the feature is the description.
    expect(featureNames(built, "skilled")).toEqual(["Skilled"]);
    // The 18 skills and the 37 tools: artisan's tools, gaming sets, musical instruments and other tools.
    expect(template.selections.at(-1)?.options.find((o) => o.key === "srd52:skilled")?.selections[0].options).toHaveLength(55);
  });

  describe("Magic Initiate", () => {
    const wizardList = (ability = "int", cantrips = ["fire-bolt", "light"], spell = "magic-missile"): StrictSelection =>
      one("spell-list", "srd52:wizard", [
        one("spellcasting-ability", ability),
        many(
          "cantrips",
          cantrips.map((c) => `srd52:${c}`),
        ),
        many("level-1-spell", [`srd52:${spell}`]),
      ]);

    it("gives two cantrips and one level 1 spell of the chosen list, with the chosen ability", () => {
      const { built, problems } = build(wizard(1, feat("magic-initiate", [wizardList()])));
      expect(problems).toEqual([]);
      expect(built.spells).toEqual([
        { spell: "srd52:fire-bolt", source: "srd52:magic-initiate", list: "srd52:wizard", ability: "int" },
        { spell: "srd52:light", source: "srd52:magic-initiate", list: "srd52:wizard", ability: "int" },
        // One cast without a spell slot, again after a Long Rest.
        {
          spell: "srd52:magic-missile",
          source: "srd52:magic-initiate",
          list: "srd52:wizard",
          ability: "int",
          uses: { amount: 1, recover: [{ on: "long-rest", amount: "all" }] },
        },
      ]);
    });

    it("offers the spells of the list only", () => {
      const option = extraFeat.options.find((o) => o.key === "srd52:magic-initiate");
      const lists = option?.selections[0].options;
      expect(lists?.map((o) => o.key)).toEqual(["srd52:cleric", "srd52:druid", "srd52:wizard"]);
      // The Cleric list has 7 cantrips and 15 level 1 spells in the SRD.
      expect(lists?.[0].selections.map((s) => [s.key, s.options.length])).toEqual([
        ["spellcasting-ability", 3],
        ["cantrips", 7],
        ["level-1-spell", 15],
      ]);
      // Sacred Flame is a Cleric spell, not a Wizard spell.
      expect(build(wizard(1, feat("magic-initiate", [wizardList("int", ["sacred-flame", "light"])]))).problems).toEqual([
        '"srd52:sacred-flame" is not an option of "Cantrips"',
      ]);
    });

    it("needs a different list when the character takes it again", () => {
      const twice = (list: string) =>
        wizard(4, feat("magic-initiate", [wizardList()]), {
          more: [
            {
              key: "species",
              option: {
                key: "srd52:human",
                selections: [
                  one("versatile", "srd52:magic-initiate", [
                    one("spell-list", list, [
                      one("spellcasting-ability", "wis"),
                      many("cantrips", ["srd52:guidance", "srd52:light"]),
                      many("level-1-spell", ["srd52:bless"]),
                    ]),
                  ]),
                ],
              },
            },
          ],
        });
      expect(build(twice("srd52:cleric")).problems).toEqual([]);
      expect(build(twice("srd52:cleric")).built.spells.map((s) => s.ability)).toEqual(["wis", "wis", "wis", "int", "int", "int"]);
      // The Cleric list has Light too, so only the list name is wrong here.
      expect(build(twice("srd52:wizard")).problems).toContain('"Wizard" needs: A spell list that this feat does not give already');
    });
  });
});

describe("General feats", () => {
  it("Ability Score Improvement gives +2 to one ability, or +1 to two", () => {
    const plusTwo = feat("ability-score-improvement", [one("increase", "two", [one("ability", "int")])]);
    // Int 15 + 2 = 17.
    expect(build(wizard(4, plusTwo)).built.abilities.int).toBe(17);
    const oneAndOne = feat("ability-score-improvement", [one("increase", "one-and-one", [many("abilities", ["int", "con"])])]);
    // Int 15 + 1 = 16. Con 13 + 1 = 14.
    expect(build(wizard(4, oneAndOne)).built.abilities).toMatchObject({ int: 16, con: 14 });
  });

  it("Ability Score Improvement stops at 20", () => {
    const plusTwo = feat("ability-score-improvement", [one("increase", "two", [one("ability", "int")])]);
    // Int 19 + 2 stops at 20 (SRD p87).
    expect(build(wizard(4, plusTwo, { scores: { ...SCORES, int: 19 } })).built.abilities.int).toBe(20);
  });

  it("Grappler increases Strength or Dexterity by 1", () => {
    const { built } = build(wizard(4, feat("grappler", [one("ability", "dex")])));
    // Dex 14 + 1 = 15.
    expect(built.abilities.dex).toBe(15);
    expect(featureNames(built, "grappler")).toEqual(["Ability Score Increase", "Punch and Grab", "Attack Advantage", "Fast Wrestler"]);
    expect(build(wizard(4, feat("grappler", [one("ability", "con")]))).problems).toEqual(['"con" is not an option of "Ability"']);
  });
});

describe("Fighting Style feats", () => {
  const fighter = (style: string, armor: string | null = "srd52:chain-mail") => {
    const entity = fighterCharacter({ level: 1, fightingStyle: `srd52:${style}`, armor });
    const { built } = buildWithContributions(entity, template);
    return { built, problems: findProblems(entity, built, template) };
  };

  it("Archery adds 2 to attacks with Ranged weapons", () => {
    const { built, problems } = fighter("archery");
    expect(problems).toEqual([]);
    // Longbow: Dex +1, PB +2, Archery +2.
    expect(built.weaponAttacks.find((a) => a.weapon === "srd52:longbow")?.attackBonus).toBe(5);
    expect(built.rangedAttackBonus).toBe(2);
  });

  it("Defense adds 1 to the Armor Class only with armor", () => {
    // Chain Mail 16 + 1.
    expect(fighter("defense").built.armorClass).toBe(17);
    // No armor: 10 + Dex +1, and no bonus.
    expect(fighter("defense", null).built.armorClass).toBe(11);
  });

  it("Great Weapon Fighting and Two-Weapon Fighting are features", () => {
    expect(featureNames(fighter("great-weapon-fighting").built, "great-weapon-fighting")).toEqual(["Great Weapon Fighting"]);
    expect(featureNames(fighter("two-weapon-fighting").built, "two-weapon-fighting")).toEqual(["Two-Weapon Fighting"]);
  });
});

describe("Epic Boons", () => {
  const boons = [
    ["boon-of-combat-prowess", "cha", ["Ability Score Increase", "Peerless Aim"]],
    ["boon-of-dimensional-travel", "cha", ["Ability Score Increase", "Blink Steps"]],
    ["boon-of-fate", "cha", ["Ability Score Increase", "Improve Fate"]],
    ["boon-of-irresistible-offense", "str", ["Ability Score Increase", "Overcome Defenses", "Overwhelming Strike"]],
    ["boon-of-spell-recall", "int", ["Ability Score Increase", "Free Casting"]],
    ["boon-of-the-night-spirit", "cha", ["Ability Score Increase", "Merge with Shadows", "Shadowy form"]],
    ["boon-of-truesight", "cha", ["Ability Score Increase", "Truesight"]],
  ] as const;

  it.each(boons)("%s increases an ability by 1, up to 30", (key, ability, features) => {
    // A score of 20 goes to 21: the cap of an Epic Boon is 30 (SRD p88).
    const { built, problems } = build(wizard(19, feat(key, [one("ability", ability)]), { scores: { ...SCORES, [ability]: 20 } }));
    expect(problems).toEqual([]);
    expect(built.abilities[ability]).toBe(21);
    expect(featureNames(built, key)).toEqual(features);
  });

  it("counts after the increases of character creation, whatever the order of the choices", () => {
    // The feat choice before the background: Int 19, the Sage +2 stops at 20, then the Boon +1 gives 21.
    const featFirst: Template<Built2024> = { ...template2024, selections: [extraFeat, ...template2024.selections] };
    const sage: StrictSelection = one("background", "srd52:sage", [
      one("ability-scores", "two-and-one", [one("plus-two", "int"), one("plus-one", "con")]),
      one("spellcasting-ability", "int"),
      many("cantrips", ["srd52:fire-bolt", "srd52:light"]),
      many("level-1-spell", ["srd52:magic-missile"]),
    ]);
    const entity = wizard(19, feat("boon-of-fate", [one("ability", "int")]), { scores: { ...SCORES, int: 19 }, more: [sage] });
    expect(findProblems(entity, buildWithContributions(entity, featFirst).built, featFirst)).toEqual([]);
    expect(buildWithContributions(entity, featFirst).built.abilities.int).toBe(21);
  });

  it("limits the abilities of Irresistible Offense and Spell Recall", () => {
    expect(build(wizard(19, feat("boon-of-irresistible-offense", [one("ability", "int")]))).problems).toEqual(['"int" is not an option of "Ability"']);
    expect(build(wizard(19, feat("boon-of-spell-recall", [one("ability", "str")]))).problems).toEqual(['"str" is not an option of "Ability"']);
  });

  it("is not offered below level 19", () => {
    expect(offered(18).some((key) => key.startsWith("boon-"))).toBe(false);
  });
});
