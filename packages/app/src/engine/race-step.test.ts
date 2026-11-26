// The Race step (ORC-348, docs/design/character-builder.md "The Background and Race steps"): the subrace rule, the
// section Choices of the block of a race, the facts of the detail panel, and the lines to other steps.
import { beforeAll, expect, test } from "vitest";
import { type BuilderSelection, builderSteps, treeNodes } from "./builder.ts";
import { buildTemplate, engine, type Homebrew, loadEngine, type StrictEntity } from "./engine.ts";
import { nameLookup, plainRecord, raceDetail, srdItemNames, srdRaces } from "./origin-detail.ts";
import { lineKind, otherStepLines } from "./other-steps.ts";
import { proficiencyNames } from "./proficiencies.ts";
import { raceDetailGives } from "./race-gives.ts";
import { choiceSelections, isSubraceFact, pickableSubraces, soleSubrace, templateRace } from "./race-step.ts";
import { picksUnder } from "./reconcile.ts";
import { planChange } from "./removed-picks.ts";
import { ASH_DWARF_PACKS, RACE_PACK, SYLVAR, TAGGED_RACES } from "./test-races.ts";

beforeAll(() => loadEngine());

const fighter = () => engine().setClass(engine().emptyCharacter(), 0, "fighter") as StrictEntity;

/** The fighter with the race picked as the Race step picks it: through the plan of the change. */
const withRace = (race: string, homebrew?: Homebrew) =>
  planChange({ engine: engine(), entity: fighter(), content: { homebrew } }, { kind: "pick", path: ["race"], to: race }).apply();

/** The steps of the entity, and its top-level race selection. */
function build(entity: StrictEntity, homebrew?: Homebrew) {
  const e = engine();
  const steps = builderSteps(e.evaluate(entity, { homebrew }).selections, buildTemplate(homebrew).shape);
  const race = steps.find((s) => s.name === "Race")!.selections.find((s) => s.key === "race")!;
  return { steps, race, picked: race.options.find((o) => o.selected)! };
}

const keys = (selections: BuilderSelection[]) => selections.map((s) => s.key);

test("Dragonborn: Draconic Ancestry is in Choices, with its ten dragons; the race has no subrace and no line to another step", () => {
  const { steps, race, picked } = build(withRace("dragonborn"));
  const choices = choiceSelections(picked);
  expect(keys(choices)).toEqual(["draconic-ancestry"]);
  expect(choices[0].options).toHaveLength(10);
  expect(choices[0].remaining).toBe(1);
  expect(otherStepLines(race, steps)).toEqual([]);
});

test("Dwarf with one subrace: the pick picks Hill Dwarf too, Choices has no Subrace row, and the tool is a line to Proficiencies", () => {
  expect(soleSubrace(templateRace("dwarf", { homebrew: undefined }))).toEqual({ key: "hill-dwarf", name: "Hill Dwarf" });
  const entity = withRace("dwarf");
  expect(picksUnder(entity, ["race", "dwarf"])).toContainEqual(["race", "dwarf", "subrace", "hill-dwarf"]);
  const { steps, race, picked } = build(entity);
  expect(isSubraceFact(picked.selections.find((s) => s.key === "subrace")!)).toBe(true);
  expect(choiceSelections(picked)).toEqual([]);
  expect(race.remaining).toBe(0);
  expect(otherStepLines(race, steps)).toEqual([{ kind: "Tools", step: "Proficiencies", picks: [], remaining: 1 }]);
});

test("Dwarf with two subraces (a pack subrace): the pick picks no subrace, and Choices has the Subrace row", () => {
  const entity = withRace("dwarf", ASH_DWARF_PACKS);
  expect(picksUnder(entity, ["race", "dwarf"]).filter((pick) => pick[2] === "subrace")).toEqual([]);
  const { picked } = build(entity, ASH_DWARF_PACKS);
  const choices = choiceSelections(picked);
  expect(keys(choices)).toEqual(["subrace"]);
  expect(isSubraceFact(choices[0])).toBe(false);
  expect(pickableSubraces(templateRace("dwarf", { homebrew: ASH_DWARF_PACKS })).map((s) => s.name)).toEqual(["Hill Dwarf", "Ash Dwarf"]);
});

