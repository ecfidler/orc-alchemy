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
// The spell view of a spell that the character can cast has the Cast control
// beside its name (ORC-320, docs/design/sheet-interactivity.md "Casting a
// spell"). What a cast did shows in the status toast of the sheet page
// (ORC-326).
//
// A failed save (ORC-290, "A failed save") shows the alert note of the shell
// under the header, with a "Try again" button. The sheet behind the panel
// shows the same note.
import { Button, Checkbox, Dialog, FramedBox, Label, LockIcon, PixelIcon } from "@orc-alchemy/ui";
import { type ReactNode, type RefObject, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { type CastAction, castChoices, type FeatureUses } from "../engine/cast.ts";
import { bonusStr, keyToName, type PrepareSpell, type Sheet, type Spellcasting, type SpellRef, type SpendSlots } from "../engine/sheet.ts";
import { type ListedSpell, type SourceNumbers, sourceNumbers, spellClassLine, spellGroups, spellId, spellSources } from "../engine/spell-list.ts";
import { hasPrepareBox, type PrepareCount, type PrepareKind, prepareCounts, prepareCountText, prepareKind } from "../engine/spell-prepare.ts";
import { spellName } from "../engine/spell-records.ts";
import { flushAutosave } from "../state/character.ts";
import { useSpellLookup } from "../state/spell-records.ts";
import { useSpellSlotsFolded } from "../state/spell-slots-fold.ts";
import { CastControl } from "./CastControl.tsx";
import { PrepareCountText } from "./PrepareCount.tsx";
import { SaveFailedNote, useSaveFailed } from "./SaveFailedNote.tsx";
import { INITIAL_FOCUS, type RowMark } from "./SpellList.tsx";
import { SpellPanes, type SpellPanesHandle } from "./SpellPanes.tsx";
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
  /** The spell key of the concentration mark, or null (play state). */
  concentration?: string | null;
  /**
   * Casts a spell as one sheet change; the sheet page says what it did in its status toast (ORC-320, ORC-326). Without
   * it, as outside the sheet page, the spell view has no Cast control.
   */
  onCast?: (action: CastAction) => void;
  /** The uses of the features of the sheet (featureUses): a spell with its own uses casts with one of them (ORC-321). */
  uses?: readonly FeatureUses[];
}

/**
 * The Spells panel. The X, Escape and a click outside close it, and the
 * focus then goes back to the control that opened it. At the open, the
 * selected row has the focus: the spell of `at`, or else the first spell. On
 * a phone, a panel opened at a spell shows its spell view, and the "Back to
 * the list" button has the focus. The panel is not in the URL.
 */
