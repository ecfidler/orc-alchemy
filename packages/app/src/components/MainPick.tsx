// The main pick of the Background and Race steps (ORC-347, ORC-348, docs/design/character-builder.md "The Background
// and Race steps"): the list with a detail panel (ui ListPanel), and after the pick the block that takes its place,
// with About, Customize and Change, the Choices of the option, and "Picked on other steps". The race has a fixed last
// row, Custom Origin, and its guided edit.
import { Button, Dialog, LeftMark, ListPanel, type ListPanelItem, type ListPanelPlace, LockIcon, PixelIcon, type PixelIconName } from "@orc-alchemy/ui";
import { type ComponentType, type ReactNode, type RefObject, useEffect, useId, useMemo, useRef, useState } from "react";
import type { BuilderOption, BuilderSelection } from "../engine/builder.ts";
import { BACKGROUND_TYPE } from "../engine/content.ts";
import { RACE_TYPE } from "../engine/custom-origin.ts";
import type { ContentType } from "../engine/engine.ts";
import { type OtherStepLine, otherStepLines, stepMark } from "../engine/other-steps.ts";
import { hasSearch, notAvailableText, shownOptions } from "../engine/selection-control.ts";
import { useOpenStep, useSectionName, useStepFrame } from "./builder-context.tsx";
import { HEADING_CLASSES } from "./Classes.tsx";
import { type Customizable, CustomizeButton, type GuidedEdit, useCustomize } from "./CustomizeDialog.tsx";
import { BackgroundDetail, type DetailProps, RaceDetail, useOptionPack } from "./OptionDetail.tsx";
import { usePick, useUnavailable } from "./SelectionControl.tsx";

/** The parts of a main pick that its kind gives: the word for one option, the content type, and the detail. */
export type MainPickParts = Pick<MainPickProps, "noun" | "contentType" | "detail">;

/** The detail of a main pick from its component of OptionDetail.tsx. */
const detailWith =
  (Detail: ComponentType<DetailProps>): MainPickProps["detail"] =>
  (option, pack, place) => <Detail optionKey={option.key} name={option.name} pack={pack} place={place} />;

/** The top-level selections whose main pick is a list with a detail panel, and their parts. */
const MAIN_PICKS: Record<string, MainPickParts> = {
  background: { noun: "background", contentType: BACKGROUND_TYPE, detail: detailWith(BackgroundDetail) },
  race: { noun: "race", contentType: RACE_TYPE, detail: detailWith(RaceDetail) },
};

/** The parts of the main pick of the selection, or null when it is not the main pick of its step: the top-level background or race. */
export const mainPickParts = ({ actualPath }: BuilderSelection): MainPickParts | null =>
  (actualPath.length === 1 && Object.hasOwn(MAIN_PICKS, actualPath[0]) && MAIN_PICKS[actualPath[0]]) || null;

/** A fixed last row of the list that is not an option, such as Custom Origin: its name, its icon, its detail and its action. */
export interface MainPickRow {
  label: string;
  icon?: PixelIconName;
  detail: (place: ListPanelPlace) => ReactNode;
  action: (place: ListPanelPlace) => ReactNode;
}

/** The value of the fixed row in the ListPanel. An option key is the key of a name, which has no space. */
const FIXED_ROW = "fixed row";

export interface MainPickProps {
  selection: BuilderSelection;
  /** The word for one option, for the texts: "background" gives "Search 42 backgrounds". */
  noun: string;
  /** The content type of the options, for the pack of each option. */
  contentType: ContentType;
  /** The detail of an option, for the panel, the modal of a narrow page, and About. `pack` is the pack of the option. */
  detail: (option: BuilderOption, pack: string | undefined, place: ListPanelPlace) => ReactNode;
  /** The Customize dialog of the options, when the builder can customize them. */
  customizable?: Customizable;
  /** The dialog that edits a copy in place of the Customize dialog, such as the Custom Origin dialog. */
  guided?: GuidedEdit;
  /** The fixed last row of the list, such as Custom Origin. */
  fixedRow?: MainPickRow;
  /**
   * The sections of the selections that the picked option opens on this step: the section Choices of the block. The
   * block has no Choices without it.
   */
  choices?: ReactNode;
}

/**
 * The list with a detail panel before the pick, and the block after it. A click on a name shows the option in the
 * panel; "Choose {name}" picks it, and asks first when the pick removes picks (usePick). After the pick, the block takes
 * the place of the list, and the focus goes to its Change button. Change opens the list again on the picked option,
 * with a Cancel that puts the block back.
 */
