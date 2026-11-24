// The Spells panel (ORC-285, docs/design/spells-panel.md "The panel"): a
// wide Dialog over the sheet, with a header, a bar and two panes. The list of
// spells by level is on the left, and the spell view of the selected spell
// is on the right. The Spell slots block (ORC-286, "Spent spell slots") is
// above the list and does not scroll with it; the level headings of the list
// have the slots of their level too. At 600px and less the panel fills the
// screen, and the list and the spell view are two views, with the block at
// the top of each.
//
// The prepare bar (ORC-287, "Preparing spells") has the prepare count of each
// class that prepares and the "Prepare spells" button. In prepare mode the
// list also shows the spells that a class can prepare and has not prepared,
// and the rows have their boxes. The spell view gets the prepare line.
//
// With two or more sources (ORC-289, "The header" and "The list"), the header
// has a line of numbers for each source, and each row has a source tag. A
// spell that two sources give is two rows, and each row prepares apart.
//
// A failed save (ORC-290, "A failed save") shows the alert note of the shell
// under the header, with a "Try again" button. The sheet behind the panel
// shows the same note.
import { Button, Checkbox, Dialog, FramedBox, Label, LockIcon, PixelIcon } from "@orc-alchemy/ui";
import { type ReactNode, type RefObject, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "react-router";
import { bonusStr, type PrepareSpell, type Sheet, type Spellcasting, type SpellRef, type SpendSlots } from "../engine/sheet.ts";
import {
  type ListedSpell,
  type SourceNumbers,
  searchSpellGroups,
  sourceNumbers,
  spellClassLine,
  spellGroups,
  spellId,
  spellSources,
} from "../engine/spell-list.ts";
import { hasPrepareBox, type PrepareCount, prepareCounts, prepareCountText, prepareKind } from "../engine/spell-prepare.ts";
import { flushAutosave } from "../state/character.ts";
import { useSpellLookup } from "../state/spell-records.ts";
import { useSpellSlotsFolded } from "../state/spell-slots-fold.ts";
import { PrepareCountText } from "./PrepareCount.tsx";
import { SaveFailedNote, useSaveFailed } from "./SaveFailedNote.tsx";
import { HEADING, INITIAL_FOCUS, LEVEL, ROW, SpellList } from "./SpellList.tsx";
import { HeadingSlots, SpellSlotsBlock } from "./SpellSlots.tsx";
import { SpellView } from "./SpellView.tsx";

export interface SpellsPanelProps {
  open: boolean;
  /** Gets false from the X, Escape and a click outside. */
  onOpenChange: (open: boolean) => void;
  spellcasting: Spellcasting;
  classes: Sheet["classes"];
  /** The spell to open the panel at; undefined opens it at the top of the list. */
  at?: SpellRef;
  /** The link to the Spells step of the builder. */
  builderHref: string;
  /** The user changes the spent slots of a group. The sheet uses the same handler, so the two show the same state (ORC-286). */
  onSpendSlots: SpendSlots;
  /** The user prepares a spell, or stops preparing it. The change saves as a sheet change, and the sheet shows it (ORC-287). */
  onPrepare: PrepareSpell;
}

/** The attribute that marks the "Back to the list" button of the spell view on a phone. */
const BACK = "data-spells-back";
// The least scroll padding of the list in px. It is the value of the class scroll-pt-12 on the list: keep the two the same.
const MIN_SCROLL_PADDING_PX = 48;

/** How long the message of the live region waits at an open in the spell view. */
const OPEN_MESSAGE_DELAY_MS = 150;

/** A jump to a level does not scroll smoothly under this query. */
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** The width at and under which the panel fills the screen and shows one view at a time, as the Dialog does. */
const PHONE = "(max-width: 600px)";

const subscribePhone = (change: () => void) => {
  const query = window.matchMedia?.(PHONE);
  query?.addEventListener("change", change);
  return () => query?.removeEventListener("change", change);
};
/** True at 600px and less. jsdom has no matchMedia: there it is false. */
const usePhone = () => useSyncExternalStore(subscribePhone, () => window.matchMedia?.(PHONE).matches ?? false);

/**
 * The Spells panel. The X, Escape and a click outside close it, and the
 * focus then goes back to the control that opened it. At the open, the
 * selected row has the focus: the spell of `at`, or else the first spell. On
 * a phone, a panel opened at a spell shows its spell view, and the "Back to
 * the list" button has the focus. The panel is not in the URL.
 */
export function SpellsPanel({ open, onOpenChange, spellcasting, classes, at, builderHref, onSpendSlots, onPrepare }: SpellsPanelProps) {
  // The two panes, so the initial focus is found in this panel only.
  const panes = useRef<HTMLDivElement>(null);
  // With two or more sources the header has a line of numbers for each, and each row has a source tag.
  const sources = spellSources(spellcasting);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="wide"
      fill
      footer={false}
      title="Spells"
      header={<PanelHeader spellcasting={spellcasting} classes={classes} sources={sources} />}
      initialFocus={() => panes.current?.querySelector<HTMLElement>(`[${INITIAL_FOCUS}]`) ?? null}
    >
      <PanelBody
        spellcasting={spellcasting}
        classes={classes}
        withSource={sources.length > 1}
        at={at}
        builderHref={builderHref}
        panes={panes}
        onSpendSlots={onSpendSlots}
        onPrepare={onPrepare}
      />
    </Dialog>
  );
}

