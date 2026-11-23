// The converter from records to core options, on the example pack and on
// small homebrew packs. The built-in pack has its own tests: species.test.ts,
// feats.test.ts and backgrounds.test.ts.

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { availableSelections, build, findProblems } from "../core/build.ts";
import type { StrictEntity } from "../core/entity.ts";
import { option, selection, type Template } from "../core/template.ts";
import examplePack from "../format/fixtures/example-pack.json" with { type: "json" };
import { loadPack } from "../format/load.ts";
import type { Effect, Pack } from "../format/schema.ts";
import { type Built2024, m } from "./built.ts";
import { type Content, findRecord } from "./content.ts";
import { defineHook, registry } from "./hooks/index.ts";
import { backgroundOption, featOption, RecordError, subclassOption } from "./records.ts";
import { template2024 } from "./template.ts";
import { testPackEnvelope } from "./testing.ts";

/** A pack that loads with no issue. Without `hooks`, the loader does not check the hook names, so the converter must. */
function loaded(input: unknown, hooks?: ReadonlySet<string>): Pack {
  const { pack, issues } = loadPack(input, { hooks });
  if (!pack || issues.length) throw new Error(JSON.stringify(issues));
  return pack;
}

const srd = loaded(examplePack, new Set());
const content: Content = { packs: [srd] };
const record = <T extends "species" | "backgrounds" | "feats">(type: T, reference: string) => {
  const found = findRecord(content, type, reference);
  if (!found) throw new Error(`No ${reference}`);
  return found;
};

describe("backgrounds", () => {
  it("offers the gaming sets of the equipment as the tool choice of the Soldier", () => {
    const soldier = backgroundOption(content, "srd52:soldier", record("backgrounds", "srd52:soldier"));
    expect(soldier.selections.find((s) => s.key === "tool")?.options.map((o) => o.key)).toEqual([
      "srd52:dice",
      "srd52:dragonchess",
      "srd52:playing-cards",
      "srd52:three-dragon-ante",
    ]);
  });
});

// A small template for one record at a time.

function single(make: (content: Content) => ReturnType<typeof option<Built2024>>, packs: Pack[] = [srd], hooks = registry([])) {
  const holder: Content = { packs, hooks };
  const template: Template<Built2024> = { ...template2024, selections: [selection({ name: "Thing", options: [make(holder)] })] };
  return (entity: StrictEntity<Pick<Built2024, "name">> = { selections: [{ key: "thing", option: { key: "hb:thing" } }] }) => build(entity, template);
}

/** The envelope of a homebrew test pack. */
const homebrew = testPackEnvelope("hb");

function feat(effects: Effect[], more: Record<string, unknown> = {}) {
  const raw = { key: "thing", name: "Thing", category: "general", repeatable: true, effects, ...more };
  const pack = loaded({ ...homebrew, feats: [raw] });
  return (content: Content) => featOption(content, "hb:thing", pack.feats[0]);
}

