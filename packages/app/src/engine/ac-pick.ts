// The AC pick (ORC-325, docs/design/sheet-interactivity.md "AC pick"): the AC
// that the Armor Class box shows, the marks of the table "AC by armor", and
// the entries of the menu "Armor class shows". A pick changes only the number
// in the box. The app never writes the worn armor or the wielded shield from
// the sheet.
import type { AcPick } from "./play.ts";

/** An armor and a shield as item keys; null for none. */
export interface AcPair {
  armor: string | null;
  shield: string | null;
}

/** A row of the table "AC by armor": a pair and its AC. */
export interface AcRow extends AcPair {
  ac: number;
}

/** What the Armor Class box and the table "AC by armor" show. */
export interface AcShown {
  /** The AC that the box shows: the AC of the pick, or the AC of the worn armor. */
  ac: number;
  /** The AC of the worn armor, which shows without a pick. */
  wornAc: number;
  /** The index of the row of the worn pair, which has the tag "worn"; null when no row is worn. */
  wornRow: number | null;
  /** The index of the row whose AC shows, which has the dot and bold text; null when no row has it. */
  shownRow: number | null;
  /** The pick when it names a row of the table; null without a pick, or for a pair that is not in the table. */
  pick: AcPick | null;
}

const samePair = (a: AcPair, b: AcPair) => a.armor === b.armor && a.shield === b.shield;

/**
 * The AC that shows and the marks of the table. `worn` is the worn armor and
 * wielded shield, null when neither is set. `baseAc` is the AC with no
 * armor of the engine. As the old app: with nothing worn, or a worn pair that
 * is not in the table, the AC of the worn armor is the best AC. A pick that
 * names a pair that is not in the table is ignored, with no message.
 * Without a pick, the row whose AC shows is the worn row, or else the first
 * row with that AC.
 */
export function acShown(rows: readonly AcRow[], worn: AcPair | null, baseAc: number, pick: AcPick | null): AcShown {
  const best = Math.max(baseAc, ...rows.map((row) => row.ac));
  const wornIndex = worn === null ? -1 : rows.findIndex((row) => samePair(row, worn));
  const wornAc = wornIndex < 0 ? best : rows[wornIndex]!.ac;
  const pickIndex = pick === null ? -1 : rows.findIndex((row) => samePair(row, pick));
  if (pickIndex >= 0) return { ac: rows[pickIndex]!.ac, wornAc, wornRow: wornIndex < 0 ? null : wornIndex, shownRow: pickIndex, pick };
  const shownIndex = wornIndex >= 0 ? wornIndex : rows.findIndex((row) => row.ac === wornAc);
  return { ac: wornAc, wornAc, wornRow: wornIndex < 0 ? null : wornIndex, shownRow: shownIndex < 0 ? null : shownIndex, pick: null };
}

/** A pair with the names of its items, as the sheet gives the rows of the table. */
export interface NamedAcRow {
  armor: { key: string; name: string } | null;
  shield: { key: string; name: string } | null;
  ac: number;
}

/** The name of a row of the table "AC by armor" and of its menu entry: "Chain Mail + Shield", "Unarmored". */
export const acRowName = ({ armor, shield }: Pick<NamedAcRow, "armor" | "shield">) => `${armor ? armor.name : "Unarmored"}${shield ? ` + ${shield.name}` : ""}`;

/** The name of the Armor Class box as a button, with the AC that shows (sheet-interactivity.md, "Keyboard and screen reader"). */
export const acBoxName = (ac: number) => `Armor class, ${ac}`;

/** The title of the menu of the Armor Class box. */
export const AC_MENU_TITLE = "Armor class shows";

/** The value of the menu entry "Worn armor". The value of a row is its item keys, so the two never match. */
export const WORN_ARMOR = "worn";

/** An entry of the menu "Armor class shows". */
export interface AcMenuEntry {
  /** The value of the menu item: WORN_ARMOR, or the item keys of the row. */
  value: string;
  text: string;
  /** The AC, at the end of the line. */
  note: string;
  /** What the entry writes: null for "Worn armor", which removes the pick. */
  pick: AcPick | null;
}

/**
 * The menu "Armor class shows": first "Worn armor", with the AC of the worn
 * armor, then one entry for each row of the table, with its AC. `checked` is
 * the value of the entry that shows: with a pick (`picked`), the row whose
 * AC shows; without one, "Worn armor".
 */
export function acMenu(rows: readonly (NamedAcRow & { shown: boolean })[], wornAc: number, picked: boolean): { entries: AcMenuEntry[]; checked: string } {
  const entries = rows.map((row): AcMenuEntry & { shown: boolean } => {
    const pick = { armor: row.armor?.key ?? null, shield: row.shield?.key ?? null };
    return { value: `${pick.armor ?? ""}/${pick.shield ?? ""}`, text: acRowName(row), note: String(row.ac), pick, shown: row.shown };
  });
  const checked = (picked && entries.find((entry) => entry.shown)?.value) || WORN_ARMOR;
  return {
    entries: [{ value: WORN_ARMOR, text: "Worn armor", note: String(wornAc), pick: null }, ...entries.map(({ shown: _, ...entry }) => entry)],
    checked,
  };
}
