// The class selection of the Class step (ORC-349, ORC-351, docs/design/character-builder.md "The class cards", "The
// class block" and "A second class"). A character with no class picks its first class from the class cards: a click on
// a card opens the class in a modal, and "Choose {class}" picks it. After the pick, each class is a class block: the
// header has the icon, the name, the level control, About and Change, and with two or more classes Remove and a button
// that closes or opens the block. The body has Choices (ORC-350), Hit points and "Picked on other steps". Change opens
// the cards in a dialog, and the modal of a card there has "Change to {class}". "Add a class" below the blocks opens the
// cards of the other classes, and the modal has "Add {class}". A change of class, a lower level and Remove ask first
// when they remove picks (useChangeQuestion, ORC-344).
import { Button, Dialog, LeftMark, type ListPanelItem, NumberField, PixelIcon } from "@orc-alchemy/ui";
import { type ReactNode, type RefObject, useEffect, useId, useMemo, useRef, useState } from "react";
import type { BuilderOption, BuilderSelection } from "../engine/builder.ts";
import { blockMark, canAddClass, classStepLines, needsReason, needsText, unavailableClasses } from "../engine/class-block.ts";
import { CLASS_TYPE } from "../engine/class-detail.ts";
import {
  type ClassHitPoints,
  type ClassHitPointsMethod,
  classHitPoints,
  rollLevels,
  setHitPointsMethod,
  typeHitPoints,
  withAverageHitPoints,
} from "../engine/classes.ts";
import { engine } from "../engine/engine.ts";
import { addAClass, addFirstClass } from "../engine/new-character.ts";
import { shownOptions } from "../engine/selection-control.ts";
import { classesOf } from "../engine/strict.ts";
import { useCharacter, useOpenCharacter } from "../state/character.ts";
import { useBuilderStatus, useStepFrame } from "./builder-context.tsx";
import { useChangeQuestion } from "./ChangeQuestion.tsx";
import { ClassChoices } from "./ClassChoices.tsx";
import { Heading, useMutation } from "./Classes.tsx";
import { ClassHitPointsSection } from "./ClassHitPoints.tsx";
import { classIcon } from "./class-icons.ts";
import { BlockFrame, BlockSection, ChooseAction, OtherSteps } from "./MainPick.tsx";
import { ClassDetail, useOptionPack } from "./OptionDetail.tsx";

/** The highest level of a class. */
export const MAX_CLASS_LEVEL = 20;

/** The number of levels of the class option: the picks of its levels selection. */
const levelOf = (option: BuilderOption) => option.selections.find((s) => s.key === "levels")?.selected.length ?? 1;

/**
 * The class selection: the class cards while the character has no class, and else a class block for each class, in the
 * entity's order, and "Add a class". After a pick, a change of class or an added class, the focus goes to the Change
 * button of the block of the class.
 */
