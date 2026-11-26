// The section Choices of a class block (ORC-350, docs/design/character-builder.md "Choices"): a choice row for each
// choice of the class, in groups by level. A click on the head of a row opens or closes it; a row with picks left is
// open when the step opens, and a row stays open after a pick. An open row has the control of its selection, the
// subclass row a Choose button that opens the subclass dialog, and the row "Ability Score Improvement or Feat" its two
// cards and a line to the Abilities step or the Feats step. The rules of the rows are in engine/class-choices.ts.
import { Button, Dialog, LeftMark, ListPanel, type ListPanelItem, type ListPanelPlace, Token } from "@orc-alchemy/ui";
import { type ReactNode, useId, useMemo, useRef, useState } from "react";
import type { BuilderOption, BuilderSelection } from "../engine/builder.ts";
import { type ChoiceRow, choiceLevels, improvementLine, opensAtStart, rowPicks } from "../engine/class-choices.ts";
import { SUBCLASS_TYPE } from "../engine/class-detail.ts";
import { hasSearch, shownOptions } from "../engine/selection-control.ts";
import { useOpenStep, useStepFrame } from "./builder-context.tsx";
import { SubclassDetail } from "./ClassDetail.tsx";
import { ChooseAction } from "./MainPick.tsx";
import { useOptionPack } from "./OptionDetail.tsx";
import { SelectionControl, usePick, useUnavailable } from "./SelectionControl.tsx";
import { Comma } from "./selection-heading.tsx";

/**
 * The choice rows of the picked class option, in groups by level with "Level 3" at the left, or the one row "No
 * choice at this level." for a class with no choice. Each row is open or closed by its own state (ChoiceRowView).
 */
export function ClassChoices({ option }: { option: BuilderOption }) {
  const levels = useMemo(() => choiceLevels(option), [option]);
  return (
    <div className="@container/choices border-b border-rule-strong">
      {levels.length === 0 ? (
        <div className="grid grid-cols-[62px_minmax(0,1fr)] border-t border-rule-strong">
          <span />
          <p className="flex min-h-[42px] items-center font-sans text-[13.5px] text-ink-muted">No choice at this level.</p>
        </div>
      ) : (
        levels.map(({ level, rows }) => (
          <LevelGroup key={level} level={level}>
            {rows.map((row) => (
              <ChoiceRowView key={row.id} row={row} classKey={option.key} />
            ))}
          </LevelGroup>
        ))
      )}
    </div>
  );
}

/** The rows of one level: "Level 3" at the left, and the rows at the right, with a hairline between them. */
function LevelGroup({ level, children }: { level: number; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="grid grid-cols-[62px_minmax(0,1fr)] border-t border-rule-strong">
      <span id={id} className="pt-[11px] font-sans text-[12.5px] font-semibold">
        Level {level}
      </span>
      <div className="min-w-0 divide-y divide-rule">{children}</div>
    </div>
  );
}

/**
 * A choice row: its head, an h5 with a button that opens and closes the row (aria-expanded), with the name at the left,
 * the picks or the left mark at the right, and the open or closed mark. The focus stays on the head when it opens or
 * closes. The head keeps its height when a pick changes its value; on a narrow part the value is on a second line of
 * fixed height, with the value at the right as on a wide part. The row is a region named by its head, so a test or a
 * screen reader finds it by the choice. At its first render, the row is open when it has picks to make or to remove
 * (opensAtStart), and then only a click on its head changes it. A row that goes, such as after a lower level, loses
 * its state: when it shows again, it gets its state fresh.
 */
function ChoiceRowView({ row, classKey }: { row: ChoiceRow; classKey: string }) {
  const [open, setOpen] = useState(() => opensAtStart(row.selection));
  const headId = useId();
  const bodyId = useId();
  const { selection, kind } = row;
  const picks = rowPicks(selection);
  return (
    <section aria-labelledby={headId} data-choice-row={kind}>
      <h5>
        <Button
          variant="bare"
          id={headId}
          aria-expanded={open}
          aria-controls={open ? bodyId : undefined}
          onClick={() => setOpen(!open)}
          className="grid min-h-[42px] w-full grid-cols-[minmax(0,auto)_minmax(0,1fr)_16px] items-center gap-x-2.5 py-1.5 pr-1 text-left hover:bg-panel @max-[479px]/choices:min-h-[54px] @max-[479px]/choices:grid-cols-[minmax(0,1fr)_16px]"
        >
          <span className="font-sans text-[14px] leading-5 font-semibold">
            {selection.name}
            <Comma />
          </span>
          <span className="flex min-h-6 min-w-0 items-center justify-end @max-[479px]/choices:col-start-1 @max-[479px]/choices:row-start-2">
            {picks ? <span className="min-w-0 truncate text-[16px]">{picks.join(", ")}</span> : <LeftMark left={selection.remaining} />}
          </span>
          <span
            aria-hidden="true"
            className="font-sans text-[11px] text-ink-muted @max-[479px]/choices:col-start-2 @max-[479px]/choices:row-span-2 @max-[479px]/choices:row-start-1"
          >
            {open ? "▴" : "▾"}
          </span>
        </Button>
      </h5>
      {open && (
        <div id={bodyId} className="pt-0.5 pb-3">
          {kind === "subclass" ? <SubclassControl selection={selection} classKey={classKey} /> : <SelectionControl selection={selection} />}
          {kind === "improvement" && <ImprovementLineView selection={selection} />}
        </div>
      )}
    </section>
  );
}

