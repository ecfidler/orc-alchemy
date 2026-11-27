// The list of the Spells panel (ORC-285, docs/design/spells-panel.md "The
// list" and "Keyboard and screen reader"): the search field, then one group
// for each level, with a heading that sticks and one row for each spell.
//
// The ARIA pattern is a list of buttons with a roving tabindex, under real
// headings. A listbox does not fit: the level headings hold slot controls
// (ORC-286), and a listbox can hold only options.
//
// With row marks (`marks`), a row has a box at its left: the prepare box in
// prepare mode of the panel (ORC-287), or the box that adds the spell in the
// "Add spells" popup of the builder (ORC-357). A row stays a button that
// selects its spell, and Space on it changes its box. Its name for a screen
// reader ends with the state of its mark, for example "prepared", "not
// prepared", "always prepared" or "known". The box is a Checkbox beside the
// button in the same list item, not in it, so no control is in another one.
// The box is not a Tab stop, because the list is one Tab stop; a mouse and a
// screen reader reach it. A click on the box changes only the box, and the
// focus stays where it is. A locked row (a spell that the character cannot
// take) has the lock in the place of the box, a dimmed name, and its reason
// as its description.
import { Checkbox, Label, ListRow, LockIcon, TextInput } from "@orc-alchemy/ui";
import { type KeyboardEvent, type ReactNode, useId } from "react";
import { type ListSpell, levelHeading, type SpellGroup, spellId } from "../engine/spell-list.ts";
import type { SpellLookup } from "../engine/spell-records.ts";
import { durationParts } from "../engine/spell-text.ts";
import { BoxTag } from "./BoxTag.tsx";

/** The attribute that marks a row button, with the row's id (see `spellId`). */
export const ROW = "data-spell-row";
/** The attribute that marks the sticky heading row of a level. */
export const HEADING = "data-level-heading";
/** The attribute that marks the group of a level, with the level. */
export const LEVEL = "data-spell-level";
/** The attribute that marks the element that gets the focus when the panel opens. */
export const INITIAL_FOCUS = "data-spells-focus";

/** The box at the left of a row. */
export interface RowBox {
  checked: boolean;
  /** The name of the box, for example "Prepared: Bless". */
  name: string;
  /** True: the box cannot change, for example the box of an always-prepared spell. */
  disabled?: boolean;
  /** The text that describes the box, for example why it is disabled. */
  description?: string;
  onChange: (checked: boolean) => void;
}

/** The words of a row mark: what the name of the row ends with, and a label at the end of the row. */
interface MarkWords {
  /** The words that end the name of the row for a screen reader, for example "not prepared". */
  state?: string;
  /** A label in Inter caps at the end of the row, for example "Known", with the lock before it when `lock` is true. */
  label?: { text: string; lock?: boolean };
}

/**
 * What a row shows in the column of the boxes, and what its name for a screen reader ends with:
 *
 * - `box`: the box of the row;
 * - `none`: no box; the row keeps the space of the box;
 * - `locked`: a spell that the character cannot take. The row has the lock in the place of the box, a dimmed name,
 *   and `reason` as its description.
 */
export type RowMark = ({ kind: "box"; box: RowBox } & MarkWords) | ({ kind: "none" } & MarkWords) | { kind: "locked"; reason: string; state?: string };