export function ClassStep({ selection }: { selection: BuilderSelection }) {
  const headingId = useId();
  const run = useMutation();
  const say = useBuilderStatus();
  const [change, question] = useChangeQuestion();
  const { entity, built } = useOpenCharacter();
  const options = shownOptions(selection);
  const optionOf = (key: string) => selection.options.find((o) => o.key === key)!;
  const free = options.filter((o) => !o.selected);
  const picked = useMemo(() => selection.selected.map((key) => selection.options.find((o) => o.key === key)!), [selection]);
  const hitPoints = useMemo(() => (entity === null || built === null ? [] : classHitPoints(entity, built, picked)), [entity, built, picked]);
  // The method that the player set for a class with no level that can change: the stored levels give no method then.
  const [chosen, setChosen] = useState<Record<string, ClassHitPointsMethod>>({});
  const methodOf = (hp: ClassHitPoints): ClassHitPointsMethod => hp.method ?? chosen[hp.classKey] ?? "average";

  // The Change button of each block, by the class key, and the class whose Change gets the focus after the next render.
  const changeButtons = useRef(new Map<string, HTMLButtonElement>());
  const [focusClass, setFocusClass] = useState<string | null>(null);
  useEffect(() => {
    if (focusClass === null) return;
    const button = changeButtons.current.get(focusClass);
    if (!button) return;
    setFocusClass(null);
    button.focus();
  }, [focusClass, selection]);
  /** A ref to the Change button of the block of the class, for the focus after a question. */
  const changeOf = (key: string): RefObject<HTMLElement | null> => ({
    get current() {
      return changeButtons.current.get(key) ?? null;
    },
  });
  // The level field of each block, by the class key: the focus goes there after a lower level that disables the minus button.
  const levelFields = useRef(new Map<string, HTMLInputElement>());
  /** The classes of the stored character, after a change. */
  const storedClasses = () => {
    const stored = useCharacter.getState().entity;
    return stored === null ? [] : classesOf(stored);
  };

  function chooseFirst(key: string) {
    if (run((e, entity, opts) => addFirstClass(e, entity, key, opts))) setFocusClass(key);
  }

  /** Adds a second class at level 1, with the average hit points (the method of a new class is Average). */
  function add(key: string) {
    if (run((e, entity, opts) => withAverageHitPoints(e, addAClass(e, entity, key, opts), key, opts))) setFocusClass(key);
  }

  async function replace(from: string, to: string) {
    await change({ kind: "replace-class", from, to }, changeOf(from));
    const classes = storedClasses();
    // A new class that is not the first has hit points at level 1: the average, the method of a new class.
    if (classes.indexOf(to) > 0) run((e, entity, opts) => withAverageHitPoints(e, entity, to, opts));
    setFocusClass(classes.includes(to) ? to : from);
  }

  /** Removes the class; then the focus goes to the Change button of the next block, or of the one before the last. */
  async function remove(key: string) {
    const list = selection.selected;
    const at = list.indexOf(key);
    const stays = list[at + 1] ?? list[at - 1];
    const before = useCharacter.getState().entity;
    await change({ kind: "remove-class", classKey: key });
    // After Cancel, the focus goes back to the Remove button.
    if (useCharacter.getState().entity !== before) setFocusClass(stays);
  }

  /** Lowers the class to the level. At level 1 the minus button is disabled, so after the change the focus goes to the field. */
  async function lower(key: string, level: number) {
    const before = useCharacter.getState().entity;
    await change({ kind: "lower-level", classKey: key, level });
    if (level === 1 && useCharacter.getState().entity !== before) levelFields.current.get(key)?.focus();
  }

  /**
   * Sets the level of the class: up with the engine's addLevel, down through the question of a lower level. With the
   * method Average, the new levels get the average; By level leaves their fields empty.
   */
  function setLevel(key: string, level: number, now: number, method: ClassHitPointsMethod) {
    if (!Number.isInteger(level) || level < 1 || level > MAX_CLASS_LEVEL) {
      say(`A class level is from 1 to ${MAX_CLASS_LEVEL}.`);
      return;
    }
    if (level < now) void lower(key, level);
    else if (level > now)
      run((e, entity, opts) => {
        let next = entity;
        for (let n = now; n < level; n++) next = e.addLevel(next, key, opts);
        return method === "average" ? withAverageHitPoints(e, next, key, opts) : next;
      });
  }

  if (selection.selected.length === 0)
    return (
      <section aria-labelledby={headingId} className="space-y-2">
        <Heading id={headingId} selection={selection} />
        <ClassCards
          options={options}
          action={(option, close) => (
            <Button
              variant="solid"
              icon="check"
              onClick={() => {
                close();
                chooseFirst(option.key);
              }}
            >
              Choose {option.name}
            </Button>
          )}
        />
      </section>
    );

  const many = selection.selected.length > 1;
  const characterLevel = picked.reduce((sum, option) => sum + levelOf(option), 0);
  return (
    <section aria-label={selection.name} className="space-y-3.5">
      {selection.selected.map((key, index) => {
        const option = optionOf(key);
        const level = levelOf(option);
        const hp = hitPoints[index];
        const method = hp ? methodOf(hp) : "average";
        return (
          <ClassBlock
            key={key}
            selection={selection}
            option={option}
            level={level}
            others={free}
            many={many}
            changeButton={(button) => {
              if (button) changeButtons.current.set(key, button);
              else changeButtons.current.delete(key);
            }}
            levelField={(field) => {
              if (field) levelFields.current.set(key, field);
              else levelFields.current.delete(key);
            }}
            onLevel={(n) => setLevel(key, n, level, method)}
            onReplace={(to) => void replace(key, to)}
            onRemove={() => void remove(key)}
            hitPoints={
              hp && (
                <ClassHitPointsSection
                  name={option.name}
                  hp={hp}
                  method={method}
                  onMethod={(to) => {
                    setChosen((all) => ({ ...all, [key]: to }));
                    run((e, entity, opts) => setHitPointsMethod(e, entity, hp, to, opts));
                  }}
                  onRoll={(levels) => run((e, entity, opts) => rollLevels(e, entity, hp, levels, Math.random, opts))}
                  onType={(path, n) => run((e, entity, opts) => typeHitPoints(e, entity, path, n, opts))}
                />
              )
            }
          />
        );
      })}
      <AddClass options={free} disabled={free.length === 0 || !canAddClass(characterLevel)} onAdd={add} />
      {question}
    </section>
  );
}

