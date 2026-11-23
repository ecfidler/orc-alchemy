// The 4 backgrounds of SRD 5.2.1 (ORC-227), p83. The engine makes each rule
// from the typed fields of the record: the ability score choice, the Origin
// feat, the skills and the tool. The character is a Wizard of the pack, so
// each value below comes from the background. ORC-228 adds the starting
// equipment.

import { describe, expect, it } from "vitest";
import { availableSelections, buildWithContributions, canChoose, findProblems } from "../core/build.ts";
import type { StrictOption, StrictSelection } from "../core/entity.ts";
import { BUILT_IN } from "./built-in.ts";
import { recordsOf } from "./content.ts";
import type { Entity2024 } from "./evaluate.ts";
import { template2024 } from "./template.ts";
import { twoAndOne } from "./testing.ts";

// Standard Array: Str 8, Dex 14, Con 13, Int 15, Wis 12, Cha 10.
const SCORES = { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 };

function character(background: StrictOption, scores = SCORES): Entity2024 {
  return {
    selections: [
      { key: "ability-scores", option: { key: "manual", value: scores } },
      {
        key: "class",
        options: [
          {
            key: "srd52:wizard",
            selections: [
              { key: "skill-proficiencies", options: [{ key: "medicine" }, { key: "nature" }] },
              { key: "levels", options: [{ key: "level-1" }] },
            ],
          },
        ],
      },
      { key: "background", option: background },
    ],
  };
}

function build(background: StrictOption, scores = SCORES) {
  const entity = character(background, scores);
  const { built } = buildWithContributions(entity, template2024);
  return { built, problems: findProblems(entity, built, template2024).map((p) => p.reason), selections: availableSelections(entity, built, template2024) };
}

const one = (key: string, option: string, selections?: StrictSelection[]): StrictSelection => ({
  key,
  option: { key: option, ...(selections ? { selections } : {}) },
});
const many = (key: string, options: string[]): StrictSelection => ({ key, options: options.map((o) => ({ key: o })) });
const background = (key: string, ...selections: StrictSelection[]): StrictOption => ({ key: `srd52:${key}`, selections });

/** The Magic Initiate choices of a background that fixes the list. */
const magicInitiate = (ability: string, cantrips: string[], spell: string) => [
  one("spellcasting-ability", ability),
  many(
    "cantrips",
    cantrips.map((c) => `srd52:${c}`),
  ),
  many("level-1-spell", [`srd52:${spell}`]),
];

describe("the background records", () => {
  it("are the 4 backgrounds of the SRD", () => {
    expect(recordsOf(BUILT_IN, "backgrounds").map(({ reference }) => reference)).toEqual(["srd52:acolyte", "srd52:criminal", "srd52:sage", "srd52:soldier"]);
  });
});

describe("Acolyte", () => {
  const acolyte = background(
    "acolyte",
    one("ability-scores", "two-and-one", twoAndOne("wis", "int").selections),
    ...magicInitiate("wis", ["guidance", "sacred-flame"], "bless"),
  );

  it("gives its abilities, skills, tool and Magic Initiate with the Cleric list", () => {
    const { built, problems } = build(acolyte);
    expect(problems).toEqual([]);
    expect(built.background).toBe("srd52:acolyte");
    // Wis 12 + 2 = 14. Int 15 + 1 = 16.
    expect(built.abilities).toMatchObject({ wis: 14, int: 16 });
    expect(built.skillProficiencies).toEqual(["medicine", "nature", "insight", "religion"]);
    expect(built.toolProficiencies).toEqual(["srd52:calligraphers-supplies"]);
    expect(built.feats).toEqual([{ key: "srd52:magic-initiate", name: "Magic Initiate", category: "origin" }]);
    expect(built.spells.map((s) => [s.spell, s.list, s.ability])).toEqual([
      ["srd52:guidance", "srd52:cleric", "wis"],
      ["srd52:sacred-flame", "srd52:cleric", "wis"],
      ["srd52:bless", "srd52:cleric", "wis"],
    ]);
  });

  it("has no list choice: the background fixes it", () => {
    const { selections } = build(acolyte);
    expect(selections.filter((s) => s.path[0] === "background").map((s) => s.key)).toEqual([
      "background",
      "ability-scores",
      "plus-two",
      "plus-one",
      "spellcasting-ability",
      "cantrips",
      "level-1-spell",
    ]);
    // Fire Bolt is a Wizard spell.
    expect(build(background("acolyte", ...magicInitiate("wis", ["fire-bolt", "light"], "bless"))).problems).toContain(
      '"srd52:fire-bolt" is not an option of "Cantrips"',
    );
  });
});