export function MainPick({ selection, noun, contentType, detail, customizable, guided, fixedRow, choices }: MainPickProps) {
  const name = useSectionName(selection);
  const options = shownOptions(selection);
  const picked = options.find((option) => option.selected) ?? null;
  const [changing, setChanging] = useState(false);
  const listShows = picked === null || changing;
  const packOf = useOptionPack(contentType);

  const changeButton = useRef<HTMLButtonElement>(null);
  // The Choose button of each place: the panel, and the modal of a narrow part. The panel of a narrow part does not show.
  const chooseButtons = useRef<Record<ListPanelPlace, HTMLButtonElement | null>>({ panel: null, modal: null });
  // The focus after the question of a pick: the Change button of the block after the pick, or else the Choose button
  // that shows, in the modal or in the panel. With none, the focus goes back to where it was.
  const afterQuestion = useMemo(
    () => ({
      get current() {
        const shows = (button: HTMLButtonElement | null) => (button?.isConnected && (button.checkVisibility?.() ?? true) ? button : null);
        return changeButton.current ?? shows(chooseButtons.current.modal) ?? shows(chooseButtons.current.panel);
      },
    }),
    [],
  );
  const { select, dialog } = usePick(selection, afterQuestion);

  // A new pick while the list shows closes the list. The focus then goes to Change (spec, "Keyboard and screen reader").
  // The pick of the last render is state, so a new pick sets the state during the render, as React permits for the
  // state of the component itself.
  const pickedKey = picked?.key ?? null;
  const [lastPick, setLastPick] = useState(pickedKey);
  const [focusChange, setFocusChange] = useState(false);
  if (lastPick !== pickedKey) {
    setLastPick(pickedKey);
    // The list showed in the last render when it had no pick, or while the player changed the pick.
    if (pickedKey !== null && (lastPick === null || changing)) {
      setFocusChange(true);
      setChanging(false);
    }
  }
  useEffect(() => {
    if (listShows || !focusChange) return;
    setFocusChange(false);
    changeButton.current?.focus();
  }, [listShows, focusChange]);

  const cancel = () => {
    setFocusChange(true);
    setChanging(false);
  };

  // One section in both states, named by the selection, so a test or a screen reader finds it after a pick too.
  return (
    <section aria-label={name} data-main-pick="">
      {listShows ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h3 className={`${HEADING_CLASSES} flex-1`}>
              <span className="min-w-0">
                {changing && picked ? `${name}: ${picked.name}` : name}
                <span className="text-[1px] opacity-0">,</span>
              </span>
              <span className="flex-1" />
              <LeftMark left={changing ? stepMark([selection]) : selection.remaining} />
            </h3>
            {changing && (
              <Button variant="ghost" size="small" onClick={cancel}>
                Cancel
              </Button>
            )}
          </div>
          <OptionList
            selection={selection}
            options={options}
            picked={picked}
            noun={noun}
            packOf={packOf}
            detail={detail}
            fixedRow={fixedRow}
            chooseButtons={chooseButtons}
            onChoose={select}
          />
        </div>
      ) : (
        picked && (
          <PickBlock
            selection={selection}
            option={picked}
            name={name}
            noun={noun}
            pack={packOf(picked.key)}
            detail={detail}
            customizable={customizable}
            guided={guided}
            changeButton={changeButton}
            onChange={() => setChanging(true)}
          >
            {choices}
          </PickBlock>
        )
      )}
      {dialog}
    </section>
  );
}

interface OptionListProps {
  selection: BuilderSelection;
  options: BuilderOption[];
  picked: BuilderOption | null;
  noun: string;
  packOf: (key: string) => string | undefined;
  detail: MainPickProps["detail"];
  fixedRow?: MainPickRow;
  chooseButtons: { current: Record<ListPanelPlace, HTMLButtonElement | null> };
  onChoose: (key: string) => void;
}

/** The options in the ui ListPanel, in the order of the names, with the action row of the panel, and the fixed row. */
function OptionList({ selection, options, picked, noun, packOf, detail, fixedRow, chooseButtons, onChoose }: OptionListProps) {
  const unavailable = useUnavailable(selection);
  const id = useId();
  const byKey = new Map(options.map((option) => [option.key, option]));
  const items: ListPanelItem<string>[] = [...options]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((option) => {
      const reason = unavailable.get(option.key);
      return { value: option.key, label: option.name, aside: packOf(option.key), ...(reason !== undefined && { unavailable: reason }) };
    });

  function action(item: ListPanelItem<string>, place: ListPanelPlace) {
    if (fixedRow && item.value === FIXED_ROW) return fixedRow.action(place);
    return (
      <ChooseAction
        item={item}
        reasonId={`${id}-${place}`}
        pickedText={picked?.key === item.value ? `The ${noun} of this character` : null}
        chooseRef={(button) => {
          chooseButtons.current[place] = button;
        }}
        onChoose={onChoose}
      />
    );
  }

  return (
    <ListPanel
      label={`${noun.charAt(0).toUpperCase()}${noun.slice(1)}s`}
      items={items}
      defaultCurrent={picked?.key ?? null}
      picked={picked?.key ?? null}
      fixedRow={fixedRow && { value: FIXED_ROW, label: fixedRow.label, icon: fixedRow.icon }}
      search={hasSearch(options.length) ? { placeholder: `Search ${options.length} ${noun}s` } : undefined}
      detail={(item, place) => {
        const option = byKey.get(item.value);
        if (option) return detail(option, item.aside, place);
        return fixedRow && item.value === FIXED_ROW ? fixedRow.detail(place) : null;
      }}
      action={action}
      emptyText={`Select a ${noun} to read about it.`}
    />
  );
}

