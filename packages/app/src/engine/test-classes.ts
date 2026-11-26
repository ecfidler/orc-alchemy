// The pack class of the Class step tests (ORC-349): a class with a description, a hit die, saves, a skill choice, a
// feature at level 2 and a subclass title, in a pack, for the facts and the features table of its modal.
import type { Homebrew } from "./engine.ts";
import { toEdn } from "./test-edn.ts";

export const CLASS_PACK = "Class Pack";

/** A pack class: d10, Strength and Constitution saves, two of Athletics and History, Rune Carver at level 2, and an improvement at level 4. */
export const RUNE_KNIGHT = {
  "~:key": "~:rune-knight",
  "~:name": "Rune Knight",
  "~:option-pack": CLASS_PACK,
  "~:help": "A warrior of runes.",
  "~:hit-die": 10,
  "~:subclass-level": 3,
  "~:subclass-title": "Rune Path",
  "~:ability-increase-levels": [4],
  "~:profs": {
    "~:save": { "~:orcpub.dnd.e5.character/str": true, "~:orcpub.dnd.e5.character/con": true },
    "~:skill-options": { "~:choose": 2, "~:options": { "~:athletics": true, "~:history": true } },
  },
  "~:level-modifiers": [{ "~:type": "~:armor-prof", "~:value": "~:light", "~:level": 1 }],
  "~:traits": [{ "~:name": "Rune Carver", "~:type": "~:b-action", "~:level": 2, "~:description": "You carve a rune." }],
};

/** The homebrew with RUNE_KNIGHT. */
export const CLASS_PACKS = { [CLASS_PACK]: { "~:orcpub.dnd.e5/classes": { "~:rune-knight": RUNE_KNIGHT } } } as unknown as Homebrew;

/** RUNE_KNIGHT in its pack, as the text of an .orcbrew file. */
export const runeKnightOrcbrew = () => toEdn({ "~:orcpub.dnd.e5/classes": { "~:rune-knight": RUNE_KNIGHT } });

/** The value at the end of the steps of a features table (classFeatureSteps, subclassFeatureSteps), all at once. */
export function allSteps<T>(steps: Generator<void, T>): T {
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}
