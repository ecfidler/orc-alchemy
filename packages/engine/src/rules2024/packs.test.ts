// Loading a pack for the engine: after the schema, the converter checks the
// rules of each record, and a bad record loses its effects or is dropped
// with an issue, so that the pack still loads.

import { describe, expect, it } from "vitest";
import examplePack from "../format/fixtures/example-pack.json" with { type: "json" };
import { loadContentPack } from "./packs.ts";
import { testPackEnvelope } from "./testing.ts";

const homebrew = testPackEnvelope("hb");
const feat = (key: string, effects: unknown[]) => ({
  key,
  name: key,
  category: "general",
  repeatable: true,
  traits: [{ key: "benefit", name: "Benefit", text: "A benefit." }],
  effects,
});

describe("loadContentPack", () => {
  it("loads the example pack with no issue", () => {
    expect(loadContentPack(examplePack).issues).toEqual([]);
  });

  it("drops the effects of a record whose rules do not convert, and keeps its display layer", () => {
    const { pack, issues } = loadContentPack({
      ...homebrew,
      feats: [
        feat("good", [{ add: "speed", value: 5 }]),
        feat("no-value", [{ add: "hitPoints", value: 1 }]),
        feat("wrong-kind", [{ add: "speed", value: { read: "creatureType" } }]),
        feat("loop", [{ grantFeat: "hb:loop" }]),
        feat("bad-uses", [{ uses: { trait: "nothing", amount: 1, recover: [{ on: "long-rest", amount: "all" }] } }]),
      ],
    });
    expect(issues).toEqual([
      {
        path: ["feats", 1, "effects", 0, "add"],
        message: '"hitPoints" is not a sheet value, so the record loads without its effects',
        dropped: "effects",
      },
      {
        path: ["feats", 2, "effects", 0, "value"],
        message: "the value is a string, not a number, so the record loads without its effects",
        dropped: "effects",
      },
      {
        path: ["feats", 3, "effects", 0, "grantFeat"],
        message: "the feats grant each other in a loop: hb:loop > hb:loop, so the record loads without its effects",
        dropped: "effects",
      },
      {
        path: ["feats", 4, "effects", 0, "uses", "trait"],
        message: 'the record has no trait "nothing", so the record loads without its effects',
        dropped: "effects",
      },
    ]);
    expect(pack?.feats.map((f) => [f.key, f.effects?.length ?? 0, f.traits?.length])).toEqual([
      ["good", 1, 1],
      ["no-value", 0, 1],
      ["wrong-kind", 0, 1],
      ["loop", 0, 1],
      ["bad-uses", 0, 1],
    ]);
  });

  it("keeps a record that grants a bad feat once the bad feat has lost its effects", () => {
    const { pack, issues } = loadContentPack({
      ...homebrew,
      feats: [feat("grants", [{ grantFeat: "hb:bad" }]), feat("bad", [{ add: "languages", value: 1 }])],
    });
    expect(issues.map((issue) => issue.path.join("."))).toEqual(["feats.1.effects.0.add"]);
    expect(pack?.feats[0].effects).toHaveLength(1);
  });

  it("resolves the references of a homebrew pack in the packs that it gets", () => {
    const background = { ...examplePack.backgrounds[0], key: "gladiator", name: "Gladiator", feat: "srd52:alert", tool: "srd52:dice" };
    const srd = loadContentPack(examplePack).pack;
    if (!srd) throw new Error("The example pack does not load");
    expect(loadContentPack({ ...homebrew, backgrounds: [background] }, { packs: [srd] }).issues).toEqual([]);

    // Without the built-in pack, the Origin feat is not loaded. The field is not an effect, so the record is dropped.
    const alone = loadContentPack({ ...homebrew, backgrounds: [background] });
    expect(alone.issues).toEqual([
      { path: ["backgrounds", 0, "feat"], message: 'no feat "srd52:alert" is loaded, so the record does not load', dropped: "record" },
    ]);
    expect(alone.pack?.backgrounds).toEqual([]);
  });

  it("gives the index of the record in the file when the loader dropped a record before it", () => {
    const { issues } = loadContentPack({ ...homebrew, feats: [{ ...feat("x", []), key: "Not A Key" }, feat("bad", [{ add: "nope", value: 1 }])] });
    expect(issues.map((issue) => [issue.path.join("."), issue.dropped])).toEqual([
      ["feats.0.key", "record"],
      ["feats.1.effects.0.add", "effects"],
    ]);
  });

  it("refuses uses that an option of a selection gives", () => {
    const option = { key: "o1", name: "O1", effects: [{ uses: { trait: "benefit", amount: 3, recover: [{ on: "long-rest", amount: "all" }] } }] };
    const { issues } = loadContentPack({ ...homebrew, feats: [feat("choice", [{ selection: { key: "pick", name: "Pick", choose: 1, from: [option] } }])] });
    expect(issues.map((issue) => issue.path.join("."))).toEqual(["feats.0.effects.0.selection.from.0.effects.0.uses"]);
    expect(issues[0].message).toBe("an option of a selection cannot give uses to a trait, so the record loads without its effects");
  });

  it("reports a reference that does not resolve, and keeps the record", () => {
    const spell = { ...examplePack.spells[0], key: "flare", classes: ["hb:nobody"] };
    const { pack, issues } = loadContentPack({ ...homebrew, spells: [spell] });
    expect(issues).toEqual([{ path: ["spells", 0, "classes", 0], message: '"hb:nobody" is not a record of classes in "hb"', dropped: "none" }]);
    expect(pack?.spells).toHaveLength(1);
  });
});