/**
 * The header: "Spells", the class and level of each class that gives
 * spells, and with one source the Save DC, Attack and Ability boxes. With
 * two or more sources it has one line of numbers for each source in place of
 * the boxes (ORC-289), a cantrip-only race or feat included.
 */
function PanelHeader({ spellcasting, classes, sources }: { spellcasting: Spellcasting; classes: Sheet["classes"]; sources: string[] }) {
  const classLine = spellClassLine(classes, spellcasting);
  const caster = sources.length === 1 ? spellcasting.casters.find((c) => c.name === sources[0]) : undefined;
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
      {/* The title keeps its width: when the boxes do not fit beside it, they go on the next line. */}
      <div className="min-w-fit flex-1">
        <h2 className="text-[26px] leading-[1.1] font-semibold">Spells</h2>
        {classLine && <p className="font-sans text-[13px] text-ink-muted">{classLine}</p>}
      </div>
      {caster && (
        <div className="flex gap-2">
          <HeaderBox label="Save DC" name="Spell save DC">
            {caster.saveDc}
          </HeaderBox>
          <HeaderBox label="Attack" name="Spell attack">
            {bonusStr(caster.attackBonus)}
          </HeaderBox>
          <HeaderBox label="Ability" name="Spellcasting ability">
            {caster.ability.toUpperCase()}
          </HeaderBox>
        </div>
      )}
      {sources.length > 1 && <SourceLines lines={sourceNumbers(classes, spellcasting)} />}
    </div>
  );
}

/**
 * The lines of numbers of the header, one for each source, in a grid with
 * the short labels above the columns: the source name, then the save DC,
 * the attack bonus and the ability. Each line is a group named by its
 * source, and each number a group with its full name, so a screen reader
 * reads "Cleric", then "Spell save DC 12". The column labels are hidden from
 * it. A source with no caster shows only its ability.
 */
function SourceLines({ lines }: { lines: SourceNumbers[] }) {
  return (
    <div className="grid grid-cols-[auto_repeat(3,auto)] items-baseline gap-x-4 gap-y-0.5 font-sans max-[600px]:gap-x-3">
      <div aria-hidden className="col-span-4 grid grid-cols-subgrid border-b border-rule-strong pb-0.5 [&>span]:text-right">
        <span />
        <Label>Save DC</Label>
        <Label>Attack</Label>
        <Label>Ability</Label>
      </div>
      {lines.map((line) => (
        <div key={line.name} role="group" aria-label={line.name} className="col-span-4 grid grid-cols-subgrid items-baseline">
          <span aria-hidden className="text-[13px] text-ink-muted">
            {line.name}
          </span>
          <LineNumber name="Spell save DC">{line.saveDc}</LineNumber>
          <LineNumber name="Spell attack">{line.attackBonus === null ? null : bonusStr(line.attackBonus)}</LineNumber>
          <LineNumber name="Spellcasting ability">{line.ability.toUpperCase()}</LineNumber>
        </div>
      ))}
    </div>
  );
}

/** A number of a source line, as a group with its full name; an empty cell when the source has no such number. */
function LineNumber({ name, children }: { name: string; children: ReactNode }) {
  if (children === null) return <span />;
  return (
    <span role="group" aria-label={name} className="text-right text-[15px] leading-[1.3] font-medium tabular-nums">
      {children}
    </span>
  );
}

/**
 * A framed box of the header, with more space above its value than the
 * boxes of the sheet. The value is a group with the full name, so a screen
 * reader reads "Spell save DC 15", and not the short label as well.
 */