/**
 * The action row of the panel of an option in a list with a detail panel: for the picked option the check icon and
 * `pickedText`, for an option that the character cannot take the reason beside a disabled Choose button, and else
 * "Choose {name}", which calls `onChoose`. The main pick and the subclass dialog (ORC-350) share it.
 */
export function ChooseAction({
  item,
  reasonId,
  pickedText,
  chooseRef,
  onChoose,
  verb = "Choose",
}: {
  item: ListPanelItem<string>;
  /** A unique id for the reason, in each place. */
  reasonId: string;
  /** The text of the picked option, or null for an option that is not picked. */
  pickedText: string | null;
  chooseRef?: (button: HTMLButtonElement | null) => void;
  onChoose: (key: string) => void;
  /** The verb of the button: "Choose", or "Add" for the modal of "Add a class" (ORC-351). */
  verb?: string;
}) {
  if (pickedText !== null)
    return (
      <span className="mr-auto inline-flex items-center gap-1.5 font-sans text-[13px] font-semibold">
        <PixelIcon name="check" />
        {pickedText}
      </span>
    );
  if (item.unavailable !== undefined)
    return (
      <>
        <span id={reasonId} className="mr-auto inline-flex items-center gap-1.5 font-sans text-[13px] text-ink-muted">
          <LockIcon />
          {notAvailableText(item.unavailable)}
        </span>
        <Button variant="solid" icon="check" disabled aria-describedby={reasonId}>
          {verb} {item.label}
        </Button>
      </>
    );
  return (
    <Button ref={chooseRef} variant="solid" icon="check" onClick={() => onChoose(item.value)}>
      {verb} {item.label}
    </Button>
  );
}

interface PickBlockProps {
  selection: BuilderSelection;
  option: BuilderOption;
  /** The name of the section, "Background", for the name of the Change button. */
  name: string;
  noun: string;
  pack: string | undefined;
  detail: MainPickProps["detail"];
  customizable?: Customizable;
  guided?: GuidedEdit;
  changeButton: RefObject<HTMLButtonElement>;
  onChange: () => void;
  /** The section Choices: the sections of the selections that the option opens on this step. */
  children?: ReactNode;
}

/**
 * The block of the picked option, with the look of the class block: the header has the name with the pack, the left
 * mark of the step, and the ghost buttons About, Customize and Change. The body has Choices, when the option has a
 * choice on this step, and "Picked on other steps".
 */
function PickBlock({ selection, option, name, noun, pack, detail, customizable, guided, changeButton, onChange, children }: PickBlockProps) {
  const block = useRef<HTMLDivElement>(null);
  const [about, setAbout] = useState(false);
  const hasChoices = children !== undefined && children !== null && children !== false;
  return (
    <BlockFrame
      frameRef={block}
      header={
        <>
          <h3 className="flex min-w-0 flex-[1_1_16rem] items-center gap-3">
            <span className="min-w-0 text-[24px] leading-tight font-semibold">
              <span data-pick-name="">{option.name}</span>
              {pack && <small className="ml-2.5 font-sans text-[12px] font-medium text-ink-muted">{pack}</small>}
              <span className="text-[1px] opacity-0">,</span>
            </span>
            <span className="flex-1" />
            <LeftMark left={stepMark([selection])} />
          </h3>
          <span className="ml-auto inline-flex flex-wrap items-center gap-1.5">
            <Button variant="ghost" size="small" aria-label={`About ${option.name}`} onClick={() => setAbout(true)}>
              About
            </Button>
            {customizable && <BlockCustomize selection={selection} option={option} customizable={customizable} guided={guided} scope={block} />}
            <Button ref={changeButton} variant="ghost" size="small" aria-label={`Change ${name}`} onClick={onChange}>
              Change
            </Button>
          </span>
        </>
      }
    >
      {hasChoices && <BlockSection title="Choices">{children}</BlockSection>}
      <BlockSection title="Picked on other steps">
        <OtherSteps selection={selection} noun={noun} />
      </BlockSection>
      <Dialog open={about} onOpenChange={setAbout} title={option.name} footer={false}>
        {detail(option, pack, "modal")}
      </Dialog>
    </BlockFrame>
  );
}

