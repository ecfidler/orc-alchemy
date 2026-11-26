// The Cast control of the spell view (ORC-320, docs/design/sheet-interactivity.md
// "Casting a spell"): which control a spell gets, which slots it can spend,
// the entries of the menu "Cast at a higher level" with their calculated
// amounts, the hint, the status text and the concentration rule. The
// component only renders what this file gives. cast-apply.ts writes a cast.
//
// A spell with its own uses (ORC-321, "A spell with its own uses"): a spell
// with the cast note "uses Mystic Arcanum" spends a use of Mystic Arcanum, and
// an invocation spell spends a pact slot and a use of its invocation. A "uses
// …" or "once per …" note that the app cannot link gives a line and no Cast
// button.
import { amountAt, type HigherLevels, higherLevels } from "./higher-levels.ts";
import type { FeatureUsesKey } from "./play.ts";
import { type KnownSpell, type SheetFeature, type Spellcasting } from "./sheet.ts";
import { ordinal } from "./sheet-text.ts";
import type { SpellRecord } from "./spell-records.ts";
import { durationParts } from "./spell-text.ts";
import type { SlotGroup } from "./spells.ts";

/** A slot group that can cast a spell: the other slots of a level, or the pact slots. */
export interface CastSlot {
  /** The group that the cast spends (see `setSpentSlots`). */
  group: SlotGroup;
  /** The slot level. */
  level: number;
  /** The slots of the group that are not spent. */
  left: number;
}

/** An entry of the menu "Cast at a higher level". */
export interface CastEntry extends CastSlot {
  /** "3rd level", or "Pact (2nd)". */
  label: string;
  /** The calculated amount with a sign, "+2d6", or "" with no amount. */
  amount: string;
  /** "2 left", or "none left". */
  leftText: string;
}

/** The control of a spell in the spell view. */
export type CastChoices =
  /**
   * No control: a cantrip or an at-will spell without concentration, a ritual cast, a cast note that is not about
   * uses, an unprepared spell, or no slot of its level or higher.
   */
  | { kind: "none" }
  /**
   * A spell with its own uses: a plain Cast button that spends one use of `feature`, and with `pact` also one pact
   * slot. `disabled` is true when the use or the pact slot is not there.
   */
  | { kind: "uses"; feature: FeatureUsesKey; label: string; pact: boolean; disabled: boolean; hint: string }
  /** A "uses …" or "once per …" cast note that the app cannot link: no Cast button, only the line `text`. */
  | { kind: "unlinked"; text: string }
  /** A cantrip or an at-will spell that needs concentration: the Concentrate button. It sets the mark and spends nothing. */
  | { kind: "concentrate"; active: boolean; hint: string }
  /**
   * A cast with a spell slot. `main` is the slot that Cast spends, or null when Cast is disabled for want of a
   * slot of the spell level. `menu` is null when only one slot level can cast the spell: the control is then a
   * plain Cast button.
   */
  | {
      kind: "slots";
      main: CastSlot | null;
      menu: CastEntry[] | null;
      /** True when no slot that can cast the spell is left: the button says "No slots left", and both parts are disabled. */
      none: boolean;
      hint: string;
      /** The "At Higher Levels" text at the bottom of the menu, when the app does not calculate an amount; else null. */
      menuText: string | null;
    };

/** The spell of a cast as the control knows it. */
export type CastSpell = Pick<KnownSpell, "key" | "source" | "prepared" | "castNote"> & { level: number };

/** The slots and the casters of the character, as the sheet has them. */
export type CastSlots = Pick<Spellcasting, "slots" | "pact" | "casters">;

/** The uses of a feature as the sheet has them (SheetFeature.uses). */
export type FeatureUses = NonNullable<SheetFeature["uses"]>;

/** The play state that a cast reads: the slots and casters, the concentration mark, and the uses of the features. */
export interface CastState {
  slots: CastSlots;
  /** The spell key of the concentration mark, or null. */
  concentration: string | null;
  /** The uses of the features of the sheet (featureUses). */
  uses: readonly FeatureUses[];
}

