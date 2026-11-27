// The two panes of a list of spells and a spell view (docs/design/spells-panel.md "The list", "The spell view", "On a
// phone" and "Keyboard and screen reader"), as one part. The Spells panel of the sheet (ORC-285) and the "Add spells"
// popup of the Spells step of the builder (ORC-357) show them in a wide Dialog with `fill`: the list of spells by level
// is on the left, and the spell view of the selected spell is on the right. At 600px and less the list and the spell
// view are two views. The owner gives the groups, the marks of the rows, the spell view and, above the list, a block
// that does not scroll with it, for example the Spell slots block of the panel.
//
// The part keeps the selected spell, the Tab stop of the list, the view on a phone, the scroll padding of the list and
// the live region, which says the name of a new selected spell and each new message of the owner, for example a new
// prepare count.
import { Button } from "@orc-alchemy/ui";
import { type ReactNode, type Ref, type RefObject, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { SpellRef } from "../engine/sheet.ts";
import { type ListSpell, type SpellGroup, searchSpellGroups, spellId } from "../engine/spell-list.ts";
import type { SpellLookup, SpellRecordResult } from "../engine/spell-records.ts";
import { HEADING, INITIAL_FOCUS, LEVEL, ROW, type RowMark, SpellList } from "./SpellList.tsx";

/** The attribute that marks the "Back to the list" button of the spell view on a phone. */
const BACK = "data-spells-back";
// The least scroll padding of the list in px. It is the value of the class scroll-pt-12 on the list: keep the two the same.
const MIN_SCROLL_PADDING_PX = 48;

/** How long the message of the live region waits at an open in the spell view. */
const OPEN_MESSAGE_DELAY_MS = 150;

/** A jump to a level does not scroll smoothly under this query. */
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** The width at and under which the panes show one view at a time, as the Dialog fills the screen. */
const PHONE = "(max-width: 600px)";

const subscribePhone = (change: () => void) => {
  const query = window.matchMedia?.(PHONE);
  query?.addEventListener("change", change);
  return () => query?.removeEventListener("change", change);
};
/** True at 600px and less. jsdom has no matchMedia: there it is false. */
const usePhone = () => useSyncExternalStore(subscribePhone, () => window.matchMedia?.(PHONE).matches ?? false);

/** What the spell view of the owner gets with the selected spell. */
export interface SpellViewContext {
  /** The record of the spell, or undefined when it has none. */
  record: SpellRecordResult | undefined;
  /** True at 600px and less. */
  phone: boolean;
  /**
   * The mark of the selected spell (`marks`), or undefined without marks. A change of its box keeps the selected
   * spell, as a change of the box of its row does.
   */
  mark: RowMark | undefined;
  /**
   * A change that keeps the selected spell first: give it a change that can take the spell out of the list, for
   * example the change of a box that is not the box of a mark.
   */
  kept: <A extends unknown[]>(change: (...args: A) => void) => (...args: A) => void;
}

/** What the block above the list gets. */
export interface TopContext {
  /** Scrolls the list to the heading of the level; null while the spell view shows on a phone. */
  goTo: ((level: number) => void) | null;
  /** The levels that the list shows after the search. */
  shownLevels: Set<number>;
}

/** What the owner can ask of the panes. */
export interface SpellPanesHandle {
  /** The element that has the focus in the panes when nothing else has it: the Tab stop row, or "Back to the list" in the spell view. */
  focusTarget: () => HTMLElement | null;
}

export interface SpellPanesProps<S extends ListSpell> {
  /** The groups of the list, before the search. */
  groups: SpellGroup<S>[];
  /**
   * The spells that the spell view keeps when the user picked one and it leaves the list, as after a search. By
   * default, the spells of `groups`.
   */
  selectable?: S[];
  /** Null while the spell chunk loads. */
  lookup: SpellLookup | null;
  /** The spell to open at; undefined opens at the top of the list. */
  at?: SpellRef;
  /** The element of the two panes, where the Dialog finds the initial focus (INITIAL_FOCUS). */
  panes: RefObject<HTMLDivElement>;
  /** The first control of the body, which has the focus while the spells load: when they show, the selected row gets it. */
  fallback: () => Element | null | undefined;
  handle?: Ref<SpellPanesHandle>;
  /** The block above the list, which does not scroll with it. On a phone it is at the top of the two views. */
  top?: (context: TopContext) => ReactNode;
  /** The slots on the heading of a level, after its name. */
  headingSlots?: (level: number) => ReactNode;
  /** The mark of each row (see SpellList): with it, each row has the space of a box at its left. */
  marks?: (spell: S) => RowMark;
  /** True with two or more sources: each row has a source tag. */
  withSource?: boolean;
  /** The spell view of the selected spell. */
  view: (spell: S, context: SpellViewContext) => ReactNode;
  /** The messages of the owner: a message that changes goes in the live region, for example a new prepare count. */
  messages?: string[];
  /** A value whose change scrolls the selected row into view, as a search does, for example prepare mode. */
  scrollKey?: unknown;
}

/** Whether `list` has the spell of `id`. */
const hasId = (list: ListSpell[], id: string | null) => id !== null && list.some((spell) => spellId(spell) === id);

/**
 * The id of `at` when the list has it; the selected id: the picked spell while it can be selected, else `at`, else
 * the first spell; and the selected spell, null when that id cannot be selected.
 */
function selection<S extends ListSpell>(spells: S[], selectable: S[], at: SpellRef | undefined, picked: string | null) {
  const atId = at && hasId(spells, spellId(at)) ? spellId(at) : null;
  const pickedId = hasId(selectable, picked) ? picked : null;
  const selectedId = pickedId ?? atId ?? (spells[0] ? spellId(spells[0]) : null);
  const selected = selectable.find((spell) => spellId(spell) === selectedId) ?? null;
  return { atId, selectedId, selected };
}

/** The row that Tab goes to: the focused row while it shows, else the selected row while it shows, else the first row. */
function tabStopOf(shown: ListSpell[], focused: string | null, selectedId: string | null): string | null {
  if (hasId(shown, focused)) return focused;
  if (hasId(shown, selectedId)) return selectedId;
  return shown[0] ? spellId(shown[0]) : null;
}

/**
 * The two panes. The state is new at each mount: the Dialog mounts its body at each open. At the open, the selected
 * row has the focus: the spell of `at`, or else the first spell. On a phone, an open at a spell shows its spell view,
 * and the "Back to the list" button has the focus.
 */
export function SpellPanes<S extends ListSpell>({
  groups: all,
  selectable: selectableProp,
  lookup,
  at,
  panes,
  fallback,
  handle,
  top,
  headingSlots,
  marks,
  withSource = false,
  view: renderView,
  messages = [],
  scrollKey,
}: SpellPanesProps<S>) {
  const loaded = lookup !== null;
  const phone = usePhone();
  const spells = all.flatMap((group) => group.spells);
  const [query, setQuery] = useState("");
  const groups = searchSpellGroups(all, query);
  const shown = groups.flatMap((group) => group.spells);
  // Until the user picks a spell, the selected spell is the one of `at`, or else the first. The spell view keeps a
  // picked spell that leaves the list, as it does after a search: for example a spell that the user stops preparing
  // outside prepare mode, or after "Done".
  const selectable = selectableProp ?? spells;
  const [picked, setPicked] = useState<string | null>(null);
  const { atId, selectedId, selected } = selection(spells, selectable, at, picked);
  const selectedRecord = selected && lookup ? lookup(selected.key) : undefined;
  const [focused, setFocused] = useState<string | null>(null);
  const tabStop = tabStopOf(shown, focused, selectedId);
  // On a phone the list and the spell view are two views. An open at a spell shows its spell view.
  const [view, setView] = useState<"list" | "spell">(phone && atId !== null ? "spell" : "list");
  const spellView = phone && view === "spell";
  // The live region. `count` changes with each new message, so the same name is said again.
  const [announce, setAnnounce] = useState({ text: "", count: 0 });
  const say = (text: string) => setAnnounce((last) => ({ text, count: last.count + 1 }));
  // A change of a message of the owner goes in the live region.
  const lastMessages = useRef(messages);
  useEffect(() => {
    const changed = messages.find((text, i) => text !== lastMessages.current[i]);
    lastMessages.current = messages;
    if (changed) say(changed);
  }, [messages.join("\n")]);
  const list = useRef<HTMLDivElement>(null);
  // The scroll position of the list when a tap opened the spell view; null when the panes opened in the spell view.
  const listTop = useRef<number | null>(null);
  const back = () => panes.current?.querySelector<HTMLElement>(`[${BACK}]`) ?? null;
  const shownLevels = new Set(groups.map((group) => group.level));
  // The scroll padding of the list is the height of its tallest level heading, so that a row that gets the focus is
  // never under the heading that sticks at the top. A heading with slots can take two lines in a narrow list.
  const headingsKey = groups.map((group) => group.level).join();
  useLayoutEffect(() => {
    const pane = list.current;
    if (!pane || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const tallest = Math.max(
        0,
        ...[...pane.querySelectorAll<HTMLElement>(`[${HEADING}]`)].map((heading) => Math.ceil(heading.getBoundingClientRect().height)),
      );
      pane.style.scrollPaddingTop = tallest > MIN_SCROLL_PADDING_PX ? `${tallest}px` : "";
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const heading of pane.querySelectorAll(`[${HEADING}]`)) observer.observe(heading);
    return () => observer.disconnect();
  }, [headingsKey, loaded, spellView]);
  // A level link scrolls the list so that the level's heading is at the top. The focus stays on the link.
  const goTo = (level: number) => {
    const pane = list.current;
    const group = pane?.querySelector<HTMLElement>(`[${LEVEL}="${level}"]`);
    if (!pane || !group) return;
    const top = pane.scrollTop + group.getBoundingClientRect().top - pane.getBoundingClientRect().top;
    const reduce = window.matchMedia?.(REDUCED_MOTION).matches ?? false;
    // jsdom has no scrollTo on an element.
    pane.scrollTo?.({ top, behavior: reduce ? "instant" : "smooth" });
  };

  // A change of a box keeps the selected spell, also when it was the first spell and the change takes it out of the list.
  const kept =
    <A extends unknown[]>(change: (...args: A) => void) =>
    (...args: A) => {
      if (picked === null && selectedId !== null) setPicked(selectedId);
      change(...args);
    };
  const keptMarks =
    marks &&
    ((spell: S): RowMark => {
      const mark = marks(spell);
      return mark.kind === "box" ? { ...mark, box: { ...mark.box, onChange: kept(mark.box.onChange) } } : mark;
    });

  const select = (spell: S) => {
    if (spellId(spell) === selectedId) return;
    setPicked(spellId(spell));
    // On a phone the spell view says the name when it opens (below).
    if (!phone) say(spell.name);
  };
  const onPick = (spell: S) => {
    select(spell);
    if (!phone) return;
    listTop.current = list.current?.scrollTop ?? 0;
    setView("spell");
  };
  // At more than 600px, the row with the focus is the selected row, so the spell view follows the arrow keys.
  const onFocusRow = (spell: S) => {
    setFocused(spellId(spell));
    if (!phone) select(spell);
  };

  // The selected row scrolls into view at the open, when the spells load, after a search, and after a change of
  // `scrollKey`, if it is in the list. jsdom has no scrollIntoView.
  const rowOf = (id: string | null) => (id === null ? null : (list.current?.querySelector<HTMLElement>(`[${ROW}="${CSS.escape(id)}"]`) ?? null));
  useLayoutEffect(() => {
    if (!spellView) rowOf(selectedId)?.scrollIntoView?.({ block: "nearest" });
    // Only these changes scroll: an arrow key or a click scrolls by itself.
  }, [loaded, query, scrollKey]);
  // While the spells load, the dialog gives the focus to its fallback (or the popup on a touch screen). When the
  // spells show, the selected row gets the focus, but only while the user has not moved it, for example to the X.
  const waitsForRows = useRef(!loaded);
  useLayoutEffect(() => {
    if (!loaded || !waitsForRows.current) return;
    waitsForRows.current = false;
    if (spellView && selected) say(selected.name);
    // The focus is still on the fallback only when it is on the fallback control or on the popup itself.
    const active = document.activeElement;
    const onFallback = (active !== null && active === fallback()) || active?.closest('[role="dialog"]') === active;
    if (onFallback) (spellView ? back() : rowOf(tabStop))?.focus();
  }, [loaded]);
  // On a phone, the "Back to the list" button of a new spell view gets the focus, as its row is hidden, and the
  // live region says the spell name, which the focus on the button does not read. At the open in the spell view the
  // dialog gives the button the focus. Back to the list: the list is at the same scroll position, and the row has
  // the focus. After an open in the spell view there is no position, so the row scrolls into view. This runs before
  // the paint, so the focus does not go to the dialog when the focused button goes.
  const wasSpellView = useRef<boolean | null>(null);
  useLayoutEffect(() => {
    const opened = wasSpellView.current === null;
    if (spellView === wasSpellView.current) return;
    wasSpellView.current = spellView;
    if (spellView) {
      // A live region that has just shown can miss a message, so at the open the message waits a moment. While the
      // spells load the name is not known yet; the effect above says it when they show.
      const name = selected?.name;
      if (!opened) {
        if (name) say(name);
        back()?.focus({ preventScroll: true });
        return;
      }
      if (!loaded || !name) return;
      // A close or a Back in the delay cancels the message.
      const timer = setTimeout(() => say(name), OPEN_MESSAGE_DELAY_MS);
      return () => clearTimeout(timer);
    }
    if (opened) return;
    const row = rowOf(selectedId);
    if (listTop.current === null) row?.scrollIntoView?.({ block: "nearest" });
    else if (list.current) list.current.scrollTop = listTop.current;
    row?.focus({ preventScroll: true });
  }, [spellView]);
  useImperativeHandle(handle, () => ({ focusTarget: () => (spellView ? back() : rowOf(tabStop)) }));

  return (
    <>
      <div
        ref={panes}
        className="grid min-h-0 flex-1 grid-cols-[minmax(240px,340px)_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] max-[600px]:grid-cols-[minmax(0,1fr)]"
      >
        <div className="col-start-1 row-start-1 min-w-0 border-r empty:hidden border-rule-strong pt-3 pr-4 pl-[18px] max-[600px]:border-r-0 max-[600px]:px-4 max-[600px]:pt-2.5">
          {top?.({ goTo: spellView ? null : goTo, shownLevels })}
        </div>
        <div
          ref={list}
          data-pane="list"
          hidden={spellView}
          className="col-start-1 row-start-2 min-h-0 scroll-pt-12 overflow-y-auto border-r border-rule-strong pr-4 pb-10 pl-[18px] max-[600px]:border-r-0 max-[600px]:px-4"
        >
          <SpellList
            groups={groups}
            lookup={lookup}
            query={query}
            onQueryChange={setQuery}
            selected={selectedId}
            tabStop={tabStop}
            onPick={onPick}
            onFocusRow={onFocusRow}
            markTabStop={!spellView}
            headingSlots={headingSlots}
            marks={keptMarks}
            withSource={withSource}
          />
        </div>
        <div
          data-pane="spell"
          hidden={phone && !spellView}
          className="col-start-2 row-span-2 row-start-1 min-h-0 overflow-y-auto pt-[18px] pr-[22px] pb-10 pl-[26px] max-[600px]:col-start-1 max-[600px]:row-span-1 max-[600px]:row-start-2 max-[600px]:px-4"
        >
          {spellView && (
            // The initial focus at an open in the spell view.
            <Button variant="link" icon="left" {...{ [BACK]: "", [INITIAL_FOCUS]: "" }} className="mb-3 font-sans text-[13px]" onClick={() => setView("list")}>
              Back to the list
            </Button>
          )}
          {/* While the spell chunk loads there is no record yet, so the view waits: it would say "no text". */}
          {!loaded ? (
            spellView && <p className="text-ink-muted">Loading spells…</p>
          ) : selected ? (
            renderView(selected, { record: selectedRecord, phone, mark: keptMarks?.(selected), kept })
          ) : (
            <p className="text-ink-muted">Select a spell to read it.</p>
          )}
        </div>
      </div>
      {/* The name of a new selected spell, and a new message of the owner, for a screen reader. */}
      <p aria-live="polite" className="sr-only">
        {/* A no-break space on every second message makes the same name a new message. */}
        {announce.text}
        {announce.count > 0 && announce.count % 2 === 0 && " "}
      </p>
    </>
  );
}
