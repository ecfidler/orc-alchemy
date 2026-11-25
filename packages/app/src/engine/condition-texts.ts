// The rule text of each condition, for the popup that a click on the name of
// a condition token opens (ORC-322, docs/design/sheet-interactivity.md
// "Conditions"). Each text is a short list of rule points: what the
// condition does in play, after the SRD 5.1 appendix "Conditions", in short
// words of this app.
import type { Condition } from "./play.ts";

/** The rule points of each condition, one sentence each. */
export const CONDITION_TEXTS: Record<Condition, readonly string[]> = {
  blinded: ["You cannot see. A check that needs sight fails.", "Attacks against you have advantage. Your attacks have disadvantage."],
  charmed: ["You cannot attack the charmer or target it with harmful effects.", "The charmer has advantage on social checks with you."],
  deafened: ["You cannot hear. A check that needs hearing fails."],
  frightened: ["Disadvantage on checks and attacks while the source of fear is in sight.", "You cannot move closer to the source of fear by choice."],
  grappled: ["Your speed is 0, and no bonus to speed applies.", "It ends when the grappler is incapacitated or you leave its reach."],
  incapacitated: ["You cannot take actions or reactions."],
  invisible: [
    "Others cannot see you without magic or a special sense; you count as heavily obscured.",
    "Attacks against you have disadvantage. Your attacks have advantage.",
  ],
  paralyzed: [
    "You are incapacitated, and you cannot move or speak.",
    "You fail Strength and Dexterity saves. Attacks against you have advantage.",
    "A hit from within 5 feet is a critical hit.",
  ],
  petrified: [
    "You turn to stone with what you wear and carry. You stop aging.",
    "You are incapacitated, cannot move or speak, and know nothing around you.",
    "You fail Strength and Dexterity saves. Attacks against you have advantage.",
    "You resist all damage, and poison and disease stop.",
  ],
  poisoned: ["Disadvantage on attack rolls and ability checks."],
  prone: [
    "You can only crawl, unless you stand up. Your attacks have disadvantage.",
    "Attacks from within 5 feet have advantage against you; attacks from farther away have disadvantage.",
  ],
  restrained: [
    "Your speed is 0, and no bonus to speed applies.",
    "Attacks against you have advantage. Your attacks have disadvantage.",
    "Disadvantage on Dexterity saves.",
  ],
  stunned: [
    "You are incapacitated, cannot move, and can speak only falteringly.",
    "You fail Strength and Dexterity saves. Attacks against you have advantage.",
  ],
  unconscious: [
    "You are incapacitated, cannot move or speak, and know nothing around you.",
    "You drop what you hold and fall prone.",
    "You fail Strength and Dexterity saves. Attacks against you have advantage.",
    "A hit from within 5 feet is a critical hit.",
  ],
};