/**
 * "Add a class" (spec, "A second class"): a full-width dashed button with the plus icon below the blocks. It opens the
 * cards of the classes that the character does not have in a dialog; a class that the character cannot take is dimmed
 * and shows what it needs. A card opens the modal of the class, with "Add {class}". At the highest character level, or
 * with each class taken, the button is disabled.
 */
function AddClass({ options, disabled, onAdd }: { options: BuilderOption[]; disabled: boolean; onAdd: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="bare"
        icon="plus"
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 border border-dashed border-ink font-sans text-[14px] font-medium hover:bg-panel disabled:border-rule-strong disabled:text-ink-muted disabled:hover:bg-transparent"
      >
        Add a class
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="Add a class" footer={false}>
        {open && (
          <AddClassCards
            options={options}
            onAdd={(key) => {
              setOpen(false);
              onAdd(key);
            }}
          />
        )}
      </Dialog>
    </>
  );
}

/** The cards of the dialog of "Add a class", with what each class that the character cannot take needs. */
function AddClassCards({ options, onAdd }: { options: BuilderOption[]; onAdd: (key: string) => void }) {
  const id = useId();
  const { entity, content } = useOpenCharacter();
  const needs = useMemo(
    () => (entity === null ? new Map<string, string>() : unavailableClasses(engine(), entity, content, options)),
    [entity, content, options],
  );
  return (
    <ClassCards
      options={options}
      needs={needs}
      action={(option, close) => {
        const need = needs.get(option.key);
        const item: ListPanelItem<string> = { value: option.key, label: option.name, ...(need !== undefined && { unavailable: needsReason(need) }) };
        return (
          <ChooseAction
            item={item}
            verb="Add"
            reasonId={`${id}-reason`}
            pickedText={null}
            onChoose={(key) => {
              close();
              onAdd(key);
            }}
          />
        );
      }}
    />
  );
}

interface ClassCardsProps {
  options: BuilderOption[];
  /** The classes that the character cannot take, by key, with what each needs (unavailableClasses): "Str 13". */
  needs?: Map<string, string>;
  /** The button of the modal of a card that makes the pick, with the function that closes the modal. */
  action: (option: BuilderOption, close: () => void) => ReactNode;
}

/**
 * The class cards (spec, "The class cards"): 6 in a row, and 3 in a row when the part is narrower than 560px. A card
 * shows the class icon at 32px and the name; a class with no icon shows the name only, at the same size. A click on a
 * card opens the class in a modal, with the action. The modal gives the focus back to its card when it closes. A class
 * in `needs` cannot be taken: its card is dimmed, with what it needs below the name ("Needs Str 13"), and its card is a
 * little higher for two lines of that text (ORC-351).
 */
export function ClassCards({ options, action, needs }: ClassCardsProps) {
  const id = useId();
  const [shown, setShown] = useState<BuilderOption | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <div className="@container/classes">
      <ul aria-label="Classes" className="grid grid-cols-3 gap-2 @min-[560px]/classes:grid-cols-6">
        {options.map((option) => {
          const icon = classIcon(option.key);
          const need = needs?.get(option.key);
          const needId = `${id}-${option.key}`;
          return (
            <li key={option.key}>
              <Button
                variant="bare"
                data-class-card=""
                data-unavailable={need === undefined ? undefined : ""}
                aria-haspopup="dialog"
                aria-label={need === undefined ? undefined : option.name}
                aria-describedby={need === undefined ? undefined : needId}
                onClick={() => {
                  setShown(option);
                  setOpen(true);
                }}
                className={`grid w-full place-items-center gap-0.5 border border-rule-strong bg-paper-raised px-1 pt-2 pb-1.5 text-center font-sans text-[13.5px] leading-tight font-semibold hover:bg-panel ${needs ? "h-[106px] grid-rows-[36px_auto_26px]" : "h-[92px] grid-rows-[36px_auto_14px]"}`}
              >
                {icon ? <PixelIcon name={icon} className={`me-0 size-8 ${need === undefined ? "" : "opacity-40"}`} /> : <span />}
                <span className={`max-w-full min-w-0 [overflow-wrap:anywhere] ${need === undefined ? "" : "opacity-40"}`}>{option.name}</span>
                <small id={needId} className="self-start text-[10.5px] leading-[1.15] font-medium text-ink-muted">
                  {need === undefined ? "" : needsText(need)}
                </small>
              </Button>
            </li>
          );
        })}
      </ul>
      {shown && <ClassModal option={shown} open={open} onOpenChange={setOpen} action={action(shown, () => setOpen(false))} />}
    </div>
  );
}

