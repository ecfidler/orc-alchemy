// The control of a builder selection (ORC-343, docs/design/character-builder.md "The control for each kind of
// selection"): option cards to 6 options, the ui Picker with tokens from 7 options with more than one pick, and a
// Choose button with the ui ListModal from 7 options with one pick. An option that the character cannot take is not
// available, with its reason ("A pick that the character cannot take"). A refusal of the engine shows in the status
// toast, through useMutation. A pick of a race, a subrace or a background that removes picks asks first (ORC-344, "A
// change that removes picks").
import { Button, type ListItem, ListModal, Picker, Toggle, ToggleGroup, Token } from "@orc-alchemy/ui";
import { type ReactNode, type RefObject, useId, useMemo, useRef, useState } from "react";
import type { BuilderOption, BuilderSelection } from "../engine/builder.ts";
import { asksBeforeClassPick } from "../engine/class-choices.ts";
import { engine } from "../engine/engine.ts";
import { controlKind, hasSearch, shownOptions, unavailableOptions } from "../engine/selection-control.ts";
import { useOpenCharacter } from "../state/character.ts";
import { useSectionName, useStepFrame } from "./builder-context.tsx";
import { useChangeQuestion } from "./ChangeQuestion.tsx";
import { useMutation } from "./use-mutation.ts";

/** The reason of each option of the selection that the character cannot take, by option key. */
export function useUnavailable(selection: BuilderSelection): Map<string, string> {
  const { entity, built, content } = useOpenCharacter();
  const { tops, picks } = useStepFrame();
  return useMemo(
    () => (entity === null || built === null ? new Map() : unavailableOptions({ engine: engine(), entity, built, content, tops, picks }, selection)),
    [entity, built, content, tops, picks, selection],
  );
}

// The text of the add button of a picker, by the kind of the selection.
const ADD_LABELS: [tag: string, label: string][] = [
  ["skill-profs", "Add a skill"],
  ["language-profs", "Add a language"],
  ["tool-profs", "Add a tool"],
  ["feats", "Add a feat"],
];

/**
 * The control of the selection, by the rule. The kind is the one of the first render: a selection keeps its control
 * when the number of its options changes while the step is open.
 */
export function SelectionControl({ selection }: { selection: BuilderSelection }) {
  const options = shownOptions(selection);
  const [kind] = useState(() => controlKind(selection, options.length));
  const unavailable = useUnavailable(selection);
  if (kind === "cards") return <OptionCards selection={selection} options={options} unavailable={unavailable} />;
  if (kind === "picker") return <PickerControl selection={selection} options={options} unavailable={unavailable} />;
  return <ChooseControl selection={selection} options={options} unavailable={unavailable} />;
}

type ControlProps = { selection: BuilderSelection; options: BuilderOption[]; unavailable: Map<string, string> };

// The top-level selections whose pick asks first when it removes picks: the race and the background. The subrace
// under a race asks too, and a choice of one pick of a class, such as the subclass (asksBeforeClassPick, ORC-350). The
// class itself asks in the class block. The background and the race have the list with a
// detail panel (MainPick.tsx), which picks with usePick too.
const ASKS_FIRST = ["race", "background"];

/** True when a pick in the selection asks first when it removes picks: a race, a subrace, a background or a choice of a class. */
function asksFirst(selection: BuilderSelection): boolean {
  const { actualPath, multiselect } = selection;
  if (asksBeforeClassPick(selection)) return true;
  if (multiselect) return false;
  if (actualPath.length === 1) return ASKS_FIRST.includes(actualPath[0]);
  return actualPath.length === 3 && actualPath[0] === "race" && actualPath[2] === "subrace";
}

/**
 * Selects the option, or deselects it from a selection that takes more than one pick. A pick of the race, a subrace or
 * the background asks first when it removes picks; `dialog` is the element of that question, for the control to render.
 * `finalFocus` gets the focus when the question closes; without it, the focus goes back to where it was.
 */
export function usePick(
  selection: BuilderSelection,
  finalFocus?: RefObject<HTMLElement | null>,
): {
  select: (key: string) => void;
  deselect: (key: string) => void;
  replace: (old: string | undefined, key: string) => void;
  dialog: ReactNode;
} {
  const run = useMutation();
  const [change, dialog] = useChangeQuestion();
  const { actualPath } = selection;
  const asks = asksFirst(selection);
  const select = (key: string) =>
    asks ? void change({ kind: "pick", path: actualPath, to: key }, finalFocus) : run((e, entity, opts) => e.select(entity, actualPath, key, opts));
  return {
    select,
    deselect: (key: string) => run((e, entity, opts) => e.deselect(entity, actualPath, key, opts)),
    /** The pick of a selection of one pick in the place of the old one. */
    replace: (old: string | undefined, key: string) =>
      asks
        ? select(key)
        : run((e, entity, opts) =>
            e.select(old !== undefined && selection.multiselect ? e.deselect(entity, actualPath, old, opts) : entity, actualPath, key, opts),
          ),
    dialog,
  };
}

