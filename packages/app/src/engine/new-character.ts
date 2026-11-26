// A character with no class (ORC-342, docs/design/character-builder.md, "A
// character with no class"): the new character of the app, and the first
// class that the player adds to it.
import type { Content, Engine, StrictEntity } from "./engine.ts";
import { withoutClassStartingEquipment } from "./equipment.ts";

const KEY = "~:orcpub.entity.strict/key";
const SELECTIONS = "~:orcpub.entity.strict/selections";
const OPTIONS = "~:orcpub.entity.strict/options";

type StrictSelection = { [KEY]: string; [OPTIONS]?: { [KEY]: string }[] };
type Strict = { [SELECTIONS]?: StrictSelection[] };

const strict = (entity: StrictEntity) => (typeof entity === "string" ? JSON.parse(entity) : entity) as Strict;

/** The keys of the classes of the entity, in its order. */
function classKeys(entity: StrictEntity): string[] {
  const selection = strict(entity)[SELECTIONS]?.find((s) => s[KEY] === "~:class");
  return (selection?.[OPTIONS] ?? []).map((o) => o[KEY].replace(/^~:/, ""));
}

/**
 * The app's new character: the engine's new character with no class and no class starting equipment. The standard
 * scores stay. The engine's new character is a level 1 barbarian with its starting equipment.
 */
export function newCharacter(e: Engine): StrictEntity {
  let entity: StrictEntity = e.emptyCharacter();
  for (const key of classKeys(entity)) entity = e.removeClass(entity, key);
  return withoutClassStartingEquipment(e, entity);
}

/**
 * Adds the first class of a character with no class, at level 1, with its starting equipment, as the old builder
 * sets the class of its new character. The engine's addClass adds a class with no starting equipment, and it asks
 * for the multiclass prerequisites, also for the first class. setClass does neither for the first class, but it
 * needs a class at index 0: so the entity gets a stand-in class first, and setClass replaces it.
 */
export function addFirstClass(e: Engine, entity: StrictEntity, classKey: string, content?: Content): StrictEntity {
  if (classKeys(entity).length > 0) throw new Error("The character has a class already.");
  const standIn = classKey === "barbarian" ? "fighter" : "barbarian";
  const classSelection = {
    [KEY]: "~:class",
    [OPTIONS]: [{ [KEY]: `~:${standIn}`, [SELECTIONS]: [{ [KEY]: "~:levels", [OPTIONS]: [{ [KEY]: "~:level-1" }] }] }],
  };
  const selections = strict(entity)[SELECTIONS] ?? [];
  const withStandIn = {
    ...strict(entity),
    [SELECTIONS]: selections.some((s) => s[KEY] === "~:class")
      ? selections.map((s) => (s[KEY] === "~:class" ? classSelection : s))
      : [...selections, classSelection],
  };
  return e.setClass(withStandIn, 0, classKey, content);
}