/**
 * The modal of a class: the detail of the class (ClassDetail) and, when it has one, the action at the bottom right,
 * such as "Choose Fighter". About opens it with no action.
 */
function ClassModal({
  option,
  open,
  onOpenChange,
  action,
}: {
  option: BuilderOption;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: ReactNode;
}) {
  const pack = useOptionPack(CLASS_TYPE)(option.key);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={option.name} size="narrow" footer={false}>
      <ClassDetail optionKey={option.key} name={option.name} pack={pack} />
      {action && <div className="mt-3 flex items-center justify-end gap-3 border-t border-rule-strong pt-3">{action}</div>}
    </Dialog>
  );
}

interface ClassBlockProps {
  /** The class selection, for the lines of "Picked on other steps". */
  selection: BuilderSelection;
  option: BuilderOption;
  level: number;
  /** The classes that Change can give in the place of this one: those the character does not have. */
  others: BuilderOption[];
  /** The character has two or more classes: the header has Remove and the button that closes or opens the block. */
  many: boolean;
  changeButton: (button: HTMLButtonElement | null) => void;
  levelField: (field: HTMLInputElement | null) => void;
  onLevel: (level: number) => void;
  onReplace: (key: string) => void;
  onRemove: () => void;
  /** The section Hit points. */
  hitPoints: ReactNode;
}

/**
 * A class block (spec, "The class block"): the header has the icon, the name (an h3), the level control, and the ghost
 * buttons About and Change; with two or more classes also Remove and a button that closes or opens the block. A closed
 * block shows its left mark after the name. The body has Choices, Hit points and "Picked on other steps". The parts of
 * the header have fixed places, so a change of level or of class does not move it. The block keeps its closed state
 * while the step is open; with one class it is open, as it has no button to open it.
 */
function ClassBlock({ selection, option, level, others, many, changeButton, levelField, onLevel, onReplace, onRemove, hitPoints }: ClassBlockProps) {
  const nameId = useId();
  const bodyId = useId();
  const icon = classIcon(option.key);
  const [about, setAbout] = useState(false);
  const [changing, setChanging] = useState(false);
  const [closedState, setClosed] = useState(false);
  const closed = many && closedState;
  return (
    <section aria-labelledby={nameId} data-class-block={option.key}>
      <BlockFrame
        closed={closed}
        bodyId={bodyId}
        header={
          <>
            <div className="flex min-w-0 flex-[1_1_12rem] items-center gap-2.5">
              <h3 id={nameId} className="flex min-w-0 items-center gap-2.5 text-[24px] leading-tight font-semibold">
                {icon && <PixelIcon name={icon} className="me-0 size-8" />}
                <span className="min-w-0 truncate">{option.name}</span>
              </h3>
              {closed && <LeftMark left={blockMark(option)} />}
            </div>
            <span className="ml-auto inline-flex flex-wrap items-center gap-x-3 gap-y-1">
              <LevelControl name={option.name} level={level} onLevel={onLevel} field={levelField} />
              <span className="inline-flex items-center gap-0.5">
                <Button variant="ghost" size="small" aria-label={`About ${option.name}`} onClick={() => setAbout(true)}>
                  About
                </Button>
                <Button ref={changeButton} variant="ghost" size="small" aria-label={`Change ${option.name}`} onClick={() => setChanging(true)}>
                  Change
                </Button>
                {many && (
                  <>
                    <Button variant="ghost" size="small" aria-label={`Remove ${option.name}`} onClick={onRemove}>
                      Remove
                    </Button>
                    <Button
                      aria-label={`${closed ? "Open" : "Close"} ${option.name}`}
                      aria-expanded={!closed}
                      aria-controls={bodyId}
                      onClick={() => setClosed(!closed)}
                      className="grid size-[34px] place-items-center p-0 font-sans text-[12px]"
                    >
                      <span aria-hidden="true">{closed ? "▾" : "▴"}</span>
                    </Button>
                  </>
                )}
              </span>
            </span>
          </>
        }
      >
        <BlockSection title="Choices">
          <ClassChoices option={option} />
        </BlockSection>
        {hitPoints}
        <BlockSection title="Picked on other steps">
          <ClassLines selection={selection} classKey={option.key} />
        </BlockSection>
      </BlockFrame>
      <ClassModal option={option} open={about} onOpenChange={setAbout} />
      <Dialog open={changing} onOpenChange={setChanging} title={`Change ${option.name}`} footer={false}>
        <ClassCards
          options={others}
          action={(to, close) => (
            <Button
              variant="solid"
              icon="check"
              onClick={() => {
                close();
                setChanging(false);
                onReplace(to.key);
              }}
            >
              Change to {to.name}
            </Button>
          )}
        />
      </Dialog>
    </section>
  );
}