export interface SpellListProps<S extends ListSpell> {
  /** The groups to show: after the search, so a group with no match is not in them. */
  groups: SpellGroup<S>[];
  /** Null while the spell chunk loads. */
  lookup: SpellLookup | null;
  query: string;
  onQueryChange: (query: string) => void;
  /** The id of the selected row, or null. */
  selected: string | null;
  /** The id of the row that is the Tab stop of the list. */
  tabStop: string | null;
  /** The user clicks a row, or presses Enter or Space on it. */
  onPick: (spell: S) => void;
  /** A row gets the focus, from the arrow keys, a click or Tab. */
  onFocusRow: (spell: S) => void;
  /** True: the Tab stop row has the INITIAL_FOCUS mark, so the dialog gives it the focus at the open. */
  markTabStop: boolean;
  /** The slots on the heading of a level, after its name (ORC-286). */
  headingSlots?: (level: number) => ReactNode;
  /**
   * The mark of each row. With it, each row leaves the space of a box at its left, and Space on a row with a box that
   * can change changes the box: prepare mode of the panel (ORC-287), and the "Add spells" popup (ORC-357).
   */
  marks?: (spell: S) => RowMark;
  /** True when the character has two or more sources (ORC-289): each row has a source tag, and its name has the source. */
  withSource?: boolean;
}

/** The keys that move the focus in the list, and where each goes from row `at` of `count` rows. */
const MOVES: Record<string, (at: number, count: number) => number> = {
  ArrowDown: (at, count) => Math.min(at + 1, count - 1),
  ArrowUp: (at) => Math.max(at - 1, 0),
  Home: () => 0,
  End: (_, count) => count - 1,
};

/**
 * The search field and the groups. The list is one Tab stop: the row of
 * `tabStop`. Up and Down move the focus between the rows, and Home and End
 * go to the first and last row. The headings are not stops.
 */
export function SpellList<S extends ListSpell>({
  groups,
  lookup,
  query,
  onQueryChange,
  selected,
  tabStop,
  onPick,
  onFocusRow,
  markTabStop,
  headingSlots,
  marks,
  withSource = false,
}: SpellListProps<S>) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = MOVES[event.key];
    const row = (event.target as HTMLElement).closest(`[${ROW}]`);
    if (!move || row === null) return;
    event.preventDefault();
    const rows = [...event.currentTarget.querySelectorAll<HTMLElement>(`[${ROW}]`)];
    rows[move(rows.indexOf(row as HTMLElement), rows.length)]?.focus();
  };
  if (lookup === null) return <p role="status">Loading spells…</p>;
  return (
    <>
      {/* The search field scrolls with the list. */}
      <label className="grid gap-1 pt-3 pb-1">
        <Label>Search spells</Label>
        <TextInput width="full" value={query} onValueChange={onQueryChange} />
      </label>
      {groups.length === 0 && query.trim() !== "" && <p className="py-3">No spells match.</p>}
      <div onKeyDown={onKeyDown}>
        {groups.map((group) => (
          <LevelGroup
            key={group.level}
            group={group}
            lookup={lookup}
            selected={selected}
            tabStop={tabStop}
            onPick={onPick}
            onFocusRow={onFocusRow}
            markTabStop={markTabStop}
            headingSlots={headingSlots}
            marks={marks}
            withSource={withSource}
          />
        ))}
      </div>
    </>
  );
}

