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
import { otherStepLines, stepMark } from "../engine/other-steps.ts";
import { hasSearch, notAvailableText, shownOptions } from "../engine/selection-control.ts";
import { useOpenStep, useSectionName, useStepFrame } from "./builder-context.tsx";
import { HEADING_CLASSES } from "./Classes.tsx";
import { type Customizable, type GuidedEdit, useCustomize } from "./CustomizeDialog.tsx";
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

/** True when the selection is the main pick of its step: the top-level background or race. */
export const isMainPick = (selection: BuilderSelection) => mainPickParts(selection) !== null;

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
  const focusChange = useRef(false);
  const shown = useRef({ pick: picked?.key ?? null, list: listShows });
  const pickedKey = picked?.key ?? null;
  if (shown.current.pick !== pickedKey) {
    if (pickedKey !== null && shown.current.list) {
      focusChange.current = true;
      if (changing) setChanging(false);
    }
    shown.current.pick = pickedKey;
  }
  useEffect(() => {
    shown.current.list = listShows;
    if (listShows || !focusChange.current) return;
    focusChange.current = false;
    changeButton.current?.focus();
  });

  const cancel = () => {
    focusChange.current = true;
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
    if (picked?.key === item.value)
      return (
        <span className="mr-auto inline-flex items-center gap-1.5 font-sans text-[13px] font-semibold">
          <PixelIcon name="check" />
          The {noun} of this character
        </span>
      );
    if (item.unavailable !== undefined) {
      const reasonId = `${id}-${place}`;
      return (
        <>
          <span id={reasonId} className="mr-auto inline-flex items-center gap-1.5 font-sans text-[13px] text-ink-muted">
            <LockIcon />
            {notAvailableText(item.unavailable)}
          </span>
          <Button variant="solid" icon="check" disabled aria-describedby={reasonId}>
            Choose {item.label}
          </Button>
        </>
      );
    }
    return (
      <Button
        ref={(button) => {
          chooseButtons.current[place] = button;
        }}
        variant="solid"
        icon="check"
        onClick={() => onChoose(item.value)}
      >
        Choose {item.label}
      </Button>
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
    <div ref={block} className="border border-rule-strong bg-paper-raised">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-rule-strong px-3 py-2.5">
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
          {customizable && <CustomizeButton selection={selection} option={option} customizable={customizable} guided={guided} scope={block} />}
          <Button ref={changeButton} variant="ghost" size="small" aria-label={`Change ${name}`} onClick={onChange}>
            Change
          </Button>
        </span>
      </div>
      <div className="space-y-3 px-3 pt-3 pb-3">
        {hasChoices && <BlockSection title="Choices">{children}</BlockSection>}
        <BlockSection title="Picked on other steps">
          <OtherSteps selection={selection} noun={noun} />
        </BlockSection>
      </div>
      <Dialog open={about} onOpenChange={setAbout} title={option.name} footer={false}>
        {detail(option, pack, "modal")}
      </Dialog>
    </div>
  );
}

/** The Customize button of the block, with the text of the Homebrew forms spec: Customize, Edit custom, or the guided text. */
function CustomizeButton({
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
  const label = customize.label(option.key);
  return (
    <>
      <Button
        variant="ghost"
        size="small"
        icon="pencil"
        data-customize={option.key}
        aria-label={`${label} ${option.name}`}
        onClick={() => customize.open(option.key, option.name)}
      >
        {label}
      </Button>
      {customize.element}
    </>
  );
}

/** A section of the block: a small title in capitals, then its content. */
function BlockSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-1">
      <h4 id={id} className="font-sans text-[10.5px] font-medium tracking-[0.08em] text-ink-muted uppercase">
        {title}
      </h4>
      {children}
    </section>
  );
}

/**
 * "Picked on other steps": one line for each kind of pick that the option gives on another step (otherStepLines). A
 * line shows the kind, then the picks or the left mark, then the step, and opens that step. An option that gives no
 * pick on another step has one line that says so.
 */
function OtherSteps({ selection, noun }: { selection: BuilderSelection; noun: string }) {
  const { steps } = useStepFrame();
  const open = useOpenStep();
  const lines = useMemo(() => otherStepLines(selection, steps), [selection, steps]);
  if (lines.length === 0)
    return <p className="border-y border-rule-strong py-2 font-sans text-[13.5px] text-ink-muted">This {noun} gives no pick on another step.</p>;
  return (
    <ul aria-label="Picked on other steps" className="divide-y divide-rule border-y border-rule-strong">
      {lines.map((line) => {
        const done = line.remaining === 0 && line.picks.length > 0;
        const value = done ? line.picks.join(", ") : line.remaining > 0 ? `${line.remaining} left` : line.remaining < 0 ? `remove ${-line.remaining}` : "done";
        return (
          <li key={line.kind}>
            <Button
              variant="bare"
              aria-label={`${line.kind}, ${value}, ${line.step}`}
              onClick={() => open(line.step)}
              className="grid min-h-[38px] w-full grid-cols-[112px_minmax(0,1fr)_auto] items-center gap-2.5 py-1 pr-1 text-left hover:bg-panel min-[720px]:grid-cols-[150px_minmax(0,1fr)_auto]"
            >
              <span className="font-sans text-[14px] font-semibold">{line.kind}</span>
              <span className="min-w-0 truncate text-[15.5px]">{done ? line.picks.join(", ") : <LeftMark left={line.remaining} />}</span>
              <span className="font-sans text-[12.5px] whitespace-nowrap text-ink-muted underline underline-offset-3">{line.step}</span>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