/**
 * The invocation spells: the spell key to the name of the feature whose use
 * the spell spends, with a pact slot. The table applies to a known spell
 * with a cast note that starts with "once per". cast.test.ts checks each
 * row against the engine.
 */
export const INVOCATION_SPELLS: Readonly<Record<string, string>> = {
  compulsion: "Eldritch Invocation: Bewitching Whispers",
  confusion: "Eldritch Invocation: Dreadful Word",
  polymorph: "Eldritch Invocation: Sculptor of Flesh",
  "bestow-curse": "Eldritch Invocation: Sign of Ill Omen",
  bane: "Eldritch Invocation: Thief of Five Fates",
  "conjure-elemental": "Eldritch Invocation: Minions of Chaos",
};

/** The feature of the cast note "uses Mystic Arcanum". */
const MYSTIC_ARCANUM = "Mystic Arcanum";
/** A cast note that names a feature: "uses Mystic Arcanum". */
const USES_NOTE = /^uses\s+(.+)$/i;
/** The cast note of an invocation spell: "once per long rest". */
const ONCE_PER = /^once per\b/i;
/** The name of a feature in a hint or a status: an invocation without "Eldritch Invocation: ". */
const shortName = (name: string) => name.replace(/^Eldritch Invocation:\s*/, "");

/** The cast note "at will". */
const AT_WILL = /^at will$/i;
/** A cast note of a ritual cast, such as "ritual only". */
const RITUAL = /\britual\b/i;

/** True when the spell of this record needs concentration: its duration starts with "Concentration". */
export const needsConcentration = (record: Pick<SpellRecord, "duration"> | undefined) =>
  record?.duration ? durationParts(record.duration).concentration : false;

/**
 * The feature whose use a spell with the cast note `note` spends, and whether it also spends a pact slot; or, for a
 * "uses …" or "once per …" note that the app cannot link, the name for the line; or null for another note. The
 * link is the cast note and the invocation table, never a list of the spells of a feature, so a pack spell with the
 * note "uses Mystic Arcanum" works.
 */
function ownUses(key: string, note: string, uses: readonly FeatureUses[]): { feature: FeatureUses; pact: boolean } | { unlinked: string } | null {
  const link = (name: string, pact: boolean) => {
    const feature = uses.find((u) => u.name === name);
    return feature ? { feature, pact } : { unlinked: shortName(name) };
  };
  const named = USES_NOTE.exec(note)?.[1]?.trim();
  if (named !== undefined) return named.toLowerCase() === MYSTIC_ARCANUM.toLowerCase() ? link(MYSTIC_ARCANUM, false) : { unlinked: named };
  if (!ONCE_PER.test(note)) return null;
  const invocation = INVOCATION_SPELLS[key];
  return invocation ? link(invocation, true) : { unlinked: note };
}

const leftText = (left: number) => (left > 0 ? `${left} left` : "none left");

/** The name of a slot group in a hint: "1st-level slot", or "Pact slot (5th)". */
const slotName = (slot: CastSlot) => (slot.group === "pact" ? `Pact slot (${ordinal(slot.level)})` : `${ordinal(slot.level)}-level slot`);

/**
 * The amount of a slot level, or "" when the spell has no calculated amount. The levels count from the base level
 * of the text ("above 2nd"), or else from the spell level.
 */
const amountOf = (higher: HigherLevels, spellLevel: number, level: number) =>
  higher.kind === "amount" ? amountAt(higher.amount, level - (higher.amount.above ?? spellLevel)) : "";

/**
 * The slot groups that can cast a spell of `level`, in the order of a menu:
 * the other slots of each level from the spell level, then the pact slots
 * when their level is the spell level or higher. A group with no slots is not
 * in it.
 */