/** A level: its heading, which sticks at the top of the list while the group scrolls, and its rows. */
function LevelGroup<S extends ListSpell>({
  group,
  lookup,
  selected,
  tabStop,
  onPick,
  onFocusRow,
  markTabStop,
  headingSlots,
  marks,
  withSource = false,
}: Omit<SpellListProps<S>, "groups" | "query" | "onQueryChange" | "lookup"> & { group: SpellGroup<S>; lookup: SpellLookup }) {
  const headingId = useId();
  return (
    <div role="group" aria-labelledby={headingId} {...{ [LEVEL]: group.level }}>
      {/* The heading row holds the slots of the level, above the boxes of the rows that scroll under it. The slot controls handle their own arrow keys: the list moves the focus only from a row. */}
      <div
        {...{ [HEADING]: "" }}
        className="sticky top-0 z-[2] flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b-[1.5px] border-ink bg-paper pt-3.5 pb-[5px]"
      >
        <h3 id={headingId} className="text-xl leading-[1.2] font-semibold">
          {levelHeading(group.level)}
        </h3>
        {group.level > 0 && headingSlots?.(group.level)}
      </div>
      {group.spells.length > 0 && (
        // role="list": without bullets, Safari does not name a ul as a list.
        <ul role="list">
          {group.spells.map((spell) => {
            const id = spellId(spell);
            const mark = marks ? marks(spell) : null;
            return (
              <li key={id} className={mark ? "relative" : undefined}>
                {mark?.kind === "box" && <RowCheckbox box={mark.box} onInk={id === selected} />}
                {mark?.kind === "locked" && (
                  <span aria-hidden="true" className={`absolute top-[11px] left-1.5 z-[1] flex ${id === selected ? "text-paper" : "text-ink-muted"}`}>
                    <LockIcon />
                  </span>
                )}
                <Row
                  spell={spell}
                  lookup={lookup}
                  selected={id === selected}
                  tabStop={id === tabStop}
                  onPick={onPick}
                  onFocusRow={onFocusRow}
                  initial={markTabStop && id === tabStop}
                  mark={mark}
                  withSource={withSource}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * The box of a row, at the left of the row, over its padding: in prepare mode a filled box is a prepared spell, and
 * the box of an always-prepared spell is filled and cannot change. The tap area is 28px. On the ink fill of the
 * selected row the box is paper. A description of the box is hidden text.
 */
function RowCheckbox({ box, onInk }: { box: RowBox; onInk: boolean }) {
  const descriptionId = useId();
  return (
    // The mouse down does not move the focus, so the focus stays on the list or where it was.
    <span className="absolute top-[11px] left-1.5 z-[1] flex" onMouseDown={(event) => event.preventDefault()}>
      <Checkbox
        aria-label={box.name}
        aria-describedby={box.description ? descriptionId : undefined}
        checked={box.checked}
        disabled={box.disabled}
        tabIndex={-1}
        onCheckedChange={box.onChange}
        // The tap area: 28px. The inset is from the inner edge of the 1.5px border of the 14px box.
        className={`relative before:absolute before:-inset-[8.5px] before:content-[''] ${onInk ? "border-paper [&_.ui-check-mark]:bg-paper" : ""}`}
      />
      {box.description && (
        <span id={descriptionId} hidden>
          {box.description}
        </span>
      )}
    </span>
  );
}

/**
 * The small Inter caps of the words on a row with no box: the prepare labels and the source tag. Each adds its
 * weight: a prepare label is semibold, as the box tags are, and the source tag is medium, so it reads as part of
 * the name and not as a state.
 */
const ROW_CAPS = "font-sans text-[10px] leading-[1.6] tracking-[0.06em] whitespace-nowrap uppercase";

/** A label of a row with a mark, in Inter caps with no box: "Known", or the lock and "Always prepared". */
function RowLabel({ onInk, children }: { onInk: boolean; children: ReactNode }) {
  return (
    <span aria-hidden="true" className={`inline-flex items-center gap-[5px] font-semibold ${ROW_CAPS} ${onInk ? "text-paper" : "text-ink-muted"}`}>
      {children}
    </span>
  );
}

/**
 * A small source tag in words after the name of a row, in Inter caps with no
 * box: "CLERIC" (ORC-289). A no-break space keeps it on the line of the last
 * word of the name.
 */
function SourceTag({ onInk, children }: { onInk: boolean; children: ReactNode }) {
  return (
    <>
      {"\u00a0"}
      <span className={`ml-1 font-medium ${ROW_CAPS} ${onInk ? "text-paper" : "text-ink-muted"}`}>{children}</span>
    </>
  );
}

/**
 * A row: a button with the spell name, its cast note in muted text and, with
 * `withSource`, the source tag; then the Ritual tag and the boxed "C" of
 * concentration. The selected row has the ink fill, and its focus ring is a
 * paper outline. A long name wraps inside the row. With a `mark` the row
 * leaves space for the box, has the label of the mark, for example "Known" or
 * "Always prepared", and its name ends with the state of the mark. Space on a
 * row whose box can change changes the box; Enter and a click still select
 * the spell. A locked row has a dimmed name and its reason as its description.
 */
function Row<S extends ListSpell>({
  spell,
  lookup,
  selected,
  tabStop,
  onPick,
  onFocusRow,
  initial,
  mark,
  withSource,
}: {
  spell: S;
  lookup: SpellLookup;
  selected: boolean;
  tabStop: boolean;
  onPick: (spell: S) => void;
  onFocusRow: (spell: S) => void;
  initial: boolean;
  mark: RowMark | null;
  withSource: boolean;
}) {
  const reasonId = useId();
  const record = lookup(spell.key)?.record;
  const concentration = record?.duration ? durationParts(record.duration).concentration : false;
  const locked = mark?.kind === "locked" ? mark.reason : undefined;
  const box = mark?.kind === "box" ? mark.box : undefined;
  const label = mark?.kind === "locked" ? undefined : mark?.label;
  // A locked row is described by its reason, and a row whose box is disabled by the reason of the box.
  const description = locked ?? box?.description;
  const name = [spell.name, spell.castNote, withSource && spell.source, mark?.state].filter(Boolean).join(", ");
  // Space changes the box, and does not click the row: the key down and the key up are both stopped.
  const onSpace = (event: KeyboardEvent<HTMLButtonElement>, down: boolean) => {
    if (!box || box.disabled || event.key !== " ") return;
    event.preventDefault();
    if (down && !event.repeat) box.onChange(!box.checked);
  };
  return (
    // The package row: the panel fill under a mouse, and the ink fill and a paper focus ring while it is current.
    <ListRow
      {...{ [ROW]: spellId(spell), [INITIAL_FOCUS]: initial ? "" : undefined }}
      tabIndex={tabStop ? 0 : -1}
      aria-current={selected ? "true" : undefined}
      aria-describedby={description ? reasonId : undefined}
      onClick={() => onPick(spell)}
      onFocus={() => onFocusRow(spell)}
      onKeyDown={(event) => onSpace(event, true)}
      onKeyUp={(event) => onSpace(event, false)}
      // The name has the cast note, the source when the tag shows, and with a mark its state, after the spell name.
      // A hidden text in the row would get a space before its comma in some browsers, so the name is given whole:
      // "Bless, Cleric, always prepared Concentration".
      aria-label={name === spell.name ? undefined : [name, record?.ritual && "Ritual", concentration && "Concentration"].filter(Boolean).join(" ")}
      className={`gap-x-2 py-[5px] pr-1.5 ${mark ? "pl-[30px]" : "pl-1.5"}`}
    >
      <span className={`min-w-0 [overflow-wrap:anywhere] ${locked !== undefined && !selected ? "text-ink-muted" : ""}`}>
        {spell.name}
        {spell.castNote && <span className={selected ? "text-paper" : "text-ink-muted"}> {spell.castNote}</span>}
        {withSource && <SourceTag onInk={selected}>{spell.source}</SourceTag>}
        {description && (
          <span id={reasonId} hidden>
            {description}
          </span>
        )}
      </span>
      <RowTags label={label} ritual={record?.ritual ?? false} concentration={concentration} onInk={selected} />
    </ListRow>
  );
}

/** The end of a row: the label of its mark, the Ritual tag and the boxed "C" of concentration. Nothing when it has none. */
function RowTags({ label, ritual, concentration, onInk }: { label: MarkWords["label"]; ritual: boolean; concentration: boolean; onInk: boolean }) {
  if (!ritual && !concentration && !label) return null;
  return (
    <span className="flex items-center gap-1">
      {label && (
        <RowLabel onInk={onInk}>
          {label.lock && <LockIcon />}
          {label.text}
        </RowLabel>
      )}
      {ritual && <BoxTag onInk={onInk}>Ritual</BoxTag>}
      {concentration && (
        <BoxTag onInk={onInk} label="Concentration">
          C
        </BoxTag>
      )}
    </span>
  );
}
