// The class selection of the Class step (ORC-349, docs/design/character-builder.md "The class cards" and "The class
// block"). A character with no class picks its first class from the class cards: a click on a card opens the class in
// a modal, and "Choose {class}" picks it. After the pick, each class is a class block: the header has the icon, the
// name, the level control, About and Change, and the body has the sections that the builder gives it. Change opens the
// cards in a dialog, and the modal of a card there has "Change to {class}". A change of class and a lower level ask
// first when they remove picks (useChangeQuestion, ORC-344).
//
// Until ORC-351 builds "Add a class" and the Remove button of a block, a row below the blocks adds and removes a class
// as the Class step did before.
import { Button, Dialog, NumberField, PixelIcon, Select } from "@orc-alchemy/ui";
import { type ReactNode, type RefObject, useEffect, useId, useMemo, useRef, useState } from "react";
import type { BuilderOption, BuilderSelection } from "../engine/builder.ts";
import { CLASS_TYPE } from "../engine/class-detail.ts";
import { addAClass, addFirstClass } from "../engine/new-character.ts";
import { shownOptions } from "../engine/selection-control.ts";
import { classesOf } from "../engine/strict.ts";
import { useCharacter } from "../state/character.ts";
import { useBuilderStatus } from "./builder-context.tsx";
import { useChangeQuestion } from "./ChangeQuestion.tsx";
import { Heading, useMutation } from "./Classes.tsx";
import { classIcon } from "./class-icons.ts";
import { BlockFrame } from "./MainPick.tsx";
import { ClassDetail, useOptionPack } from "./OptionDetail.tsx";

/** The highest level of a class. */
export const MAX_CLASS_LEVEL = 20;

/** The number of levels of the class option: the picks of its levels selection. */
const levelOf = (option: BuilderOption) => option.selections.find((s) => s.key === "levels")?.selected.length ?? 1;

interface ClassStepProps {
  selection: BuilderSelection;
  /** The sections of the body of the block of a class: today the selections that the class opens on this step. */
  body: (option: BuilderOption) => ReactNode;
}

/**
 * The class selection: the class cards while the character has no class, and else a class block for each class, in the
 * entity's order. After a pick or a change of class, the focus goes to the Change button of the block of the class.
 */
