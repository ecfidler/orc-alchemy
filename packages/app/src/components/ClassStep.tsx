// The class selection of the Class step (ORC-349, ORC-351, docs/design/character-builder.md "The class cards", "The
// class block" and "A second class"). A character with no class picks its first class from the class cards: a click on
// a card opens the class in a modal, and "Choose {class}" picks it. After the pick, each class is a class block: the
// header has the icon, the name, the level control, About and Change, and with two or more classes Remove and a button
// that closes or opens the block. The body has Choices (ORC-350), Hit points and "Picked on other steps". Change opens
// the cards in a dialog, and the modal of a card there has "Change to {class}". "Add a class" below the blocks opens the
// cards of the other classes, and the modal has "Add {class}". A change of class, a lower level and Remove ask first
// when they remove picks (useChangeQuestion, ORC-344).
import { Button, Dialog, LeftMark, type ListPanelItem, PixelIcon } from "@orc-alchemy/ui";
import { type ReactNode, type RefObject, useEffect, useId, useMemo, useRef, useState } from "react";
import type { BuilderOption, BuilderSelection } from "../engine/builder.ts";
import {
  blockMark,
  type ClassNeeds,
  canAddClass,
  characterLevel,
  classLevel,
  classStepLines,
  levelRefusal,
  needsReason,
  raiseLevel,
  unavailableClasses,
} from "../engine/class-block.ts";
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
import { useOpenCharacter } from "../state/character.ts";
import { useBuilderStatus, useStepFrame } from "./builder-context.tsx";
import { useChangeQuestion } from "./ChangeQuestion.tsx";
import { ClassCards, ClassModal } from "./ClassCards.tsx";
import { ClassChoices } from "./ClassChoices.tsx";
import { ClassHitPointsSection } from "./ClassHitPoints.tsx";
import { classIcon } from "./class-icons.ts";
import { LevelControl } from "./LevelControl.tsx";
import { BlockFrame, BlockSection, ChooseAction, OtherSteps } from "./MainPick.tsx";
import { Heading } from "./selection-heading.tsx";
import { useMutation } from "./use-mutation.ts";

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

  function chooseFirst(key: string) {
    if (run((e, entity, opts) => addFirstClass(e, entity, key, opts))) setFocusClass(key);
  }

  /** Adds a second class at level 1, with the average hit points (the method of a new class is Average). */
  function add(key: string) {
    if (run((e, entity, opts) => withAverageHitPoints(e, addAClass(e, entity, key, opts), key, opts))) setFocusClass(key);
  }

  async function replace(from: string, to: string) {
    // A new class that is not the first gets the average hit points in the same change (replaceClass).
    const changed = await change({ kind: "replace-class", from, to }, changeOf(from));
    setFocusClass(changed ? to : from);
  }

  /** Removes the class; then the focus goes to the Change button of the next block, or of the one before the last. */
  async function remove(key: string) {
    const list = selection.selected;
    const at = list.indexOf(key);
    const stays = list[at + 1] ?? list[at - 1];
    // After Cancel, the focus goes back to the Remove button.
    if (await change({ kind: "remove-class", classKey: key })) setFocusClass(stays);
  }

  /** Lowers the class to the level. At level 1 the minus button is disabled, so after the change the focus goes to the field. */
  async function lower(key: string, level: number) {
    if ((await change({ kind: "lower-level", classKey: key, level })) && level === 1) levelFields.current.get(key)?.focus();
  }

  /**
   * Sets the level of the class: up with raiseLevel, down through the question of a lower level. A level that the
   * class cannot have (levelRefusal) shows its reason in the status toast and changes nothing.
   */
  function setLevel(key: string, level: number, now: number, method: ClassHitPointsMethod) {
    const refusal = levelRefusal(picked, key, level);
    if (refusal !== null) say(refusal);
    else if (level < now) void lower(key, level);
    else if (level > now) run((e, entity, opts) => raiseLevel(e, entity, key, now, level, method, opts));
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
  return (
    <section aria-label={selection.name} className="space-y-3.5">
      {selection.selected.map((key, index) => {
        const option = optionOf(key);
        const level = classLevel(option);
        const hp = hitPoints[index];
        const method = hp ? methodOf(hp) : "average";
        return (
          <ClassBlock
            key={key}
            selection={selection}
            option={option}
            level={level}
            canRaise={levelRefusal(picked, key, level + 1) === null}
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
                  onMethod={(to, kept) => {
                    setChosen((all) => ({ ...all, [key]: to }));
                    run((e, entity, opts) => setHitPointsMethod(e, entity, hp, to, opts, kept));
                  }}
                  onRoll={(levels) => run((e, entity, opts) => rollLevels(e, entity, hp, levels, Math.random, opts))}
                  onType={(path, n) => run((e, entity, opts) => typeHitPoints(e, entity, path, n, opts))}
                />
              )
            }
          />
        );
      })}
      <AddClass options={free} disabled={free.length === 0 || !canAddClass(characterLevel(picked))} onAdd={add} />
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
    () => (entity === null ? new Map<string, ClassNeeds>() : unavailableClasses(engine(), entity, content, options)),
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

interface ClassBlockProps {
  /** The class selection, for the lines of "Picked on other steps". */
  selection: BuilderSelection;
  option: BuilderOption;
  level: number;
  /** The class can have one more level: the plus button is enabled. */
  canRaise: boolean;
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
function ClassBlock({ selection, option, level, canRaise, others, many, changeButton, levelField, onLevel, onReplace, onRemove, hitPoints }: ClassBlockProps) {
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
              <LevelControl name={option.name} level={level} canRaise={canRaise} onLevel={onLevel} field={levelField} />
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
