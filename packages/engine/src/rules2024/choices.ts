// Options and prerequisites that several choices share: the feats, the
// languages of every character, and the hooks `expertise` and
// `language-choice`.

import { type Option, option, type Prereq } from "../core/template.ts";
import { type Built2024, m } from "./built.ts";
import { type Content, recordsOf } from "./content.ts";

/**
 * A prerequisite that `item` is not in a list of the built character yet.
 * Once the option is chosen, the list has the item one time, and that is
 * still valid. Two times is a problem.
 */
export function notAlready<T>(label: string, list: (built: Built2024) => readonly T[], item: T): Prereq<Built2024> {
  return {
    label,
    canChoose: (built) => !list(built).includes(item),
    stillValid: (built) => list(built).filter((each) => each === item).length <= 1,
  };
}

/** An option that gives the language `reference`. */
export function languageOption(reference: string, name: string, prereqs: Prereq<Built2024>[] = []): Option<Built2024> {
  return option<Built2024>({ key: reference, name, modifiers: [m.push("languages", reference)], prereqs });
}

/** The name of the skill `key` in the loaded content, or the key when no record has it. */
export function skillName(content: Content, key: string): string {
  return recordsOf(content, "skills").find(({ record }) => record.key === key)?.record.name ?? key;
}