function HeaderBox({ label, name, children }: { label: string; name: string; children: ReactNode }) {
  const id = useId();
  return (
    <FramedBox
      label={<span aria-hidden>{label}</span>}
      labelId={id}
      className="min-w-[60px] gap-1 px-2.5 pt-3 pb-1 text-center max-[600px]:min-w-0 max-[600px]:px-1.5"
    >
      <span role="group" aria-label={name} className="text-[19px] leading-[1.15] font-medium tabular-nums">
        {children}
      </span>
    </FramedBox>
  );
}

/**
 * A prepare count of the panel (PrepareCountText). At the limit it shows only
 * in prepare mode.
 */
function CountText({ count, withClass, prepareMode }: { count: PrepareCount; withClass: boolean; prepareMode: boolean }) {
  if (count.state === "at" && !prepareMode) return null;
  return <PrepareCountText count={count} withClass={withClass} />;
}

/**
 * The prepare line of the spell view: for a spell that the user can
 * prepare, the box with "Prepared" or "Not prepared" and the prepare count of
 * its class; for an always-prepared spell, the lock and "Always prepared. It
 * does not count." It works outside prepare mode too. A cantrip and a known
 * spell have no line.
 */
function PrepareLine({
  spell,
  kind,
  count,
  withClass,
  prepareMode,
  onPrepare,
}: {
  spell: ListedSpell;
  kind: "can-change" | "always";
  count: PrepareCount | undefined;
  withClass: boolean;
  prepareMode: boolean;
  onPrepare: PrepareSpell;
}) {
  if (kind === "always")
    return (
      <p className="flex items-center gap-2.5 font-sans text-[13.5px] text-ink-muted">
        <LockIcon />
        Always prepared. It does not count.
      </p>
    );
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-sans text-[13.5px]">
      <Checkbox
        label={spell.prepared ? "Prepared" : "Not prepared"}
        name="Prepared"
        checked={spell.prepared}
        onCheckedChange={(on) => onPrepare(spell, on)}
        className="gap-2.5"
      />
      {count && <CountText count={count} withClass={withClass} prepareMode={prepareMode} />}
    </div>
  );
}

/**
 * The bar and the two panes. The state is new at each open, because the
 * Dialog mounts its body at the open: a close ends prepare mode.
 */
