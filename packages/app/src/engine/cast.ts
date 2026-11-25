// The Cast control of the spell view (ORC-320, docs/design/sheet-interactivity.md
// "Casting a spell"): which control a spell gets, which slots it can spend,
// the entries of the menu "Cast at a higher level" with their calculated
// amounts, the hint, the status text and the concentration rule. The
// component only renders what this file gives. cast-apply.ts writes a cast.
//
// ORC-321 adds the spells with their own uses (Mystic Arcanum, the invocation
// spells): it adds a kind to CastChoices, and a kind to CastAction.
import { amountAt, type HigherLevels, higherLevels } from "./higher-levels.ts";
import { type KnownSpell, ordinal, type Spellcasting } from "./sheet.ts";
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
  /** No control: a cantrip or an at-will spell without concentration, a ritual cast, an unprepared spell, a spell with its own uses (ORC-321), or no slot of its level or higher. */
  | { kind: "none" }
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

/** The cast note "at will". */
const AT_WILL = /^at will$/i;
/** A cast note of a ritual cast, such as "ritual only". */
const RITUAL = /\britual\b/i;

/** True when the spell of this record needs concentration: its duration starts with "Concentration". */
export const needsConcentration = (record: Pick<SpellRecord, "duration"> | undefined) =>
  record?.duration ? durationParts(record.duration).concentration : false;

const leftText = (left: number) => (left > 0 ? `${left} left` : "none left");

/** The name of a slot group in a hint: "1st-level slot", or "Pact slot (5th)". */
const slotName = (slot: CastSlot) => (slot.group === "pact" ? `Pact slot (${ordinal(slot.level)})` : `${ordinal(slot.level)}-level slot`);

/** The amount of a slot level, or "" when the spell has no calculated amount. */
const amountOf = (higher: HigherLevels, spellLevel: number, level: number) => (higher.kind === "amount" ? amountAt(higher.amount, level - spellLevel) : "");

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
 * - A ritual cast, an unprepared spell of a class that prepares, and a spell with another cast note (its own
 *   uses, ORC-321) have no control.
 * - Cast spends a slot of the spell level: the other slots of that level, or else the pact slots of that level.
 *   The menu lists each other slot level above it, and the pact slots when their level is the spell level or
 *   higher. When only one slot group can cast the spell, the control is a plain Cast button that spends it.
 * - A spell with no slot group of its level or higher has no control.
 */
export function castChoices(spell: CastSpell, record: SpellRecord | undefined, slots: CastSlots, concentration: string | null): CastChoices {
  const note = spell.castNote?.trim() ?? "";
  if (spell.level === 0 || AT_WILL.test(note)) {
    if (!needsConcentration(record)) return { kind: "none" };
    const active = concentration === spell.key;
    return { kind: "concentrate", active, hint: active ? "You concentrate on this spell." : "This sets the concentration mark and spends nothing." };
  }
  if (RITUAL.test(note) || note !== "") return { kind: "none" };
  const preparer = slots.casters.some((caster) => caster.name === spell.source && caster.prepares);
  if (preparer && !spell.prepared) return { kind: "none" };
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

/** A cast: one slot of a group, or only the concentration mark (the Concentrate button). */
export type CastAction =
  | {
      kind: "slot";
      /** The spell key, for the concentration mark. */
      key: string;
      /** The name that shows, for the status line. */
      name: string;
      /** The spell level. */
      level: number;
      group: SlotGroup;
      /** True when the spell needs concentration: the cast sets the mark. */
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
 * The status line after a cast: "Cast Magic Missile at 2nd level. 2nd-level
 * slots −1 (1 left)." A cast at the spell level has no level. After the
 * Concentrate button: "Concentrating on Bless."
 */
export function castStatus(action: CastAction, slot?: { level: number; left: number }): string {
  if (action.kind === "concentrate") return `Concentrating on ${action.name}.`;
  const at = slot && slot.level > action.level ? ` at ${ordinal(slot.level)} level` : "";
  const slots = action.group === "pact" ? "Pact slots" : `${ordinal(action.group)}-level slots`;
  return `Cast ${action.name}${at}. ${slots} −1 (${slot?.left ?? 0} left).`;
}
