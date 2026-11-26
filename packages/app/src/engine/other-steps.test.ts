// The block of the main pick of the Background step (ORC-347, docs/design/character-builder.md "After the pick"): the
// lines of "Picked on other steps", and the left mark of the step.
import { beforeAll, expect, test } from "vitest";
import { type BuilderSelection, builderSteps } from "./builder.ts";
import { engine, type Homebrew, loadEngine, type StrictEntity } from "./engine.ts";
import { lineKind, otherStepLines, stepMark } from "./other-steps.ts";
import { ARTISAN, SAGE_PACKS } from "./test-backgrounds.ts";

beforeAll(() => loadEngine());

/** The steps of the entity, and its top-level background selection. */
function build(entity: StrictEntity, homebrew?: Homebrew) {
  const e = engine();
  const steps = builderSteps(e.evaluate(entity, { homebrew }).selections, e.buildTemplate(homebrew).shape);
  const background = steps.find((s) => s.name === "Background")!.selections.find((s) => s.key === "background")!;
  return { steps, background };
}

const fighter = () => engine().setClass(engine().emptyCharacter(), 0, "fighter") as StrictEntity;
const select = (entity: StrictEntity, path: string[], key: string, homebrew?: Homebrew) => engine().select(entity, path, key, { homebrew }) as StrictEntity;

test("Acolyte gives two languages on Proficiencies and its two equipment choices on Equipment; its step has no pick left", () => {
  const { steps, background } = build(select(fighter(), ["background"], "acolyte"));
  expect(otherStepLines(background, steps)).toEqual([
    { kind: "Languages", step: "Proficiencies", picks: [], remaining: 2 },
    { kind: "Starting equipment", step: "Equipment", picks: [], remaining: 2 },
  ]);
  expect(stepMark([background])).toBe(0);
});

test("a picked language shows on its line, and the line counts what is left", () => {
  let entity = select(fighter(), ["background"], "acolyte");
  const { background } = build(entity);
  const languages = background.moved.find((s) => lineKind(s) === "Languages")!;
  entity = select(entity, languages.actualPath, "elvish");
  const { steps, background: after } = build(entity);
  expect(otherStepLines(after, steps)[0]).toEqual({ kind: "Languages", step: "Proficiencies", picks: ["Elvish"], remaining: 1 });
});

test("the pack background Sage gives a language and an artisan's tool; after the tool pick, the tool line has it", () => {
  let entity = select(fighter(), ["background"], "sage", SAGE_PACKS);
  let { steps, background } = build(entity, SAGE_PACKS);
  expect(otherStepLines(background, steps).map(({ kind, step, remaining }) => [kind, step, remaining])).toEqual([
    ["Languages", "Proficiencies", 1],
    ["Tools", "Proficiencies", 1],
  ]);
  entity = select(entity, ARTISAN, "smiths-tools", SAGE_PACKS);
  ({ steps, background } = build(entity, SAGE_PACKS));
  expect(otherStepLines(background, steps)[1]).toEqual({ kind: "Tools", step: "Proficiencies", picks: ["Smith's Tools"], remaining: 0 });
});

test("with no background, the list is empty and the step has 1 left", () => {
  const { steps, background } = build(fighter());
  expect(otherStepLines(background, steps)).toEqual([]);
  expect(stepMark([background])).toBe(1);
});

test("the kind of a line comes from the tags of its selection, else its name", () => {
  const node = (key: string, name: string, tags: string[]) => ({ key, name, tags }) as BuilderSelection;
  expect(lineKind(node("asi", "Ability Score Increase", ["ability-scores"]))).toBe("Ability scores");
  expect(lineKind(node("skill-expertise", "Expertise", ["skill-profs"]))).toBe("Expertise");
  expect(lineKind(node("high-elf-cantrip", "Cantrip", ["spells"]))).toBe("Cantrip");
  expect(lineKind(node("spells-known", "Spells Known", ["spells"]))).toBe("Spells");
  expect(lineKind(node("feats", "Feat", ["feats"]))).toBe("Feat");
  expect(lineKind(node("armor-profs", "Armor", ["armor-profs"]))).toBe("Other proficiencies");
  expect(lineKind(node("x", "Draconic Ancestry", []))).toBe("Draconic Ancestry");
});

test("a line kind of a proficiency is the group of the Proficiencies step: the custom background's tool selection is Tools", () => {
  const node = (key: string, name: string, tags: string[]) => ({ key, name, tags }) as BuilderSelection;
  expect(lineKind(node("tool-language-proficiencies", "Tool / Language Proficiencies", []))).toBe("Tools");
  expect(lineKind(node("bonus", "Bonus", ["expertise"]))).toBe("Expertise");
});
