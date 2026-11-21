// The list of the Spells panel (ORC-285, docs/design/spells-panel.md "The
// list" and "Keyboard and screen reader"): the search field, then one group
// for each level, with a heading that sticks and one row for each spell.
//
// The ARIA pattern is a list of buttons with a roving tabindex, under real
// headings. A listbox does not fit: the level headings get slot controls
// later (ORC-286), and a listbox can hold only options. In prepare mode
// (ORC-287) a row can be a checkbox button with Space, in the same pattern.
import { Button, Label, TextInput } from "@orc-alchemy/ui";
import { type KeyboardEvent, useId } from "react";
import { type ListedSpell, levelHeading, type SpellGroup, spellId } from "../engine/spell-list.ts";
import type { SpellLookup } from "../engine/spell-records.ts";
import { durationParts } from "../engine/spell-text.ts";
import { BoxTag } from "./BoxTag.tsx";

/** The attribute that marks a row button, with the row's id (see `spellId`). */
export const ROW = "data-spell-row";
/** The attribute that marks the element that gets the focus when the panel opens. */
export const INITIAL_FOCUS = "data-spells-focus";

export interface SpellListProps {
  /** The groups to show: after the search, so a group with no match is not in them. */
  groups: SpellGroup[];
  /** Null while the spell chunk loads. */
  lookup: SpellLookup | null;
  query: string;
  onQueryChange: (query: string) => void;
  /** The id of the selected row, or null. */
  selected: string | null;
  /** The id of the row that is the Tab stop of the list. */
  tabStop: string | null;
  /** The user clicks a row, or presses Enter or Space on it. */
  onPick: (spell: ListedSpell) => void;
  /** A row gets the focus, from the arrow keys, a click or Tab. */
  onFocusRow: (spell: ListedSpell) => void;
  /** True: the Tab stop row has the INITIAL_FOCUS mark, so the dialog gives it the focus at the open. */
  markTabStop: boolean;
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
export function SpellList({ groups, lookup, query, onQueryChange, selected, tabStop, onPick, onFocusRow, markTabStop }: SpellListProps) {
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
          />
        ))}
      </div>
    </>
  );
}

/** A level: its heading, which sticks at the top of the list while the group scrolls, and its rows. */
function LevelGroup({
  group,
  lookup,
  selected,
  tabStop,
  onPick,
  onFocusRow,
  markTabStop,
}: Omit<SpellListProps, "groups" | "query" | "onQueryChange" | "lookup"> & { group: SpellGroup; lookup: SpellLookup }) {
  const headingId = useId();
  return (
    <div role="group" aria-labelledby={headingId}>
      {/* The heading row holds the slot circles of the level later (ORC-286). */}
      <div className="sticky top-0 z-[1] flex items-baseline gap-3 border-b-[1.5px] border-ink bg-paper pt-3.5 pb-[5px]">
        <h3 id={headingId} className="text-xl leading-[1.2] font-semibold">
          {levelHeading(group.level)}
        </h3>
      </div>
      {group.spells.length > 0 && (
        // role="list": without bullets, Safari does not name a ul as a list.
        <ul role="list">
          {group.spells.map((spell) => {
            const id = spellId(spell);
            return (
              <li key={id}>
                <Row
                  spell={spell}
                  lookup={lookup}
                  selected={id === selected}
                  tabStop={id === tabStop}
                  onPick={onPick}
                  onFocusRow={onFocusRow}
                  initial={markTabStop && id === tabStop}
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
 * A row: a button with the spell name, then the Ritual tag and the boxed "C"
 * of concentration. The selected row has the ink fill, and its focus ring is
 * a paper outline. A long name wraps inside the row.
 */
function Row({
  spell,
  lookup,
  selected,
  tabStop,
  onPick,
  onFocusRow,
  initial,
}: {
  spell: ListedSpell;
  lookup: SpellLookup;
  selected: boolean;
  tabStop: boolean;
  onPick: (spell: ListedSpell) => void;
  onFocusRow: (spell: ListedSpell) => void;
  initial: boolean;
}) {
  const record = lookup(spell.key)?.record;
  const concentration = record?.duration ? durationParts(record.duration).concentration : false;
  return (
    // The link variant has no box and keeps the font of the list. It also has no fill, so the row sets its own.
    <Button
      variant="link"
      {...{ [ROW]: spellId(spell), [INITIAL_FOCUS]: initial ? "" : undefined }}
      tabIndex={tabStop ? 0 : -1}
      aria-current={selected ? "true" : undefined}
      onClick={() => onPick(spell)}
      onFocus={() => onFocusRow(spell)}
      className={`flex w-full items-center gap-2 border-b border-rule py-[5px] pr-1.5 pl-1.5 text-left no-underline ${
        selected ? "bg-ink text-paper [--focus-ring:var(--paper)] focus-visible:outline-offset-[-4px]" : "hover:bg-panel focus-visible:outline-offset-[-2px]"
      }`}
    >
      <span className="min-w-0 [overflow-wrap:anywhere]">{spell.name}</span>
      {(record?.ritual || concentration) && (
        <span className="ml-auto flex flex-none gap-1">
          {record?.ritual && <BoxTag onInk={selected}>Ritual</BoxTag>}
          {concentration && (
            <BoxTag onInk={selected} label="Concentration">
              C
            </BoxTag>
          )}
        </span>
      )}
    </Button>
  );
}