test("a Dwarf from before ORC-348, with no subrace, keeps its Subrace row so that the player can pick Hill Dwarf", () => {
  const { picked } = build(engine().select(fighter(), ["race"], "dwarf") as StrictEntity);
  expect(keys(choiceSelections(picked))).toEqual(["subrace"]);
});

test("the change question of a pick that keeps a subrace asks nothing more: Dwarf in the place of Half-Elf picks Hill Dwarf", () => {
  const halfElf = withRace("half-elf");
  const plan = planChange({ engine: engine(), entity: halfElf, content: { homebrew: undefined } }, { kind: "pick", path: ["race"], to: "dwarf" });
  expect(plan.question).toBeNull();
  expect(picksUnder(plan.apply(), ["race", "dwarf"])).toContainEqual(["race", "dwarf", "subrace", "hill-dwarf"]);
});

test("a change from a race with one subrace asks nothing for that subrace: Elf in the place of Dwarf, and Dwarf in the place of Elf", () => {
  const plan = (entity: StrictEntity, to: string) =>
    planChange({ engine: engine(), entity, content: { homebrew: undefined } }, { kind: "pick", path: ["race"], to });
  expect(plan(withRace("dwarf"), "elf").question).toBeNull();
  const elf = plan(withRace("dwarf"), "elf").apply();
  expect(picksUnder(elf, ["race", "elf"])).toContainEqual(["race", "elf", "subrace", "high-elf"]);
  expect(plan(elf, "dwarf").question).toBeNull();
});

test("Half-Elf: no choice on the Race step, and three lines to other steps, Ability scores, Skills and Languages", () => {
  const { steps, race, picked } = build(withRace("half-elf"));
  expect(choiceSelections(picked)).toEqual([]);
  expect(otherStepLines(race, steps)).toEqual([
    { kind: "Ability scores", step: "Abilities", picks: [], remaining: 2 },
    { kind: "Skills", step: "Proficiencies", picks: [], remaining: 2 },
    { kind: "Languages", step: "Proficiencies", picks: [], remaining: 1 },
  ]);
});

/** The selection that the race opens on another step whose line in "Picked on other steps" has the kind. */
const movedNode = (race: BuilderSelection, kind: string) =>
  treeNodes(treeNodes([race], { picked: true }).flatMap((node) => node.moved)).find((node) => lineKind(node) === kind)!;

test("High Elf: the cantrip is a Cantrip line to Spells, and after the pick the line has the cantrip", () => {
  let entity = withRace("elf");
  let { steps, race } = build(entity);
  expect(otherStepLines(race, steps)).toEqual([
    { kind: "Languages", step: "Proficiencies", picks: [], remaining: 1 },
    { kind: "Cantrip", step: "Spells", picks: [], remaining: 1 },
  ]);
  const cantrip = movedNode(race, "Cantrip");
  const fireBolt = cantrip.options.find((o) => o.name === "Fire Bolt")!;
  entity = engine().select(entity, cantrip.actualPath, fireBolt.key) as StrictEntity;
  ({ steps, race } = build(entity));
  expect(otherStepLines(race, steps)[1]).toEqual({ kind: "Cantrip", step: "Spells", picks: ["Fire Bolt"], remaining: 0 });
});