/**
 * The control of the subclass row: the pick as a token, and a Choose button, Change after the pick, that opens the
 * subclass dialog. The button keeps its place and its size, and after the pick and the close of the dialog, the focus
 * goes back to it.
 */
function SubclassControl({ selection, classKey }: { selection: BuilderSelection; classKey: string }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const { replace, dialog } = usePick(selection, button);
  const options = shownOptions(selection);
  const picked = options.filter((o) => o.selected);
  const current = picked[0];
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-2">
      {picked.map((option) => (
        <Token key={option.key} label={option.name} />
      ))}
      <Button ref={button} size="small" aria-haspopup="dialog" aria-label={`${current ? "Change" : "Choose"} ${selection.name}`} onClick={() => setOpen(true)}>
        {current ? "Change" : "Choose"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={selection.name} footer={false} finalFocus={button}>
        {open && (
          <SubclassList
            selection={selection}
            classKey={classKey}
            options={options}
            current={current}
            onChoose={(key) => {
              setOpen(false);
              replace(current?.key, key);
            }}
          />
        )}
      </Dialog>
      {dialog}
    </div>
  );
}

interface SubclassListProps {
  selection: BuilderSelection;
  classKey: string;
  options: BuilderOption[];
  current: BuilderOption | undefined;
  onChoose: (key: string) => void;
}

/**
 * The body of the subclass dialog: the names in the ui ListPanel at the left, and the detail of the selected subclass
 * at the right, with "Choose {subclass}". It shows the pick, or else the first subclass, when it opens. A subclass that
 * the character cannot take has its reason beside a disabled Choose button.
 */
function SubclassList({ selection, classKey, options, current, onChoose }: SubclassListProps) {
  const id = useId();
  const unavailable = useUnavailable(selection);
  const packOf = useOptionPack(SUBCLASS_TYPE);
  const items: ListPanelItem<string>[] = options.map((option) => {
    const reason = unavailable.get(option.key);
    return { value: option.key, label: option.name, aside: packOf(option.key), ...(reason !== undefined && { unavailable: reason }) };
  });

  const action = (item: ListPanelItem<string>, place: ListPanelPlace) => (
    <ChooseAction
      item={item}
      reasonId={`${id}-${place}`}
      pickedText={current?.key === item.value ? "The subclass of this character" : null}
      onChoose={onChoose}
    />
  );

  return (
    <ListPanel
      label={selection.name}
      items={items}
      defaultCurrent={current?.key ?? options[0]?.key ?? null}
      picked={current?.key ?? null}
      search={hasSearch(options.length) ? { placeholder: `Search ${options.length} subclasses` } : undefined}
      detail={(item, place) => <SubclassDetail classKey={classKey} optionKey={item.value} name={item.label} place={place} />}
      action={action}
      emptyText="Select a subclass to read about it."
    />
  );
}

/**
 * The line of the row "Ability Score Improvement or Feat" after its pick (improvementLine): a button to the step that
 * has the pick, "Place 2 points on the Abilities step", with the picks there or the left mark at the right. Its place,
 * of a fixed height, is there before the pick, so the pick does not move the rows below.
 */
function ImprovementLineView({ selection }: { selection: BuilderSelection }) {
  const { steps } = useStepFrame();
  const openStep = useOpenStep();
  const line = useMemo(() => improvementLine(selection, steps), [selection, steps]);
  if (line === null) return <div aria-hidden="true" data-improvement-line="" className="mt-2 h-[52px]" />;
  const picks = line.remaining === 0 && line.picks.length > 0 ? line.picks.join(", ") : null;
  return (
    <div data-improvement-line="" className="mt-2 h-[52px]">
      <Button
        variant="bare"
        onClick={() => openStep(line.step)}
        className="flex h-full w-full items-center justify-between gap-2.5 border border-dashed border-rule-strong px-2.5 text-left hover:bg-panel"
      >
        <span className="line-clamp-2 min-w-0 text-[15.5px] leading-[1.25]">
          {line.text}
          <Comma />
        </span>
        <span className="flex max-w-[45%] shrink-0 justify-end">
          {picks ? <span className="truncate font-sans text-[13.5px] font-semibold">{picks}</span> : <LeftMark left={line.remaining} />}
        </span>
      </Button>
    </div>
  );
}
