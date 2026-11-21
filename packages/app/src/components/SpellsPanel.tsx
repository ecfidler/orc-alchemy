// The Spells panel (ORC-285, docs/design/spells-panel.md "The panel"): a
// wide Dialog over the sheet, with a header, a bar and two panes. The list of
// spells by level is on the left, and the spell view of the selected spell
// is on the right. At 600px and less the panel fills the screen, and the list
// and the spell view are two views.
import { Button, Dialog, FramedBox } from "@orc-alchemy/ui";
import { type ReactNode, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "react-router";
import { bonusStr, type Sheet, type Spellcasting } from "../engine/sheet.ts";
import { type ListedSpell, type SpellRef, searchSpellGroups, spellClassLine, spellGroups, spellId, spellSources } from "../engine/spell-list.ts";
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

/** The attribute that marks the "Back to the list" link of the spell view on a phone. */
const BACK = "data-spells-back";

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
 * the list" link has the focus. The panel is not in the URL.
 */
export function SpellsPanel({ open, onOpenChange, spellcasting, classes, at, builderHref }: SpellsPanelProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="wide"
      fill
      footer={false}
      title="Spells"
      header={<PanelHeader spellcasting={spellcasting} classes={classes} />}
      initialFocus={() => document.querySelector<HTMLElement>(`[${INITIAL_FOCUS}]`)}
    >
      <PanelBody spellcasting={spellcasting} at={at} builderHref={builderHref} />
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
function PanelBody({ spellcasting, at, builderHref }: { spellcasting: Spellcasting; at: SpellRef | undefined; builderHref: string }) {
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
  const [announce, setAnnounce] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const listTop = useRef(0);
  const back = () => document.querySelector<HTMLElement>(`[${BACK}]`);

  const select = (spell: ListedSpell) => {
    if (spellId(spell) === selectedId) return;
    setPicked(spellId(spell));
    setAnnounce(spell.name);
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
  // While the spells load, the dialog gives the focus to the first control. When they show, the selected row gets it.
  const waitsForRows = useRef(!loaded);
  useLayoutEffect(() => {
    if (!loaded || !waitsForRows.current) return;
    waitsForRows.current = false;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement) return;
    (spellView ? back() : rowOf(tabStop))?.focus();
  }, [loaded]);
  // On a phone, the "Back to the list" link of a new spell view gets the focus, as its row is hidden. Back to the
  // list: the list is at the same scroll position, and the row has the focus. This runs before the paint, so the
  // focus does not go to the dialog when the focused link goes.
  const wasSpellView = useRef(spellView);
  useLayoutEffect(() => {
    if (spellView === wasSpellView.current) return;
    wasSpellView.current = spellView;
    if (spellView) {
      back()?.focus({ preventScroll: true });
      return;
    }
    if (list.current) list.current.scrollTop = listTop.current;
    rowOf(selectedId)?.focus({ preventScroll: true });
  }, [spellView]);

  return (
    <>
      {/* The prepare count and the "Prepare spells" button go on the left of the bar later (ORC-287). */}
      <div className="flex flex-none flex-wrap items-center gap-x-4 gap-y-1 bg-panel px-[18px] py-2 font-sans text-[13px] max-[600px]:px-4">
        <Link to={builderHref} className="ml-auto underline underline-offset-2">
          Change known spells in the builder
        </Link>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(240px,340px)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] max-[600px]:grid-cols-[minmax(0,1fr)]">
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
          {selected ? (
            <SpellView name={selected.name} spell={lookup?.(selected.key)} castNote={selected.castNote} />
          ) : (
            loaded && <p className="text-ink-muted">Select a spell to read it.</p>
          )}
        </div>
      </div>
      {/* The name of a new selected spell, for a screen reader. */}
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </>
  );
}