test("Variant Human: after the pick of the variant, the feat is a Feat line to Feats, and after the pick the line has the feat", () => {
  let entity = engine().select(withRace("human"), ["race", "human", "variant"], "variant-human") as StrictEntity;
  let { steps, race } = build(entity);
  expect(otherStepLines(race, steps).map(({ kind, step, remaining }) => [kind, step, remaining])).toEqual([
    ["Ability scores", "Abilities", 2],
    ["Skills", "Proficiencies", 1],
    ["Languages", "Proficiencies", 1],
    ["Feat", "Feats", 1],
  ]);
  const feat = movedNode(race, "Feat");
  // Grappler is the one feat of the SRD.
  const grappler = feat.options.find((o) => o.name === "Grappler")!;
  entity = engine().select(entity, feat.actualPath, grappler.key) as StrictEntity;
  ({ steps, race } = build(entity));
  expect(otherStepLines(race, steps).at(-1)).toEqual({ kind: "Feat", step: "Feats", picks: ["Grappler"], remaining: 0 });
});

test("the panel of the SRD races: the facts, the one subrace as a fact, the choices after the fixed part, and the traits", async () => {
  const srd = await srdRaces();
  const detail = (key: string, homebrew?: Homebrew) => raceDetail(srd.find((r) => r.key === key)!, templateRace(key, { homebrew }));
  expect(detail("dwarf")).toEqual({
    description: "Dwarves are short and stout and tend to be skilled warriors and craftmen in stone and metal.",
    facts: [
      { label: "Ability scores", value: "Constitution +2" },
      { label: "Size, speed", value: "Medium, 25 ft." },
      { label: "Languages", value: "Common, Dwarvish" },
      { label: "Tools", value: "One of Brewer's Supplies, Mason's Tools, Smith's Tools" },
      { label: "Subrace", value: "Hill Dwarf: Wisdom +1" },
    ],
    traits: [
      { name: "Darkvision", text: "You see in dim light within 60 feet as in bright light." },
      { name: "Dwarven Resilience", text: "Advantage on poison saves, resistance to poison damage" },
      { name: "Stonecunning", text: "2X prof bonus on stonework-related history checks" },
    ],
  });
  // With a pack subrace, the Dwarf has two subraces: no Subrace fact.
  expect(detail("dwarf", ASH_DWARF_PACKS).facts.map((f) => f.label)).toEqual(["Ability scores", "Size, speed", "Languages", "Tools"]);
  expect(detail("half-elf").facts).toEqual([
    { label: "Ability scores", value: "Charisma +2; +1 to two of your choice" },
    { label: "Size, speed", value: "Medium, 30 ft." },
    { label: "Languages", value: "Common, Elvish; One of your choice" },
    { label: "Skills", value: "Two of your choice" },
  ]);
  expect(detail("dragonborn").facts[0]).toEqual({ label: "Ability scores", value: "Strength +2, Charisma +1" });
  expect(detail("tiefling").facts[0]).toEqual({ label: "Ability scores", value: "Charisma +2, Intelligence +1" });
  // The traits of the one subrace are in the list of traits, after those of the race.
  expect(detail("gnome").facts.at(-1)).toEqual({ label: "Subrace", value: "Rock Gnome: Constitution +1" });
  expect(detail("gnome").traits.map((t) => t.name)).toEqual(["Darkvision", "Gnome Cunning", "Artificer's Lore", "Tinker"]);
  // Human has nine subraces: no Subrace fact.
  expect(detail("human").facts.map((f) => f.label)).not.toContain("Subrace");
});

/** The detail of the race with the key with what the engine gives it (ORC-355), against the homebrew. */
async function fullDetail(key: string, homebrew?: Homebrew, record?: Record<string, unknown>) {
  const content = { homebrew };
  const nameOf = nameLookup(proficiencyNames(buildTemplate(homebrew).shape), await srdItemNames());
  const of = record ?? (await srdRaces()).find((r) => r.key === key)!;
  return raceDetail(of, templateRace(key, content), { engine: raceDetailGives(key, content), nameOf });
}