/**
 * A selection's option cards: a pick selects the option, or deselects it from a multiselect. A card shows only the
 * name. A card that the character cannot take is disabled, with its name dimmed and the reason small below it. In a
 * selection with an option that has a prerequisite, each card keeps the place of the reason line, so a reason that
 * comes or goes does not move the page.
 */
function OptionCards({ selection, options, unavailable }: ControlProps) {
  const id = useId();
  const { select, deselect, dialog } = usePick(selection);
  // A reason can come and go in this selection, so each card keeps its line.
  const reasonLine = selection.options.some((option) => option.prereqs > 0);

  function pick(option: BuilderOption) {
    if (option.selected && !selection.multiselect) return;
    if (option.selected) deselect(option.key);
    else select(option.key);
  }

  return (
    <>
      <ToggleGroup
        aria-label={selection.name}
        value={options.filter((option) => option.selected).map((option) => option.key)}
        multiple={selection.multiselect}
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {options.map((option, i) => {
          const reason = unavailable.get(option.key);
          const reasonId = `${id}-${i}`;
          return (
            <Toggle
              key={option.key}
              value={option.key}
              disabled={reason !== undefined}
              aria-label={reasonLine ? option.name : undefined}
              aria-describedby={reason !== undefined ? reasonId : undefined}
              onPressedChange={() => pick(option)}
              className="flex h-full w-full flex-col items-start justify-start p-2 text-left"
            >
              <span>{option.name}</span>
              {reasonLine && (
                <span id={reasonId} data-reason="" className="block min-h-4 font-sans text-[12.5px] leading-4 font-normal text-ink-muted">
                  {reason}
                </span>
              )}
            </Toggle>
          );
        })}
      </ToggleGroup>
      {dialog}
    </>
  );
}

/** The options as the rows of a ListModal, with the reason of each one that the character cannot take. */
const listItems = (options: BuilderOption[], unavailable: Map<string, string>): ListItem<string>[] =>
  options.map((option) => {
    const reason = unavailable.get(option.key);
    return { value: option.key, label: option.name, ...(reason !== undefined && { unavailable: reason }) };
  });

/**
 * The ui Picker for a selection of 7 options or more and more than one pick: the picks as tokens, and the add button
 * that opens the list. The token line keeps the place of the lines that the most picks take, about 3 tokens on a
 * line, up to 3 lines, so the first picks do not move the add button or the page below.
 */
function PickerControl({ selection, options, unavailable }: ControlProps) {
  const { select, deselect, dialog } = usePick(selection);
  const name = useSectionName(selection);
  const label = ADD_LABELS.find(([tag]) => selection.tags.includes(tag))?.[1] ?? "Add a choice";
  const reserve = Math.min(3, Math.max(1, Math.ceil((selection.max ?? 3) / 3)));
  return (
    <>
      <Picker
        label={label}
        title={name}
        options={listItems(options, unavailable)}
        value={selection.selected}
        onValueChange={(next) => {
          const added = next.find((key) => !selection.selected.includes(key));
          const removed = selection.selected.find((key) => !next.includes(key));
          if (added !== undefined) select(added);
          else if (removed !== undefined) deselect(removed);
        }}
        search={hasSearch(options.length)}
        reserve={reserve}
      />
      {dialog}
    </>
  );
}

/**
 * A selection of 7 options or more and one pick: a Choose button that opens the ui ListModal with the mark "Choose".
 * After the pick, the row shows the pick as a token and a Change button. The row has one height in both states, and
 * the button is the same element, so the focus comes back to it after the pick.
 */
function ChooseControl({ selection, options, unavailable }: ControlProps) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  // The list closes on the pick, so the question gives the focus to the button after it.
  const { replace, dialog } = usePick(selection, button);
  const name = useSectionName(selection);
  const current = options.find((option) => option.selected);
  // A selection of one pick that has more than one, as an imported character can, shows each.
  const picked = options.filter((option) => option.selected);
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-2">
      {picked.map((option) => (
        <Token key={option.key} label={option.name} />
      ))}
      <Button ref={button} aria-haspopup="dialog" aria-expanded={open} aria-label={current ? `Change ${name}` : `Choose ${name}`} onClick={() => setOpen(true)}>
        {current ? "Change" : "Choose"}
      </Button>
      <ListModal
        open={open}
        onOpenChange={setOpen}
        title={name}
        items={listItems(
          options.filter((option) => !option.selected),
          unavailable,
        )}
        onPick={(key) => replace(current?.key, key)}
        mark="Choose"
        search={hasSearch(options.length)}
        finalFocus={button}
      />
      {dialog}
    </div>
  );
}