function PanelBody({
  spellcasting,
  classes,
  withSource,
  at,
  builderHref,
  panes,
  onSpendSlots,
  onPrepare,
}: {
  spellcasting: Spellcasting;
  classes: Sheet["classes"];
  /** True with two or more sources: each row has a source tag. */
  withSource: boolean;
  at: SpellRef | undefined;
  builderHref: string;
  panes: RefObject<HTMLDivElement>;
  onSpendSlots: SpendSlots;
  onPrepare: PrepareSpell;
}) {
  const lookup = useSpellLookup();
  const loaded = lookup !== null;
  const phone = usePhone();
  const [prepareMode, setPrepareMode] = useState(false);
  // In the order of the class line of the header.
  const counts = prepareCounts(spellcasting, classes);
  // With two classes that prepare, each count has the class name first.
  const withClass = counts.length > 1;
  const all = spellGroups(spellcasting, lookup, { unprepared: prepareMode });
  const spells = all.flatMap((group) => group.spells);
  const [query, setQuery] = useState("");
  const groups = searchSpellGroups(all, query);
  const shown = groups.flatMap((group) => group.spells);
  // Until the user picks a spell, the selected spell is the one of `at`, or else the first. The spell view keeps a
  // picked spell that leaves the list, as it does after a search: for example a spell that the user stops preparing
  // outside prepare mode, or after "Done".
  const selectable = prepareMode ? spells : spellGroups(spellcasting, lookup, { unprepared: true }).flatMap((group) => group.spells);
  const [picked, setPicked] = useState<string | null>(null);
  const atId = at && spells.some((spell) => spellId(spell) === spellId(at)) ? spellId(at) : null;
  const pickedId = picked !== null && selectable.some((spell) => spellId(spell) === picked) ? picked : null;
  const selectedId = pickedId ?? atId ?? (spells[0] ? spellId(spells[0]) : null);
  const selected = selectable.find((spell) => spellId(spell) === selectedId) ?? null;
  const selectedKind = selected && prepareKind(selected, spellcasting.casters);
  const [focused, setFocused] = useState<string | null>(null);
  const isShown = (id: string | null) => id !== null && shown.some((spell) => spellId(spell) === id);
  const tabStop = isShown(focused) ? focused : isShown(selectedId) ? selectedId : shown[0] ? spellId(shown[0]) : null;
  // On a phone the list and the spell view are two views. A panel opened at a spell shows its spell view.
  const [view, setView] = useState<"list" | "spell">(phone && atId !== null ? "spell" : "list");
  const spellView = phone && view === "spell";
  // The live region. `count` changes with each new message, so the same name is said again.
  const [announce, setAnnounce] = useState({ text: "", count: 0 });
  const say = (text: string) => setAnnounce((last) => ({ text, count: last.count + 1 }));
  // A change of a prepare count goes in the live region, with the class name: "Cleric: 9 of 8 prepared. Remove 1 spell."
  const countTexts = counts.map((count) => prepareCountText(count, true));
  const lastCounts = useRef(countTexts);
  useEffect(() => {
    const changed = countTexts.find((text, i) => text !== lastCounts.current[i]);
    lastCounts.current = countTexts;
    if (changed) say(changed);
  }, [countTexts.join("\n")]);
  const list = useRef<HTMLDivElement>(null);
  // The scroll position of the list when a tap opened the spell view; null when the panel opened in the spell view.
  const listTop = useRef<number | null>(null);
  const back = () => panes.current?.querySelector<HTMLElement>(`[${BACK}]`) ?? null;
  // The bar, whose first control is the fallback of the focus while the spells load.
  const bar = useRef<HTMLDivElement>(null);
  // While the Spell slots block is open, only its groups are Tab stops; while it is folded, the groups on the headings are.
  const [folded, setFolded] = useSpellSlotsFolded();
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
  const prepare: PrepareSpell = (spell, on) => {
    if (picked === null && selectedId !== null) setPicked(selectedId);
    onPrepare(spell, on);
  };

  const select = (spell: ListedSpell) => {
    if (spellId(spell) === selectedId) return;
    setPicked(spellId(spell));
    // On a phone the spell view says the name when it opens (below).
    if (!phone) say(spell.name);
  };
  const onPick = (spell: ListedSpell) => {
    select(spell);
    if (!phone) return;
    listTop.current = list.current?.scrollTop ?? 0;
    setView("spell");
  };
  // At more than 600px, the row with the focus is the selected row, so the spell view follows the arrow keys.
  const onFocusRow = (spell: ListedSpell) => {
    setFocused(spellId(spell));
    if (!phone) select(spell);
  };

  // The selected row scrolls into view at the open, when the spells load, after a search, and after "Prepare spells"
  // or "Done", if it is in the list. jsdom has no scrollIntoView.
  const rowOf = (id: string | null) => (id === null ? null : (list.current?.querySelector<HTMLElement>(`[${ROW}="${CSS.escape(id)}"]`) ?? null));
  useLayoutEffect(() => {
    if (!spellView) rowOf(selectedId)?.scrollIntoView?.({ block: "nearest" });
    // Only these changes scroll: an arrow key or a click scrolls by itself.
  }, [loaded, query, prepareMode]);
  // While the spells load, the dialog gives the focus to its fallback: the first control of the body, the "Prepare
  // spells" button or else the builder link (or the popup on a touch screen). When the spells show, the selected row
  // gets the focus, but only while the user has not moved it, for example to the X.
  const waitsForRows = useRef(!loaded);
  useLayoutEffect(() => {
    if (!loaded || !waitsForRows.current) return;
    waitsForRows.current = false;
    if (spellView && selected) say(selected.name);
    // The focus is still on the fallback only when it is on the first control of the bar or on the popup itself.
    const active = document.activeElement;
    const onFallback = (active !== null && active === bar.current?.querySelector("a, button")) || active?.closest('[role="dialog"]') === active;
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

  // The note of a failed save. "Try again" saves again; a save that works removes the note.
  const saveFailed = useSaveFailed();
  const note = useRef<HTMLDivElement>(null);
  // The last element of the panel with the focus outside the note: the control that made the change, as a rule.
  const lastFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const dialog = bar.current?.closest('[role="dialog"]');
    const onFocusIn = (event: Event) => {
      if (event.target instanceof HTMLElement && !note.current?.contains(event.target)) lastFocus.current = event.target;
    };
    dialog?.addEventListener("focusin", onFocusIn);
    return () => dialog?.removeEventListener("focusin", onFocusIn);
  }, []);
  // When the note goes with the focus on its button, the focus goes back to that element, or else to the selected row
  // (on a phone in the spell view, to "Back to the list"), or else to the first control of the bar. This runs before
  // the paint, so the focus does not go to the document.
  const wasSaveFailed = useRef(saveFailed);
  useLayoutEffect(() => {
    const removed = wasSaveFailed.current && !saveFailed;
    wasSaveFailed.current = saveFailed;
    const active = document.activeElement;
    if (!removed || (active !== null && active !== document.body)) return;
    const last = lastFocus.current;
    const target =
      last?.isConnected && !last.closest("[hidden]") ? last : ((spellView ? back() : rowOf(tabStop)) ?? bar.current?.querySelector<HTMLElement>("a, button"));
    target?.focus({ preventScroll: true });
  }, [saveFailed]);

  return (
    <>
      {saveFailed && (
        <div ref={note} className="flex-none bg-panel px-[18px] pt-2.5 max-[600px]:px-4">
          <SaveFailedNote onRetry={() => flushAutosave().catch(console.error)} />
        </div>
      )}
      {/* The prepare bar: the count of each class that prepares and the button on the left, the builder link on the right. */}
      <div ref={bar} className="flex flex-none flex-wrap items-center gap-x-4 gap-y-1 bg-panel px-[18px] py-2 font-sans text-[13px] max-[600px]:px-4">
        {counts.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {counts.map((count) => (
              <CountText key={count.className} count={count} withClass={withClass} prepareMode={prepareMode} />
            ))}
            {/* One button that changes its label. It has no pressed state. */}
            <Button size="small" icon={prepareMode ? "check" : "sparkles"} onClick={() => setPrepareMode((on) => !on)}>
              {prepareMode ? "Done" : "Prepare spells"}
            </Button>
          </div>
        )}
        <Link to={builderHref} className="ml-auto underline underline-offset-2">
          <PixelIcon name="pencil" />
          Change known spells in the builder
        </Link>
      </div>
      {/* The Spell slots block is above the list and does not scroll with it. On a phone it is at the top of the two views. */}
      <div
        ref={panes}
        className="grid min-h-0 flex-1 grid-cols-[minmax(240px,340px)_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] max-[600px]:grid-cols-[minmax(0,1fr)]"
      >
        <div className="col-start-1 row-start-1 min-w-0 border-r empty:hidden border-rule-strong pt-3 pr-4 pl-[18px] max-[600px]:border-r-0 max-[600px]:px-4 max-[600px]:pt-2.5">
          <SpellSlotsBlock
            spellcasting={spellcasting}
            onSpendSlots={onSpendSlots}
            folded={folded}
            onFoldedChange={setFolded}
            onGoTo={spellView ? null : goTo}
            shownLevels={shownLevels}
          />
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
            headingSlots={(level) => <HeadingSlots spellcasting={spellcasting} level={level} onSpendSlots={onSpendSlots} copy={!folded} />}
            prepareMode={prepareMode}
            kindOf={(spell) => prepareKind(spell, spellcasting.casters)}
            onPrepare={prepare}
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
            <Button variant="link" {...{ [BACK]: "", [INITIAL_FOCUS]: "" }} className="mb-3 font-sans text-[13px]" onClick={() => setView("list")}>
              Back to the list
            </Button>
          )}
          {/* While the spell chunk loads there is no record yet, so the view waits: it would say "no text". */}
          {!loaded ? (
            spellView && <p className="text-ink-muted">Loading spells…</p>
          ) : selected ? (
            <SpellView name={selected.name} spell={lookup(selected.key)} castNote={selected.castNote}>
              {selectedKind && hasPrepareBox(selectedKind) && (
                <PrepareLine
                  spell={selected}
                  kind={selectedKind}
                  count={counts.find((count) => count.className === selected.source)}
                  withClass={withClass}
                  prepareMode={prepareMode}
                  onPrepare={prepare}
                />
              )}
            </SpellView>
          ) : (
            <p className="text-ink-muted">Select a spell to read it.</p>
          )}
        </div>
      </div>
      {/* The name of a new selected spell, and a new prepare count, for a screen reader. */}
      <p aria-live="polite" className="sr-only">
        {/* A no-break space on every second message makes the same name a new message. */}
        {announce.text}
        {announce.count > 0 && announce.count % 2 === 0 && "\u00a0"}
      </p>
    </>
  );
}
