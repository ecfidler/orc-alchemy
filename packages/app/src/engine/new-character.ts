// A character with no class (ORC-342, docs/design/character-builder.md, "A
// character with no class"): the new character of the app, and the first
// class that the player adds to it.
import type { Content, Engine, StrictEntity } from "./engine.ts";
import { withoutClassStartingEquipment } from "./equipment.ts";
import { remapOption } from "./reconcile.ts";
import { classesOf, KEY, rootOf, SELECTIONS, type StrictNode, selectionsOf } from "./strict.ts";

/**
 * The app's new character: the engine's new character with no class and no class starting equipment. The standard
 * scores stay. The engine's new character is a level 1 barbarian with its starting equipment.
 */
export function newCharacter(e: Engine): StrictEntity {
  let entity: StrictEntity = e.emptyCharacter();
  for (const key of classesOf(entity)) entity = e.removeClass(entity, key);
  return withoutClassStartingEquipment(e, entity);
}

/**
 * Adds the first class of a character with no class, at level 1, with its starting equipment, as the old builder
 * sets the class of its new character. The engine's addClass adds a class with no starting equipment, and it asks
 * for the multiclass prerequisites, also for the first class. setClass does neither for the first class, but it
 * needs a class at index 0: so the entity gets a stand-in class first, the class selection of the engine's new
 * character (a level 1 barbarian), and setClass replaces it.
 */
export function addFirstClass(e: Engine, entity: StrictEntity, classKey: string, content?: Content): StrictEntity {
  if (classesOf(entity).length > 0) throw new Error("The character has a class already.");
  const empty = e.emptyCharacter();
  const [standIn] = classesOf(empty);
  // setClass does not replace a class with the same class, so a barbarian has another stand-in.
  const source = standIn === classKey ? remapOption(empty, ["class", standIn], "fighter") : empty;
  const classSelection = selectionsOf(rootOf(source)).find((s) => s[KEY] === "~:class") as StrictNode;
  const root = rootOf(entity);
  const selections = selectionsOf(root);
  const withStandIn = {
    ...root,
    [SELECTIONS]: selections.some((s) => s[KEY] === "~:class")
      ? selections.map((s) => (s[KEY] === "~:class" ? classSelection : s))
      : [...selections, classSelection],
  };
  return e.setClass(withStandIn, 0, classKey, content);
}

/** Adds a class: the first class with its starting equipment (addFirstClass), or another class (the engine's addClass). */
export function addAClass(e: Engine, entity: StrictEntity, classKey: string, content?: Content): StrictEntity {
  return classesOf(entity).length === 0 ? addFirstClass(e, entity, classKey, content) : e.addClass(entity, classKey, content);
}