test("Dragonborn: the panel has the Breath Weapon and the Damage Resistance, with a text that needs no ancestry", async () => {
  const detail = await fullDetail("dragonborn");
  expect(detail.traits).toEqual([
    {
      name: "Breath Weapon",
      text:
        "Each creature in the area makes a saving throw, DC 8 + your CON modifier + your proficiency bonus. " +
        "It takes 2d6 damage on a failed save, and half on a success. The damage is 3d6 at level 6, 4d6 at level 11 and 5d6 at level 16. " +
        "Your Draconic Ancestry gives the area, the saving throw and the damage type. " +
        "The Breath Weapon takes an action. You can use it again after a short or long rest.",
    },
    { name: "Damage Resistance", text: "You have resistance to the damage type of your Draconic Ancestry." },
  ]);
});

test("Hill Dwarf: the panel of the Dwarf has the hit points of its one subrace, and the tool, the weapons and the subrace as facts", async () => {
  const detail = await fullDetail("dwarf");
  expect(detail.facts.slice(3)).toEqual([
    { label: "Tools", value: "One of Brewer's Supplies, Mason's Tools, Smith's Tools" },
    { label: "Weapons", value: "Battleaxe, Handaxe, Light hammer, Warhammer" },
    { label: "Subrace", value: "Hill Dwarf: Wisdom +1" },
  ]);
  // The text of Dwarven Resilience names the poison resistance, so it has no trait of its own.
  expect(detail.traits.map((t) => t.name)).toEqual(["Darkvision", "Dwarven Resilience", "Stonecunning", "Hit Points"]);
  expect(detail.traits.at(-1)).toEqual({ name: "Hit Points", text: "Your hit point maximum increases by 1 for each of your levels." });
});

test("Tiefling: the panel has Hellish Resistance and Infernal Legacy, with each spell and the level that gives it", async () => {
  const detail = await fullDetail("tiefling");
  expect(detail.traits).toEqual([
    { name: "Darkvision", text: "You see in dim light within 60 feet as in bright light." },
    { name: "Hellish Resistance", text: "Resistance to fire damage" },
    {
      name: "Infernal Legacy",
      text:
        "You know thaumaturgy and can cast Hellish Rebuke and Darkness once per day. CHA is the spellcasting ability. " +
        "You get Hellish Rebuke at level 3 and Darkness at level 5.",
    },
  ]);
});

test("the other SRD races: the skills and the weapons that the engine gives are facts, and the record has each trait", async () => {
  const elf = await fullDetail("elf");
  expect(elf.facts.slice(2)).toEqual([
    // The extra language and the weapons are those of High Elf, the one subrace.
    { label: "Languages", value: "Common, Elvish; One of your choice" },
    { label: "Skills", value: "Perception" },
    { label: "Weapons", value: "Longbow, Longsword, Shortbow, Shortsword" },
    // The cantrip choice of High Elf. Its line in "Picked on other steps" has the kind Cantrip too.
    { label: "Cantrip", value: "One of your choice" },
    { label: "Subrace", value: "High Elf: Intelligence +1" },
  ]);
  expect(elf.traits.map((t) => t.name)).toEqual(["Darkvision", "Fey Ancestry", "Trance"]);
  expect((await fullDetail("half-orc")).facts.at(-1)).toEqual({ label: "Skills", value: "Intimidation" });
  expect((await fullDetail("half-elf")).facts.at(-1)).toEqual({ label: "Skills", value: "Two of your choice" });
  expect((await fullDetail("gnome")).facts.slice(-2)).toEqual([
    { label: "Tools", value: "Tinker's Tools" },
    { label: "Subrace", value: "Rock Gnome: Constitution +1" },
  ]);
  for (const key of ["gnome", "half-elf", "half-orc", "halfling", "human"]) {
    const srd = (await srdRaces()).find((r) => r.key === key)!;
    expect((await fullDetail(key)).traits, key).toEqual(raceDetail(srd, templateRace(key, { homebrew: undefined })).traits);
  }
});

