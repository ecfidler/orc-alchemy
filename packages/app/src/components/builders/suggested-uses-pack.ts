// The test pack of suggested uses (docs/design/homebrew-forms.md, "Suggested
// uses", "Rules"): one feature for each rule, and for each case that the
// rules do not read. The texts are written for these tests in the words of
// the SRD; they are not from a pack of a user. The tests of the rules, of the
// line in the form and of the Review uses page (ORC-207) use this pack. It
// is not under fixtures/, which is a copy of the fork.
import type { SuggestedType, SuggestedUses } from "./suggested-uses.ts";

export interface PackFeature {
  name: string;
  description: string;
  /** The uses that the text gives: uses, "hint", or null for none. */
  uses: SuggestedUses | "hint" | null;
  /** The type that the text gives, or null. */
  type: SuggestedType | null;
  /** The phrase that the reading marks, as it is in the text. */
  phrase?: string;
}

export const SUGGESTION_PACK: PackFeature[] = [
  // The rules.
  {
    name: "Tidal Surge",
    description: "As an action, you push a wave out from you. Once you use this feature, you can't use it again until you finish a long rest.",
    uses: { amount: { kind: "fixed", n: 1 }, rest: "long-rest" },
    type: "action",
    phrase: "can't use it again until you finish a long rest",
  },
  {
    name: "Second Breath",
    description: "On your turn, you can regain hit points equal to 1d10 + your level. Once you use this feature, you can't use it again until you finish a short or long rest.",
    uses: { amount: { kind: "fixed", n: 1 }, rest: "short-rest" },
    type: null,
    phrase: "can't use it again until you finish a short or long rest",
  },
  {
    name: "Sure Footing",
    description: "You can steady yourself a number of times equal to your proficiency bonus, and you regain all expended uses when you finish a long rest.",
    uses: { amount: { kind: "prof" }, rest: "long-rest" },
    type: null,
    phrase: "a number of times equal to your proficiency bonus, and you regain all expended uses when you finish a long rest",
  },
  {
    name: "Song of Courage",
    description: "As a bonus action, you can inspire an ally. You can use this feature a number of times equal to your Charisma modifier (a minimum of once). You regain any expended uses when you finish a long rest.",
    uses: { amount: { kind: "ability", ability: "cha" }, rest: "long-rest" },
    type: "b-action",
    phrase: "a number of times equal to your Charisma modifier (a minimum of once). You regain any expended uses when you finish a long rest",
  },
  {
    name: "Mist Walk",
    description: "You can cast misty step with this trait twice per day.",
    uses: { amount: { kind: "fixed", n: 2 }, rest: "day" },
    type: null,
    phrase: "twice per day",
  },
  {
    name: "Warding Hand",
    description: "When a creature you can see hits you, you can use your reaction to halve the damage. You can use it three times, and you regain all uses when you finish a short or long rest.",
    uses: { amount: { kind: "fixed", n: 3 }, rest: "short-rest" },
    type: "reaction",
    phrase: "use it three times, and you regain all uses when you finish a short or long rest",
  },
  // The cases that are not read.
  {
    name: "Deep Reserves",
    description: "You can use this feature a number of times equal to 1 + your Wisdom modifier. You regain all expended uses when you finish a long rest.",
    uses: "hint",
    type: null,
    phrase: "a number of times equal to",
  },
  {
    name: "Rising Tide",
    description: "You can use this feature a number of times equal to your druid level. You regain all expended uses when you finish a long rest.",
    uses: "hint",
    type: null,
    phrase: "a number of times equal to",
  },
  {
    name: "Restful Mind",
    description: "When you finish a long rest, you can change the language you learned from this trait.",
    uses: null,
    type: null,
  },
  {
    name: "Keen Strike",
    description: "Once per turn, when you hit a creature with a weapon attack, the attack deals an extra 1d6 damage.",
    uses: null,
    type: null,
  },
  // Hints.
  {
    name: "Shifting Shape",
    description: "You can use it twice per day. Once you use this feature, you can't use it again until you finish a long rest.",
    uses: "hint",
    type: null,
    phrase: "twice per day",
  },
  {
    name: "Old Charm",
    description: "You regain all expended uses of this trait when you finish a long rest.",
    uses: "hint",
    type: null,
    phrase: "regain all expended uses",
  },
  {
    name: "Wind Song",
    description: "You can whistle up a breeze a few times per day.",
    uses: "hint",
    type: null,
    phrase: "per day",
  },
  // Two rules with the same uses.
  {
    name: "Stone Skin",
    description: "You can use it once per long rest. Once you use this feature, you can't use it again until you finish a long rest.",
    uses: { amount: { kind: "fixed", n: 1 }, rest: "long-rest" },
    type: null,
    phrase: "use it once per long rest",
  },
  // Types.
  {
    name: "Two Ways",
    description: "You can draw a weapon as a bonus action, or put it away as an action.",
    uses: null,
    type: null,
  },
];