/**
 * The frame of a block, the look of the class block (docs/design/character-builder.md, "The class block"): a raised
 * box with a rule around it, the header row with a rule under it, and the body, whose sections are its children. The
 * class block and the block of a main pick share it. A closed class block (ORC-351) shows only its header: the body
 * stays in the page, hidden, so that its parts keep their state; `bodyId` names the body for the button that opens it.
 */
export function BlockFrame({
  header,
  children,
  frameRef,
  closed = false,
  bodyId,
}: {
  header: ReactNode;
  children: ReactNode;
  frameRef?: RefObject<HTMLDivElement>;
  closed?: boolean;
  bodyId?: string;
}) {
  return (
    <div ref={frameRef} className="border border-rule-strong bg-paper-raised">
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 ${closed ? "" : "border-b border-rule-strong"}`}>{header}</div>
      <div id={bodyId} hidden={closed} className="space-y-3 px-3 pt-3 pb-3">
        {children}
      </div>
    </div>
  );
}

/** The Customize button of the block (CustomizeButton), with its dialog. */
function BlockCustomize({
  selection,
  option,
  customizable,
  guided,
  scope,
}: {
  selection: BuilderSelection;
  option: BuilderOption;
  customizable: Customizable;
  guided?: GuidedEdit;
  scope: RefObject<HTMLElement | null>;
}) {
  const customize = useCustomize(selection, customizable, scope, guided);
  return (
    <>
      <CustomizeButton customize={customize} option={option} variant="ghost" size="small" />
      {customize.element}
    </>
  );
}

/**
 * A section of the body of a block: a small title in capitals, then its content. `mark` is the left mark at the right of
 * the title, such as the hit points left (ORC-351); null keeps its place empty, so a mark that comes moves nothing.
 */
export function BlockSection({ title, mark, children }: { title: string; mark?: number | null; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-1">
      <h4
        id={id}
        className={`font-sans text-[10.5px] font-medium tracking-[0.08em] text-ink-muted uppercase ${mark === undefined ? "" : "flex h-5 items-center justify-between gap-3"}`}
      >
        <span>
          {title}
          {mark !== undefined && mark !== null && <span className="text-[1px] opacity-0">,</span>}
        </span>
        {mark !== undefined && mark !== null && <span className="tracking-normal normal-case">{<LeftMark left={mark} />}</span>}
      </h4>
      {children}
    </section>
  );
}

/**
 * "Picked on other steps": one line for each kind of pick that the option gives on another step (otherStepLines). A
 * line shows the kind, then the picks or the left mark, then the step, and opens that step. An option that gives no
 * pick on another step has one line that says so. `lines` gives other lines, such as those of one class of the Class
 * step (classStepLines, ORC-351).
 */
export function OtherSteps({ selection, noun, lines: given }: { selection: BuilderSelection; noun: string; lines?: OtherStepLine[] }) {
  const { steps } = useStepFrame();
  const open = useOpenStep();
  const own = useMemo(() => otherStepLines(selection, steps), [selection, steps]);
  const lines = given ?? own;
  if (lines.length === 0)
    return <p className="border-y border-rule-strong py-2 font-sans text-[13.5px] text-ink-muted">This {noun} gives no pick on another step.</p>;
  return (
    <ul aria-label="Picked on other steps" className="divide-y divide-rule border-y border-rule-strong">
      {lines.map((line) => {
        const picks = line.remaining === 0 && line.picks.length > 0 ? line.picks.join(", ") : null;
        const value = picks ?? (line.remaining > 0 ? `${line.remaining} left` : line.remaining < 0 ? `remove ${-line.remaining}` : "done");
        return (
          <li key={line.kind}>
            <Button
              variant="bare"
              aria-label={`${line.kind}, ${value}, ${line.step}`}
              onClick={() => open(line.step)}
              className="grid min-h-[38px] w-full grid-cols-[112px_minmax(0,1fr)_auto] items-center gap-2.5 py-1 pr-1 text-left hover:bg-panel min-[720px]:grid-cols-[150px_minmax(0,1fr)_auto]"
            >
              <span className="font-sans text-[14px] font-semibold">{line.kind}</span>
              <span className="min-w-0 truncate text-[15.5px]">{picks ?? <LeftMark left={line.remaining} />}</span>
              <span className="font-sans text-[12.5px] whitespace-nowrap text-ink-muted underline underline-offset-3">{line.step}</span>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