describe("values and conditions", () => {
  it("reads a sheet value and an entry of one", () => {
    const built = single(
      feat([
        { add: "speed", value: { read: "abilityModifiers", entry: "dex" } },
        { set: "darkvision", value: { read: "speed" } },
      ]),
    )();
    // The base Dexterity is 10, so the modifier is 0. The darkvision copies the speed: 30.
    expect(built.speed).toBe(30);
    expect(built.darkvision).toBe(30);
  });

  it("adds numbers, with a minimum", () => {
    const built = single(feat([{ add: "initiative", value: { sum: [{ read: "proficiencyBonus" }, -5], min: 1 } }]))();
    // 2 - 5 = -3, and the minimum is 1. Initiative: Dex 0 + 1.
    expect(built.initiative).toBe(1);
  });

  it("applies an add after a set of the same value that comes later", () => {
    // As Fast Movement of a class and the Speed of a species, which is a later choice (ORC-250).
    const built = single(
      feat([
        { add: "speed", value: 10 },
        { set: "speed", value: 35 },
      ]),
    )();
    expect(built.speed).toBe(45);
  });

  it("takes the highest step at or below a number", () => {
    const steps = (level: number) =>
      single(
        feat([
          {
            set: "attacksPerAction",
            value: {
              steps: [
                [5, 2],
                [11, 3],
                [20, 4],
              ],
              by: { read: "darkvision" },
            },
          },
          { set: "darkvision", value: level },
        ]),
      )().attacksPerAction;
    // The darkvision stands in for a level here. Below the first step: 0.
    expect([steps(1), steps(5), steps(10), steps(11), steps(20)]).toEqual([0, 2, 2, 3, 4]);
  });

  it("applies an effect only when its condition passes", () => {
    const when = (condition: Effect extends infer E ? (E extends { when?: infer C } ? C : never) : never) =>
      single(feat([{ add: "speed", value: 10, when: condition }]))().speed;
    expect(when({ has: "languages", item: "srd52:common" })).toBe(40);
    expect(when({ has: "wornArmor" })).toBe(30);
    expect(when({ atLeast: [{ read: "proficiencyBonus" }, 2] })).toBe(40);
    expect(when({ equals: [{ read: "size" }, "small"] })).toBe(30);
    expect(when({ not: { has: "wornArmor" } })).toBe(40);
    expect(when({ any: [{ has: "wornArmor" }, { has: "languages" }] })).toBe(40);
    expect(when({ all: [{ has: "wornArmor" }, { has: "languages" }] })).toBe(30);
  });

  it("checks the prerequisites of a feat", () => {
    const thing = feat([], { prerequisites: [{ label: "Strength 13+", test: { atLeast: [{ read: "abilities", entry: "str" }, 13] } }] })(content);
    const template: Template<Built2024> = { ...template2024, selections: [...template2024.selections, selection({ name: "Thing", options: [thing] })] };
    const problems = (str: number) => {
      const entity = {
        selections: [
          { key: "ability-scores", option: { key: "manual", value: { str, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } } },
          { key: "thing", option: { key: "hb:thing" } },
        ],
      };
      return findProblems(entity, build(entity, template), template).map((p) => p.reason);
    };
    expect(problems(13)).toEqual([]);
    expect(problems(12)).toEqual(['"Thing" needs: Strength 13+']);
  });

  it("gives a choice with its options", () => {
    const choice = single(
      feat([
        {
          selection: {
            key: "boost",
            name: "Boost",
            choose: 1,
            from: [
              { key: "fast", name: "Fast", effects: [{ add: "speed", value: 10 }] },
              { key: "keen", name: "Keen", effects: [{ set: "darkvision", value: 60 }] },
            ],
          },
        },
      ]),
    );
    const built = choice({ selections: [{ key: "thing", option: { key: "hb:thing", selections: [{ key: "boost", option: { key: "keen" } }] } }] });
    expect(built.darkvision).toBe(60);
    expect(built.speed).toBe(30);
  });
});

describe("errors in the rules of a record", () => {
  const convert = (effects: Effect[]) => () => single(feat(effects));

  it("names a sheet value that does not exist, and a value of the wrong kind", () => {
    expect(convert([{ add: "hitPoints", value: 1 }])).toThrow(RecordError);
    expect(convert([{ add: "hitPoints", value: 1 }])).toThrow('hb:thing at effects.0.add: "hitPoints" is not a sheet value');
    expect(convert([{ add: "languages", value: 1 }])).toThrow('"languages" is not a number');
    expect(convert([{ push: "speed", value: 1 }])).toThrow('"speed" is not a list');
    expect(convert([{ add: "speed", value: { read: "speed", entry: "x" } }])).toThrow('"speed" has no entries');
    expect(convert([{ add: "speed", value: { read: "creatureType" } }])).toThrow("hb:thing at effects.0.value: the value is a string, not a number");
    expect(convert([{ add: "speed", value: { sum: [1, { read: "languages" }] } }])).toThrow("at effects.0.value.sum.1: the value is a list, not a number");
    expect(convert([{ set: "speed", value: "fast" }])).toThrow('"speed" is a number, and the value is a string');
    expect(convert([{ set: "species", value: "srd52:dwarf" }])).not.toThrow();
  });

  it("names a loop of feats that grant each other", () => {
    const grants = (key: string, other: string) => ({ key, name: key, category: "general", repeatable: true, effects: [{ grantFeat: `hb:${other}` }] });
    const pack = loaded({ ...homebrew, feats: [grants("one", "two"), grants("two", "one"), grants("self", "self")] });
    expect(() => featOption({ packs: [pack] }, "hb:one", pack.feats[0])).toThrow("the feats grant each other in a loop: hb:one > hb:two > hb:one");
    expect(() => featOption({ packs: [pack] }, "hb:self", pack.feats[2])).toThrow("in a loop: hb:self > hb:self");
  });

  it("names a trait that the record does not have", () => {
    expect(convert([{ uses: { trait: "nothing", amount: 1, recover: [{ on: "long-rest", amount: "all" }] } }])).toThrow('the record has no trait "nothing"');
  });

  it("names a feat that is not loaded, and a hook that the engine does not have", () => {
    expect(convert([{ grantFeat: "srd52:lucky" }])).toThrow('no feat "srd52:lucky" is loaded');
    expect(convert([{ hook: "no-such-hook" }])).toThrow('the engine has no hook "no-such-hook"');
  });
});