/** "Picked on other steps" of one class (classStepLines). */
function ClassLines({ selection, classKey }: { selection: BuilderSelection; classKey: string }) {
  const { steps } = useStepFrame();
  const lines = useMemo(() => classStepLines(selection, steps, classKey), [selection, steps, classKey]);
  return <OtherSteps selection={selection} noun="class" lines={lines} />;
}

/**
 * The level control of a class: a minus button, a number field that takes 1 to 20, and a plus button. The buttons have
 * an aria-label. A typed level counts when the field loses the focus, and at Enter, after which the focus stays in the
 * field. Up and Down in the field are the plus and the minus button. The field shows the level of the class: after a
 * typed level that does not count, such as a lower level after Cancel, it shows the level again. An arrow key sets the
 * level from the level of the class, and drops a typed level that did not count yet.
 */
function LevelControl({
  name,
  level,
  onLevel,
  field,
}: {
  name: string;
  level: number;
  onLevel: (level: number) => void;
  field?: (input: HTMLInputElement | null) => void;
}) {
  // The typed level, until it counts. A ref: the field gives it in the same event as the loss of the focus.
  const typed = useRef<number | null>(null);
  // True while an arrow key drops the typed level: the loss of the focus then does not count it.
  const dropTyped = useRef(false);
  // A render after each typed level, so that the field shows the level again.
  const [, setShown] = useState(0);
  const commit = () => {
    const n = dropTyped.current ? null : typed.current;
    dropTyped.current = false;
    typed.current = null;
    setShown((count) => count + 1);
    if (n !== null && n !== level) onLevel(n);
  };
  return (
    <span className="inline-flex items-center gap-1 font-sans text-[13px]">
      <span aria-hidden="true" className="mr-1 font-semibold">
        Level
      </span>
      <Button
        aria-label={`Remove a ${name} level`}
        icon="minus"
        disabled={level <= 1}
        onClick={() => onLevel(level - 1)}
        className="grid size-[34px] place-items-center p-0"
      />
      <label
        ref={(label) => field?.(label?.querySelector("input") ?? null)}
        onBlur={commit}
        onKeyDownCapture={(event) => {
          const field = event.target;
          if (!(field instanceof HTMLInputElement)) return;
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            // The arrow sets the level from the level of the class: a typed level that did not count yet does not count.
            // The loss of the focus makes the field drop its text, and commit drops the level; the focus comes back.
            if (typed.current !== null) {
              dropTyped.current = true;
              field.blur();
              field.focus();
            }
            const next = level + (event.key === "ArrowUp" ? 1 : -1);
            if (next >= 1 && next <= MAX_CLASS_LEVEL) onLevel(next);
          } else if (event.key === "Enter") {
            // The loss of the focus makes the field give its typed level, and commit counts it; the focus comes back.
            field.blur();
            field.focus();
          }
        }}
      >
        <NumberField
          aria-label={`${name} level`}
          min={1}
          max={MAX_CLASS_LEVEL}
          value={level}
          onValueChange={(n) => {
            typed.current = n;
          }}
          className="h-[34px] w-[46px] px-0 text-center font-serif text-[19px] font-medium"
        />
      </label>
      <Button
        aria-label={`Add a ${name} level`}
        icon="plus"
        disabled={level >= MAX_CLASS_LEVEL}
        onClick={() => onLevel(level + 1)}
        className="grid size-[34px] place-items-center p-0"
      />
    </span>
  );
}
