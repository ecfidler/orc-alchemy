// The test pack of suggested uses (docs/design/homebrew-forms.md, "Suggested
// uses", "Rules"): one feature for each rule, and for each case that the
// rules do not read. The texts are written for these tests in the words of
// the SRD; they are not from a pack of a user. The tests of the rules, of the
// line in the form and of the Review uses page (ORC-207) use this pack. It
// is not under fixtures/, which is a copy of the fork.
import type { SuggestedType, SuggestedUses } from "./suggested-uses.ts";

/** Each case of the rules that the pack must have a feature for. */
export const CASES = [
  // The rules of the table.
  "rule: can't use again, long rest",
  "rule: can't use again, short or long rest",
  "rule: number of times, proficiency bonus",
  "rule: number of times, ability modifier",
  "rule: n times per day",
  "rule: use it n times, rest",
  // The cases that are not read.
  "not read: + n sum",
  "not read: level amount",
  "not read: rest phrase alone",
  "not read: once per turn",
  // Hints, and two rules with the same uses.
  "hint: two rules, different uses",
  "hint: uses with no amount",
  "hint: per day with no amount",
  "two rules, same uses",
  // Types.
  "type: one type",
  "type: two types",
] as const;
export type Case = (typeof CASES)[number];

export interface PackFeature {
  name: string;
  description: string;
  /** The uses that the text gives: uses, "hint", or null for none. */
  uses: SuggestedUses | "hint" | null;
  /** The type that the text gives, or null. */
  type: SuggestedType | null;
  /** The phrase that the reading of the uses marks, as it is in the text. */
  phrase?: string;
  /** The cases that the feature tests. */
  covers: Case[];
}

const fixed = (n: number, unit: SuggestedUses["unit"]): SuggestedUses => ({ amount: { kind: "fixed", n }, unit });

export const SUGGESTION_PACK: PackFeature[] = [
  {
    name: "Tidal Surge",
    description: "As an action, you push a wave out from you. Once you use this feature, you can't use it again until you finish a long rest.",
    uses: fixed(1, "long-rest"),
    type: "action",
    phrase: "can't use it again until you finish a long rest",
    covers: ["rule: can't use again, long rest", "type: one type"],
  },
  {
    name: "Second Breath",
    description: "On your turn, you can regain hit points equal to 1d10 + your level. Once you use this feature, you can't use it again until you finish a short or long rest.",
    uses: fixed(1, "short-rest"),
    type: null,
    phrase: "can't use it again until you finish a short or long rest",
    covers: ["rule: can't use again, short or long rest"],
  },
  {
    name: "Sure Footing",
    description: "You can steady yourself a number of times equal to your proficiency bonus, and you regain all expended uses when you finish a long rest.",
    uses: { amount: { kind: "prof" }, unit: "long-rest" },
    type: null,
    phrase: "a number of times equal to your proficiency bonus, and you regain all expended uses when you finish a long rest",
    covers: ["rule: number of times, proficiency bonus"],
  },
  {
    name: "Song of Courage",
    description: "As a bonus action, you can inspire an ally. You can use this feature a number of times equal to your Charisma modifier (a minimum of once). You regain any expended uses when you finish a long rest.",
    uses: { amount: { kind: "ability", ability: "cha" }, unit: "long-rest" },
    type: "b-action",
    phrase: "a number of times equal to your Charisma modifier (a minimum of once). You regain any expended uses when you finish a long rest",
    covers: ["rule: number of times, ability modifier", "type: one type"],
  },
  {
    name: "Mist Walk",
    description: "You can cast misty step with this trait twice per day.",
    uses: fixed(2, "day"),
    type: null,
    phrase: "twice per day",
    covers: ["rule: n times per day"],
  },
  {
    name: "Warding Hand",
    description: "When a creature you can see hits you, you can use your reaction to halve the damage. You can use it three times, and you regain all uses when you finish a short or long rest.",
    uses: fixed(3, "short-rest"),
    type: "reaction",
    phrase: "use it three times, and you regain all uses when you finish a short or long rest",
    covers: ["rule: use it n times, rest", "type: one type"],
  },
  {
    name: "Deep Reserves",
    description: "You can use this feature a number of times equal to 1 + your Wisdom modifier. You regain all expended uses when you finish a long rest.",
    uses: "hint",
    type: null,
    phrase: "a number of times equal to",
    covers: ["not read: + n sum"],
  },
  {
    name: "Calm Waters",
    description: "You can use this feature a number of times equal to your Wisdom modifier, plus one, and you regain all expended uses when you finish a long rest.",
    uses: "hint",
    type: null,
    phrase: "a number of times equal to your Wisdom modifier",
    covers: ["not read: + n sum"],
  },
  {
    name: "Still Pool",
    description: "You can use this feature a number of times equal to your Wisdom modifier (minimum of 1) + 2. You regain all expended uses when you finish a long rest.",
    uses: "hint",
    type: null,
    phrase: "a number of times equal to your Wisdom modifier",
    covers: ["not read: + n sum"],
  },
  {
    name: "Rising Tide",
    description: "You can use this feature a number of times equal to your druid level. You regain all expended uses when you finish a long rest.",
    uses: "hint",
    type: null,
    phrase: "a number of times equal to",
    covers: ["not read: level amount"],
  },
  {
    name: "Restful Mind",
    description: "When you finish a long rest, you can change the language you learned from this trait.",
    uses: null,
    type: null,
    covers: ["not read: rest phrase alone"],
  },
  {
    name: "Keen Strike",
    description: "Once per turn, when you hit a creature with a weapon attack, the attack deals an extra 1d6 damage.",
    uses: null,
    type: null,
    covers: ["not read: once per turn"],
  },
  {
    name: "Shifting Shape",
    description: "You can use it twice per day. Once you use this feature, you can't use it again until you finish a long rest.",
    uses: "hint",
    type: null,
    phrase: "twice per day",
    covers: ["hint: two rules, different uses"],
  },
  {
    name: "Old Charm",
    description: "You regain all expended uses of this trait when you finish a long rest.",
    uses: "hint",
    type: null,
    phrase: "regain all expended uses",
    covers: ["hint: uses with no amount"],
  },
  {
    name: "Wind Song",
    description: "You can whistle up a breeze a few times per day.",
    uses: "hint",
    type: null,
    phrase: "per day",
    covers: ["hint: per day with no amount"],
  },
  {
    name: "Stone Skin",
    description: "You can use it once per long rest. Once you use this feature, you can't use it again until you finish a long rest.",
    uses: fixed(1, "long-rest"),
    type: null,
    phrase: "use it once per long rest",
    covers: ["two rules, same uses"],
  },
  {
    name: "Two Ways",
    description: "You can draw a weapon as a bonus action, or put it away as an action.",
    uses: null,
    type: null,
    covers: ["type: two types"],
  },
  {
    name: "Quick Guard",
    description: "You raise your shield as an action or a bonus action.",
    uses: null,
    type: null,
    covers: ["type: two types"],
  },
];