describe("Criminal", () => {
  it("gives its abilities, skills, tool and Alert", () => {
    const { built, problems } = build(background("criminal", one("ability-scores", "three-ones")));
    expect(problems).toEqual([]);
    // +1 to all three: Dex 14 + 1, Con 13 + 1, Int 15 + 1.
    expect(built.abilities).toMatchObject({ dex: 15, con: 14, int: 16 });
    expect(built.skillProficiencies).toEqual(["medicine", "nature", "sleight-of-hand", "stealth"]);
    expect(built.toolProficiencies).toEqual(["srd52:thieves-tools"]);
    expect(built.feats.map((f) => f.key)).toEqual(["srd52:alert"]);
    // Alert: Dex +2 and the Proficiency Bonus +2.
    expect(built.initiative).toBe(4);
  });
});

describe("Sage", () => {
  it("gives its abilities, skills, tool and Magic Initiate with the Wizard list", () => {
    const sage = background(
      "sage",
      one("ability-scores", "two-and-one", twoAndOne("int", "con").selections),
      ...magicInitiate("int", ["fire-bolt", "light"], "magic-missile"),
    );
    const { built, problems } = build(sage);
    expect(problems).toEqual([]);
    // Int 15 + 2 = 17. Con 13 + 1 = 14.
    expect(built.abilities).toMatchObject({ int: 17, con: 14 });
    expect(built.skillProficiencies).toEqual(["medicine", "nature", "arcana", "history"]);
    expect(built.toolProficiencies).toEqual(["srd52:calligraphers-supplies"]);
    expect(built.spells.map((s) => [s.spell, s.list])).toEqual([
      ["srd52:fire-bolt", "srd52:wizard"],
      ["srd52:light", "srd52:wizard"],
      ["srd52:magic-missile", "srd52:wizard"],
    ]);
  });
});

describe("Soldier", () => {
  const soldier = (tool: string, abilities = twoAndOne("str", "con")) => background("soldier", { key: "ability-scores", option: abilities }, one("tool", tool));

  it("gives its abilities, skills, the chosen Gaming Set and Savage Attacker", () => {
    const { built, problems } = build(soldier("srd52:playing-cards"));
    expect(problems).toEqual([]);
    // Str 8 + 2 = 10. Con 13 + 1 = 14.
    expect(built.abilities).toMatchObject({ str: 10, con: 14 });
    expect(built.skillProficiencies).toEqual(["medicine", "nature", "athletics", "intimidation"]);
    expect(built.toolProficiencies).toEqual(["srd52:playing-cards"]);
    expect(built.feats.map((f) => f.key)).toEqual(["srd52:savage-attacker"]);
  });

  it("offers only its three abilities, and the +2 and the +1 on different abilities", () => {
    expect(build(soldier("srd52:dice", twoAndOne("int", "con"))).problems).toEqual(['"int" is not an option of "Increase by 2"']);
    expect(build(soldier("srd52:dice", twoAndOne("str", "str"))).problems).toEqual([
      '"Strength" needs: A different ability from the other increase',
      '"Strength" needs: A different ability from the other increase',
    ]);
  });

  it("stops an increase at 20", () => {
    // Str 19 + 2 stops at 20 (SRD p21).
    expect(build(soldier("srd52:dice"), { ...SCORES, str: 19 }).built.abilities.str).toBe(20);
  });

  it("offers a gaming set only as the tool", () => {
    const { built } = build(soldier("srd52:dice"));
    const tools = template2024.selections
      .find((s) => s.key === "background")
      ?.options.find((o) => o.key === "srd52:soldier")
      ?.selections.find((s) => s.key === "tool");
    expect(tools?.options.filter((o) => canChoose(o, built)).map((o) => o.key)).toEqual([
      "srd52:dice",
      "srd52:dragonchess",
      "srd52:playing-cards",
      "srd52:three-dragon-ante",
    ]);
  });
});