export function ClassStep({ selection, body }: ClassStepProps) {
  const headingId = useId();
  const run = useMutation();
  const say = useBuilderStatus();
  const [change, question] = useChangeQuestion();
  const options = shownOptions(selection);
  const optionOf = (key: string) => selection.options.find((o) => o.key === key)!;
  const free = options.filter((o) => !o.selected);

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
  /** The classes of the stored character, after a change. */
  const storedClasses = () => {
    const entity = useCharacter.getState().entity;
    return entity === null ? [] : classesOf(entity);
  };

  function chooseFirst(key: string) {
    if (run((e, entity, opts) => addFirstClass(e, entity, key, opts))) setFocusClass(key);
  }

  async function replace(from: string, to: string) {
    await change({ kind: "replace-class", from, to }, changeOf(from));
    setFocusClass(storedClasses().includes(to) ? to : from);
  }

  /** Sets the level of the class: up with the engine's addLevel, down through the question of a lower level. */
  function setLevel(key: string, level: number, now: number) {
    if (!Number.isInteger(level) || level < 1 || level > MAX_CLASS_LEVEL) {
      say(`A class level is from 1 to ${MAX_CLASS_LEVEL}.`);
      return;
    }
    if (level < now) void change({ kind: "lower-level", classKey: key, level });
    else if (level > now)
      run((e, entity, opts) => {
        let next = entity;
        for (let n = now; n < level; n++) next = e.addLevel(next, key, opts);
        return next;
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

  return (
    <section aria-label={selection.name} className="space-y-3.5">
      {selection.selected.map((key) => {
        const option = optionOf(key);
        const level = levelOf(option);
        return (
          <ClassBlock
            key={key}
            option={option}
            level={level}
            others={free}
            changeButton={(button) => {
              if (button) changeButtons.current.set(key, button);
              else changeButtons.current.delete(key);
            }}
            onLevel={(n) => setLevel(key, n, level)}
            onReplace={(to) => void replace(key, to)}
          >
            {body(option)}
          </ClassBlock>
        );
      })}
      <AddRemoveRow selection={selection} free={free} />
      {question}
    </section>
  );
}

interface ClassCardsProps {
  options: BuilderOption[];
  /** The button of the modal of a card that makes the pick, with the function that closes the modal. */
  action: (option: BuilderOption, close: () => void) => ReactNode;
}

/**
 * The class cards (spec, "The class cards"): 6 in a row, and 3 in a row when the part is narrower than 560px. A card
 * shows the class icon at 32px and the name; a class with no icon shows the name only, at the same size. A click on a
 * card opens the class in a modal, with the action. The modal gives the focus back to its card when it closes.
 */
export function ClassCards({ options, action }: ClassCardsProps) {
  const [shown, setShown] = useState<BuilderOption | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <div className="@container/classes">
      <ul aria-label="Classes" className="grid grid-cols-3 gap-2 @min-[560px]/classes:grid-cols-6">
        {options.map((option) => {
          const icon = classIcon(option.key);
          return (
            <li key={option.key}>
              <Button
                variant="bare"
                data-class-card=""
                aria-haspopup="dialog"
                onClick={() => {
                  setShown(option);
                  setOpen(true);
                }}
                className="grid h-[92px] w-full grid-rows-[36px_auto_14px] place-items-center gap-0.5 border border-rule-strong bg-paper-raised px-1 pt-2 pb-1.5 text-center font-sans text-[13.5px] leading-tight font-semibold hover:bg-panel"
              >
                {icon ? <PixelIcon name={icon} className="me-0 size-8" /> : <span />}
                <span className="max-w-full min-w-0 [overflow-wrap:anywhere]">{option.name}</span>
                <span />
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
      {action && <div className="mt-3 flex justify-end border-t border-rule-strong pt-3">{action}</div>}
    </Dialog>
  );
}

interface ClassBlockProps {
  option: BuilderOption;
  level: number;
  /** The classes that Change can give in the place of this one: those the character does not have. */
  others: BuilderOption[];
  changeButton: (button: HTMLButtonElement | null) => void;
  onLevel: (level: number) => void;
  onReplace: (key: string) => void;
  /** The sections of the body. */
  children: ReactNode;
}

/**
 * A class block (spec, "The class block"): the header has the icon, the name (an h3), the level control, and the ghost
 * buttons About and Change; the body has the children. The parts of the header have fixed places, so a change of level
 * or of class does not move it.
 */
function ClassBlock({ option, level, others, changeButton, onLevel, onReplace, children }: ClassBlockProps) {
  const nameId = useId();
  const icon = classIcon(option.key);
  const [about, setAbout] = useState(false);
  const [changing, setChanging] = useState(false);
  return (
    <section aria-labelledby={nameId} data-class-block={option.key}>
      <BlockFrame
        header={
          <>
            <h3 id={nameId} className="flex min-w-0 flex-[1_1_12rem] items-center gap-2.5 text-[24px] leading-tight font-semibold">
              {icon && <PixelIcon name={icon} className="me-0 size-8" />}
              <span className="min-w-0 truncate">{option.name}</span>
            </h3>
            <span className="ml-auto inline-flex flex-wrap items-center gap-x-3 gap-y-1">
              <LevelControl name={option.name} level={level} onLevel={onLevel} />
              <span className="inline-flex items-center gap-0.5">
                <Button variant="ghost" size="small" aria-label={`About ${option.name}`} onClick={() => setAbout(true)}>
                  About
                </Button>
                <Button ref={changeButton} variant="ghost" size="small" aria-label={`Change ${option.name}`} onClick={() => setChanging(true)}>
                  Change
                </Button>
              </span>
            </span>
          </>
        }
      >
        {children}
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

/**
 * The level control of a class: a minus button, a number field that takes 1 to 20, and a plus button. The buttons have
 * an aria-label. A typed level counts when the field loses the focus, and at Enter, after which the focus stays in the
 * field. Up and Down in the field are the plus and the minus button. The field shows the level of the class: after a
 * typed level that does not count, such as a lower level after Cancel, it shows the level again.
 */
function LevelControl({ name, level, onLevel }: { name: string; level: number; onLevel: (level: number) => void }) {
  // The typed level, until it counts. A ref: the field gives it in the same event as the loss of the focus.
  const typed = useRef<number | null>(null);
  // A render after each typed level, so that the field shows the level again.
  const [, setShown] = useState(0);
  const commit = () => {
    const n = typed.current;
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
        onBlur={commit}
        onKeyDownCapture={(event) => {
          const field = event.target;
          if (!(field instanceof HTMLInputElement)) return;
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
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

/**
 * The way of the Class step before ORC-349 to add a class and to remove one, until ORC-351 builds "Add a class" and the
 * Remove button of a block: a class to add with "Add class", and with two or more classes a Remove button for each.
 * Removing a class asks first when it removes picks.
 */
function AddRemoveRow({ selection, free }: { selection: BuilderSelection; free: BuilderOption[] }) {
  const run = useMutation();
  const [change, question] = useChangeQuestion();
  const [adding, setAdding] = useState("");
  const toAdd = free.find((o) => o.key === adding) ?? free[0];
  const names = useMemo(() => new Map(selection.options.map((o) => [o.key, o.name])), [selection]);
  const many = selection.selected.length > 1;
  if (!toAdd && !many) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {toAdd && (
        <>
          <Select aria-label="Add a class" value={toAdd.key} options={free.map((o) => [o.key, o.name])} onValueChange={setAdding} />
          <Button icon="plus" onClick={() => run((e, entity, opts) => addAClass(e, entity, toAdd.key, opts))} size="small">
            Add class
          </Button>
        </>
      )}
      {many &&
        selection.selected.map((key) => (
          <Button key={key} icon="trash" size="small" onClick={() => void change({ kind: "remove-class", classKey: key })}>
            Remove {names.get(key)}
          </Button>
        ))}
      {question}
    </div>
  );
}