export function castSlots({ slots, pact }: Pick<CastSlots, "slots" | "pact">, level: number): CastSlot[] {
  const others = slots.filter((s) => s.count > 0 && s.level >= level).map((s) => ({ group: s.level, level: s.level, left: Math.max(0, s.count - s.spent) }));
  const pactSlot =
    pact && pact.count > 0 && pact.slotLevel >= level ? [{ group: "pact" as const, level: pact.slotLevel, left: Math.max(0, pact.count - pact.spent) }] : [];
  return [...others, ...pactSlot];
}

/**
 * The control of a known spell in the spell view.
 *
 * - A cantrip, or a spell with the cast note "at will", has no Cast button. With concentration it has the
 *   Concentrate button.
 * - A ritual cast and an unprepared spell of a class that prepares have no control.
 * - A spell with its own uses (see ownUses) has a plain Cast button that spends one use, and for an invocation
 *   spell also a pact slot. A "uses …" or "once per …" note that the app cannot link gets only the line "This
 *   spell has its own uses (…). Spend the use on the sheet." Another cast note has no control.
 * - Cast spends a slot of the spell level: the other slots of that level, or else the pact slots of that level.
 *   The menu lists each other slot level above it, and the pact slots when their level is the spell level or
 *   higher. When only one slot group can cast the spell, the control is a plain Cast button that spends it.
 * - A spell with no slot group of its level or higher has no control.
 */
export function castChoices(spell: CastSpell, record: SpellRecord | undefined, { slots, concentration, uses }: CastState): CastChoices {
  const note = spell.castNote?.trim() ?? "";
  if (spell.level === 0 || AT_WILL.test(note)) {
    if (!needsConcentration(record)) return { kind: "none" };
    const active = concentration === spell.key;
    return { kind: "concentrate", active, hint: active ? "You concentrate on this spell." : "This sets the concentration mark and spends nothing." };
  }
  if (RITUAL.test(note)) return { kind: "none" };
  const preparer = slots.casters.some((caster) => caster.name === spell.source && caster.prepares);
  if (preparer && !spell.prepared) return { kind: "none" };
  if (note !== "") return ownUsesChoices(spell, note, slots, uses);
  const groups = castSlots(slots, spell.level);
  if (groups.length === 0) return { kind: "none" };
  const higher = higherLevels(record);
  const none = groups.every((g) => g.left === 0);
  if (groups.length === 1) {
    const [only] = groups;
    const amount = amountOf(higher, spell.level, only.level);
    return {
      kind: "slots",
      main: only,
      menu: null,
      none,
      hint: [slotName(only), leftText(only.left), amount && `${amount} at ${ordinal(only.level)} level`].filter(Boolean).join(" · "),
      menuText: null,
    };
  }
  // The slot of the spell level: an other slot, or else the pact slots of that level.
  const main = groups.find((g) => g.group === spell.level) ?? groups.find((g) => g.group === "pact" && g.level === spell.level) ?? null;
  const menu = groups
    .filter((g) => g !== main)
    .map((g) => ({
      ...g,
      label: g.group === "pact" ? `Pact (${ordinal(g.level)})` : `${ordinal(g.level)} level`,
      amount: amountOf(higher, spell.level, g.level),
      leftText: leftText(g.left),
    }));
  const hint = none
    ? "Each slot that can cast this spell is spent."
    : main && main.left > 0
      ? `${slotName(main)} · ${leftText(main.left)}`
      : `No ${ordinal(spell.level)}-level slot left. Pick a higher level.`;
  return { kind: "slots", main, menu, none, hint, menuText: higher.kind === "text" ? higher.text : null };
}