test("a pack race by the same rule: a resistance, hit points and spells that no trait names get a trait, and a skill is a fact", async () => {
  const sylvar = {
    ...SYLVAR,
    "~:props": {
      "~:weapon-prof": { "~:longbow": true },
      "~:damage-resistance": { "~:cold": true },
      "~:max-hp-bonus": 1,
      "~:skill-prof": { "~:stealth": true },
    },
    "~:spells": [
      { "~:level": 1, "~:value": { "~:level": 0, "~:ability": "~:orcpub.dnd.e5.character/wis", "~:key": "~:druidcraft" } },
      { "~:level": 3, "~:value": { "~:level": 1, "~:ability": "~:orcpub.dnd.e5.character/wis", "~:key": "~:entangle" } },
    ],
  };
  const homebrew = { [RACE_PACK]: { [TAGGED_RACES]: { "~:sylvar": sylvar } } };
  const detail = await fullDetail("sylvar", homebrew, plainRecord(sylvar) as Record<string, unknown>);
  expect(detail.facts.slice(3)).toEqual([
    { label: "Skills", value: "Stealth" },
    { label: "Weapons", value: "Longbow" },
  ]);
  expect(detail.traits).toEqual([
    { name: "Darkvision", text: "You see in dim light within 60 feet as in bright light." },
    { name: "Leafstep", text: "You step from one tree to another." },
    { name: "Damage Resistance", text: "You have resistance to cold damage." },
    { name: "Hit Points", text: "Your hit point maximum increases by 1 for each of your levels." },
    { name: "Spells", text: "You know Druidcraft. You get Entangle at level 3. Wisdom is the spellcasting ability for these spells." },
  ]);
});

test("a pack race: a trait names a resistance only when it says resist, the hit points only as the hit point maximum, and a spell as a word", async () => {
  // As the Customize copy of a red Dragonborn: its Breath Weapon names fire damage, but no trait names the resistance.
  const drake = {
    ...SYLVAR,
    "~:key": "~:drake",
    "~:name": "Drake",
    "~:props": { "~:damage-resistance": { "~:fire": true }, "~:max-hp-bonus": 1 },
    "~:spells": [{ "~:level": 1, "~:value": { "~:level": 1, "~:ability": "~:orcpub.dnd.e5.character/int", "~:key": "~:shield" } }],
    "~:traits": [
      { "~:name": "Breath Weapon", "~:description": "Each creature in a 15 ft. cone takes 2d6 fire damage on a failed DEX save." },
      { "~:name": "Relentless", "~:description": "When you drop to 1 hit point, you can stand up again." },
      { "~:name": "Scales", "~:description": "Your scales are shielding you." },
    ],
  };
  const homebrew = { [RACE_PACK]: { [TAGGED_RACES]: { "~:drake": drake } } };
  const detail = await fullDetail("drake", homebrew, plainRecord(drake) as Record<string, unknown>);
  expect(detail.traits.slice(4)).toEqual([
    { name: "Damage Resistance", text: "You have resistance to fire damage." },
    { name: "Hit Points", text: "Your hit point maximum increases by 1 for each of your levels." },
    { name: "Spells", text: "You know Shield. Intelligence is the spellcasting ability for these spells." },
  ]);
});

test("a pack race: the Transit marks go, and the languages of its set show in the order of the alphabet", () => {
  const sylvar = plainRecord(SYLVAR) as Record<string, unknown>;
  expect(raceDetail(sylvar, undefined)).toEqual({
    description: "Tall wood folk who move without a sound.",
    facts: [
      { label: "Ability scores", value: "Wisdom +2, Dexterity +1" },
      { label: "Size, speed", value: "Medium, 35 ft." },
      { label: "Languages", value: "Common, Sylvan" },
    ],
    traits: [
      { name: "Darkvision", text: "You see in dim light within 60 feet as in bright light." },
      { name: "Leafstep", text: "You step from one tree to another." },
    ],
  });
});