export function SpellsPanel({
  open,
  onOpenChange,
  spellcasting,
  classes,
  at,
  builderHref,
  onSpendSlots,
  onPrepare,
  concentration = null,
  onCast,
  uses = [],
}: SpellsPanelProps) {
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
        concentration={concentration}
        onCast={onCast}
        uses={uses}
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

/** The mark of a row in prepare mode: the prepare box, and the state words and the label of its prepare kind. */
function prepareMark(spell: ListedSpell, kind: PrepareKind, withSource: boolean, onPrepare: PrepareSpell): RowMark {
  const name = `Prepared: ${spell.name}${withSource ? `, ${spell.source}` : ""}`;
  if (kind === "cantrip") return { box: null };
  if (kind === "known") return { box: null, state: "known", label: { text: "Known" } };
  if (kind === "always")
    return {
      box: { checked: spell.prepared, name, disabled: true, onChange: () => {} },
      state: "always prepared",
      label: { text: "Always prepared", lock: true },
    };
  return { box: { checked: spell.prepared, name, onChange: (on) => onPrepare(spell, on) }, state: spell.prepared ? "prepared" : "not prepared" };
}

/**
 * The bar and the two panes (SpellPanes). The state is new at each open, because the Dialog mounts its body at the
 * open: a close ends prepare mode.
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
  concentration,
  onCast,
  uses,
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
  concentration: string | null;
  onCast: ((action: CastAction) => void) | undefined;
  uses: readonly FeatureUses[];
}) {
  const lookup = useSpellLookup();
  const [prepareMode, setPrepareMode] = useState(false);
  // In the order of the class line of the header.
  const counts = prepareCounts(spellcasting, classes);
  // With two classes that prepare, each count has the class name first.
  const withClass = counts.length > 1;
  const groups = spellGroups(spellcasting, lookup, { unprepared: prepareMode });
  // The spell view keeps a picked spell that leaves the list: for example a spell that the user stops preparing
  // outside prepare mode, or after "Done".
  const selectable = prepareMode ? undefined : spellGroups(spellcasting, lookup, { unprepared: true }).flatMap((group) => group.spells);
  const handle = useRef<SpellPanesHandle>(null);
  // The bar, whose first control is the fallback of the focus while the spells load.
  const bar = useRef<HTMLDivElement>(null);
  // While the Spell slots block is open, only its groups are Tab stops; while it is folded, the groups on the headings are.
  const [folded, setFolded] = useSpellSlotsFolded();

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
      last?.isConnected && !last.closest("[hidden]") ? last : (handle.current?.focusTarget() ?? bar.current?.querySelector<HTMLElement>("a, button"));
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
      <SpellPanes
        groups={groups}
        selectable={selectable}
        lookup={lookup}
        at={at}
        panes={panes}
        handle={handle}
        fallback={() => bar.current?.querySelector("a, button")}
        // A change of a prepare count goes in the live region, with the class name: "Cleric: 9 of 8 prepared. Remove 1 spell."
        messages={counts.map((count) => prepareCountText(count, true))}
        scrollKey={prepareMode}
        // The Spell slots block is above the list and does not scroll with it. On a phone it is at the top of the two views.
        top={({ goTo, shownLevels }) => (
          <SpellSlotsBlock
            spellcasting={spellcasting}
            onSpendSlots={onSpendSlots}
            folded={folded}
            onFoldedChange={setFolded}
            onGoTo={goTo}
            shownLevels={shownLevels}
          />
        )}
        headingSlots={(level) => <HeadingSlots spellcasting={spellcasting} level={level} onSpendSlots={onSpendSlots} copy={!folded} />}
        marks={prepareMode ? (spell) => prepareMark(spell, prepareKind(spell, spellcasting.casters), withSource, onPrepare) : undefined}
        withSource={withSource}
        view={(selected, { record, phone, keep }) => {
          const kind = prepareKind(selected, spellcasting.casters);
          // What the selected spell can do now. Without a cast handler, or for a spell with no control, the spell view has no control.
          const choices = onCast ? castChoices(selected, record?.record, { slots: spellcasting, concentration, uses }) : null;
          return (
            <SpellView
              name={selected.name}
              spell={record}
              castNote={selected.castNote}
              control={
                onCast &&
                choices &&
                choices.kind !== "none" && (
                  <CastControl
                    // A new spell has a new control, so a question of the last one does not stay.
                    key={spellId(selected)}
                    spell={selected}
                    name={selected.name}
                    record={record?.record}
                    choices={choices}
                    concentration={concentration}
                    concentrationName={concentration && lookup && spellName(lookup, concentration, keyToName(concentration))}
                    onCast={onCast}
                    phone={phone}
                  />
                )
              }
            >
              {hasPrepareBox(kind) && (
                <PrepareLine
                  spell={selected}
                  kind={kind}
                  count={counts.find((count) => count.className === selected.source)}
                  withClass={withClass}
                  prepareMode={prepareMode}
                  onPrepare={(spell, on) => {
                    keep();
                    onPrepare(spell, on);
                  }}
                />
              )}
            </SpellView>
          );
        }}
      />
    </>
  );
}