describe("hooks", () => {
  const testBonus = defineHook({
    name: "test-bonus",
    args: z.strictObject({ amount: z.int() }),
    apply: ({ amount }, call) => ({
      modifiers: [{ key: "speed", deps: [], apply: (speed: number) => speed + amount, name: `${call.record} bonus` } as never],
      selections: [],
    }),
  });
  const hooks = registry([testBonus]);

  it("calls a hook with its arguments", () => {
    expect(single(feat([{ hook: "test-bonus", args: { amount: 5 } }]), [srd], hooks)().speed).toBe(35);
  });

  it("checks the arguments of a hook", () => {
    expect(() => single(feat([{ hook: "test-bonus", args: { amount: "five" } }]), [srd], hooks)).toThrow("hb:thing at effects.0.args");
  });
});

describe("subclasses", () => {
  const pack = loaded({
    ...homebrew,
    classes: [{ key: "knight", name: "Knight", hitDie: 10, savingThrows: ["str", "con"], skills: { choose: 2, from: ["athletics", "history"] } }],
    subclasses: [
      {
        key: "thing",
        name: "Order of the Thing",
        class: "hb:knight",
        features: [
          { key: "steady", name: "Steady", level: 3, text: "You stand firm." },
          { key: "swift", name: "Swift", level: 7, text: "You move fast." },
        ],
        levels: [
          { level: 7, effects: [{ add: "speed", value: 10, name: "Swift" }] },
          {
            level: 7,
            effects: [
              {
                selection: { key: "boon", name: "Boon", choose: 1, from: [{ key: "fast", name: "Fast", effects: [{ add: "speed", value: 5, name: "Fast" }] }] },
              },
            ],
          },
        ],
      },
    ],
  });
  // A stand-in for the class: an option that sets the class level.
  const template: Template<Built2024> = {
    ...template2024,
    selections: [
      selection({
        name: "Level",
        min: 0,
        options: [3, 7].map((n) => option<Built2024>({ key: `level-${n}`, name: `Level ${n}`, modifiers: [m.set("classLevels", { "hb:knight": n })] })),
      }),
      selection({ name: "Subclass", options: [subclassOption({ packs: [pack] }, "hb:thing", pack.subclasses[0])] }),
    ],
  };
  const entity = (level?: number, boon?: string): StrictEntity => ({
    selections: [
      ...(level ? [{ key: "level", option: { key: `level-${level}` } }] : []),
      { key: "subclass", option: { key: "hb:thing", ...(boon ? { selections: [{ key: "boon", option: { key: boon } }] } : {}) } },
    ],
  });
  const at = (level?: number) => build(entity(level), template);

  it("gives its features and effects from their class level", () => {
    expect(at().subclasses).toEqual({ "hb:knight": "hb:thing" });
    expect(at().features).toEqual([]);
    expect(at(3).features.map((f) => f.key)).toEqual(["hb:thing/steady"]);
    expect(at(3).speed).toBe(30);
    expect(at(7).features.map((f) => [f.key, f.level])).toEqual([
      ["hb:thing/steady", 3],
      ["hb:thing/swift", 7],
    ]);
    expect(at(7).speed).toBe(40);
  });

  it("offers a choice of a level from that class level, and its options give nothing below it", () => {
    const offered = (level: number) => availableSelections(entity(level), build(entity(level), template), template).map((s) => s.key);
    expect(offered(3)).not.toContain("boon");
    expect(offered(7)).toContain("boon");
    // Below level 7 the chosen option gives nothing, and it is a problem.
    const early = entity(3, "fast");
    expect(build(early, template).speed).toBe(30);
    expect(findProblems(early, build(early, template), template).map((p) => p.path.join("/"))).toEqual(["subclass/hb:thing/boon/fast"]);
    // Level 7: 30 + Swift 10 + Fast 5.
    expect(build(entity(7, "fast"), template).speed).toBe(45);
  });
});
