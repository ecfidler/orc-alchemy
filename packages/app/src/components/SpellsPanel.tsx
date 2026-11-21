// The Spells panel (ORC-285, docs/design/spells-panel.md "The panel"): a
// wide Dialog over the sheet, with a header, a bar and two panes. The list of
// spells by level is on the left, and the spell view of the selected spell
// is on the right. At 600px and less the panel fills the screen, and the list
// and the spell view are two views.
import { Button, Dialog, FramedBox } from "@orc-alchemy/ui";
import { type ReactNode, type RefObject, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "react-router";
import { bonusStr, type Sheet, type Spellcasting, type SpellRef } from "../engine/sheet.ts";
import { type ListedSpell, searchSpellGroups, spellClassLine, spellGroups, spellId, spellSources } from "../engine/spell-list.ts";
import { useSpellLookup } from "../state/spell-records.ts";
import { INITIAL_FOCUS, ROW, SpellList } from "./SpellList.tsx";
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
}

/** The attribute that marks the "Back to the list" button of the spell view on a phone. */
const BACK = "data-spells-back";

/** How long the message of the live region waits at an open in the spell view. */
const OPEN_MESSAGE_DELAY_MS = 150;

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
export function SpellsPanel({ open, onOpenChange, spellcasting, classes, at, builderHref }: SpellsPanelProps) {
  // The two panes, so the initial focus is found in this panel only.
  const panes = useRef<HTMLDivElement>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="wide"
      fill
      footer={false}
      title="Spells"
      header={<PanelHeader spellcasting={spellcasting} classes={classes} />}
      initialFocus={() => panes.current?.querySelector<HTMLElement>(`[${INITIAL_FOCUS}]`) ?? null}
    >
      <PanelBody spellcasting={spellcasting} at={at} builderHref={builderHref} panes={panes} />
    </Dialog>
  );
}

/**
 * The header: "Spells", the class and level of each class that gives
 * spells, and with one source the Save DC, Attack and Ability boxes. With
 * two or more sources it has only the class line here (ORC-289 adds a line
 * of numbers for each source).
 */
function PanelHeader({ spellcasting, classes }: { spellcasting: Spellcasting; classes: Sheet["classes"] }) {
  const classLine = spellClassLine(classes, spellcasting);
  const sources = spellSources(spellcasting);
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
    </div>
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
 * The bar and the two panes. The state is new at each open, because the
 * Dialog mounts its body at the open.
 */
function PanelBody({
  spellcasting,
  at,
  builderHref,
  panes,
}: {
  spellcasting: Spellcasting;
  at: SpellRef | undefined;
  builderHref: string;
  panes: RefObject<HTMLDivElement>;
}) {
  const lookup = useSpellLookup();
  const phone = usePhone();
  const all = spellGroups(spellcasting, lookup);
  const spells = all.flatMap((group) => group.spells);
  const [query, setQuery] = useState("");
  const groups = searchSpellGroups(all, query);
  const shown = groups.flatMap((group) => group.spells);
  // Until the user picks a spell, the selected spell is the one of `at`, or else the first.
  const [picked, setPicked] = useState<string | null>(null);
  const atId = at && spells.some((spell) => spellId(spell) === spellId(at)) ? spellId(at) : null;
  const selectedId = picked ?? atId ?? (spells[0] ? spellId(spells[0]) : null);
  const selected = spells.find((spell) => spellId(spell) === selectedId) ?? null;
  const [focused, setFocused] = useState<string | null>(null);
  const isShown = (id: string | null) => id !== null && shown.some((spell) => spellId(spell) === id);
  const tabStop = isShown(focused) ? focused : isShown(selectedId) ? selectedId : shown[0] ? spellId(shown[0]) : null;
  // On a phone the list and the spell view are two views. A panel opened at a spell shows its spell view.
  const [view, setView] = useState<"list" | "spell">(phone && atId !== null ? "spell" : "list");
  const spellView = phone && view === "spell";
  // The live region. `count` changes with each new message, so the same name is said again.
  const [announce, setAnnounce] = useState({ text: "", count: 0 });
  const say = (text: string) => setAnnounce((last) => ({ text, count: last.count + 1 }));
  const list = useRef<HTMLDivElement>(null);
  // The scroll position of the list when a tap opened the spell view; null when the panel opened in the spell view.
  const listTop = useRef<number | null>(null);
  const back = () => panes.current?.querySelector<HTMLElement>(`[${BACK}]`) ?? null;
  const builderLink = useRef<HTMLAnchorElement>(null);

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

  // The selected row scrolls into view at the open, when the spells load, and after a search, if it is in the list.
  // jsdom has no scrollIntoView.
  const rowOf = (id: string | null) => (id === null ? null : (list.current?.querySelector<HTMLElement>(`[${ROW}="${CSS.escape(id)}"]`) ?? null));
  const loaded = lookup !== null;
  useLayoutEffect(() => {
    if (!spellView) rowOf(selectedId)?.scrollIntoView?.({ block: "nearest" });
    // Only these changes scroll: an arrow key or a click scrolls by itself.
  }, [loaded, query]);
  // While the spells load, the dialog gives the focus to its fallback: the builder link, the first control of the body
  // (or the popup on a touch screen). When the spells show, the selected row gets the focus, but only while the user
  // has not moved it, for example to the X.
  const waitsForRows = useRef(!loaded);
  useLayoutEffect(() => {
    if (!loaded || !waitsForRows.current) return;
    waitsForRows.current = false;
    if (spellView && selected) say(selected.name);
    // The focus is still on the fallback only when it is on the builder link or on the popup itself.
    const active = document.activeElement;
    const onFallback = active === builderLink.current || active?.closest('[role="dialog"]') === active;
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

  return (
    <>
      {/* The prepare count and the "Prepare spells" button go on the left of the bar later (ORC-287). */}
      <div className="flex flex-none flex-wrap items-center gap-x-4 gap-y-1 bg-panel px-[18px] py-2 font-sans text-[13px] max-[600px]:px-4">
        <Link ref={builderLink} to={builderHref} className="ml-auto underline underline-offset-2">
          Change known spells in the builder
        </Link>
      </div>
      <div
        ref={panes}
        className="grid min-h-0 flex-1 grid-cols-[minmax(240px,340px)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] max-[600px]:grid-cols-[minmax(0,1fr)]"
      >
        <div
          ref={list}
          data-pane="list"
          hidden={spellView}
          className="min-h-0 scroll-pt-12 overflow-y-auto border-r border-rule-strong pr-4 pb-10 pl-[18px] max-[600px]:border-r-0 max-[600px]:px-4"
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
          />
        </div>
        <div data-pane="spell" hidden={phone && !spellView} className="min-h-0 overflow-y-auto pt-[18px] pr-[22px] pb-10 pl-[26px] max-[600px]:px-4">
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
            <SpellView name={selected.name} spell={lookup(selected.key)} castNote={selected.castNote} />
          ) : (
            <p className="text-ink-muted">Select a spell to read it.</p>
          )}
        </div>
      </div>
      {/* The name of a new selected spell, for a screen reader. */}
      <p aria-live="polite" className="sr-only">
        {/* A no-break space on every second message makes the same name a new message. */}
        {announce.text}
        {announce.count > 0 && announce.count % 2 === 0 && "\u00a0"}
      </p>
    </>
  );
}