/** The control of a spell with a cast note that is not "at will" or a ritual cast: see ownUses. */
function ownUsesChoices(spell: CastSpell, note: string, slots: CastSlots, uses: readonly FeatureUses[]): CastChoices {
  const own = ownUses(spell.key, note, uses);
  if (own === null) return { kind: "none" };
  if ("unlinked" in own) return { kind: "unlinked", text: `This spell has its own uses (${own.unlinked}). Spend the use on the sheet.` };
  const { feature, pact } = own;
  const label = shortName(feature.name);
  const left = Math.max(0, feature.amount - feature.spent);
  const key = { units: feature.units, name: feature.name };
  if (!pact) {
    const hint = left > 0 ? `Spends ${label} (${left} of ${feature.amount} left).` : `${label} has no use left.`;
    return { kind: "uses", feature: key, label, pact, disabled: left === 0, hint };
  }
  const slot = castSlots(slots, spell.level).find((g) => g.group === "pact");
  const hint =
    left === 0
      ? `${label} has no use left.`
      : !slot || slot.left === 0
        ? "No pact slot left."
        : `Spends ${label} (${left} left) and a pact slot (${ordinal(slot.level)}, ${slot.left} left).`;
  return { kind: "uses", feature: key, label, pact, disabled: left === 0 || !slot || slot.left === 0, hint };
}

/** A cast: one slot of a group, one use of a feature (with a pact slot or not), or only the concentration mark (the Concentrate button). */
export type CastAction =
  | {
      kind: "slot";
      /** The spell key, for the concentration mark. */
      key: string;
      /** The name that shows, for the status text. */
      name: string;
      /** The spell level. */
      level: number;
      group: SlotGroup;
      /** True when the spell needs concentration: the cast sets the mark. */
      concentration: boolean;
    }
  | {
      kind: "uses";
      key: string;
      name: string;
      level: number;
      /** The feature whose use the cast spends. */
      feature: FeatureUsesKey;
      /** The name of the feature for the status text: "Thief of Five Fates". */
      label: string;
      /** True when the cast also spends a pact slot: an invocation spell. */
      pact: boolean;
      concentration: boolean;
    }
  | { kind: "concentrate"; key: string; name: string };

/** True when the cast must ask first: the spell needs concentration, and the mark is set for another spell. */
export const asksFirst = (action: CastAction, concentration: string | null) =>
  (action.kind === "concentrate" || action.concentration) && concentration !== null && concentration !== action.key;

/** The question of the dialog that asks first, with its title, text and action. */
export interface ConcentrationQuestion {
  title: string;
  text: string;
  action: string;
}

/** The dialog that asks first: "Cast Invisibility?", or "Concentrate on Bless?" for the Concentrate button. */
export function concentrationQuestion(action: CastAction, current: string): ConcentrationQuestion {
  const verb = action.kind === "concentrate" ? "Concentrate" : "Cast";
  return {
    title: action.kind === "concentrate" ? `Concentrate on ${action.name}?` : `Cast ${action.name}?`,
    text: `You concentrate on ${current}. ${action.name} also needs concentration, so ${current} ends.`,
    action: `${verb} and end ${current}`,
  };
}

/**
 * The status text after a cast: "Cast Magic Missile at 2nd level. 2nd-level
 * slots −1 (1 left)." A cast at the spell level has no level. A cast with a
 * use: "Cast Bane at 5th level. Thief of Five Fates −1 (0 left), Pact slots
 * −1 (3 left)." After the Concentrate button: "Concentrating on Bless."
 * `slot` is the slot that the cast spent, and `useLeft` the uses left after it.
 */
export function castStatus(action: CastAction, slot?: { level: number; left: number }, useLeft = 0): string {
  if (action.kind === "concentrate") return `Concentrating on ${action.name}.`;
  const at = slot && slot.level > action.level ? ` at ${ordinal(slot.level)} level` : "";
  const group = action.kind === "uses" ? (action.pact ? "pact" : null) : action.group;
  const parts = [
    action.kind === "uses" && `${action.label} −1 (${useLeft} left)`,
    group !== null && `${group === "pact" ? "Pact slots" : `${ordinal(group)}-level slots`} −1 (${slot?.left ?? 0} left)`,
  ];
  return `Cast ${action.name}${at}. ${parts.filter(Boolean).join(", ")}.`;
}
