// The Class step (ORC-58): the classes and their levels, as the old builder's
// class rows, and the hit points and ability score improvements each level
// asks for. Each change is an engine mutation, as in Selection. It also holds
// useMutation and Heading, which Options in Builder.tsx uses for each selection.
// A refusal of the engine shows in the status toast of the builder (ORC-343).
import { Button, LeftMark, Select, Toggle, ToggleGroup, useConfirm } from "@orc-alchemy/ui";
import { useId, useMemo, useState } from "react";
import type { BuilderSelection } from "../engine/builder.ts";
import { averageHitPoints, type HitPointsMethod, rollHitPoints, storedHitPoints } from "../engine/classes.ts";
import { unqualify } from "../engine/content.ts";
import { type Content, type Engine, engine, type StrictEntity } from "../engine/engine.ts";
import { addAClass } from "../engine/new-character.ts";
import { ABILITIES } from "../engine/sheet.ts";
import { useCharacter, useCharacterContent, useOpenCharacter } from "../state/character.ts";
import { BoundedNumberField } from "./AbilityScores.tsx";
import { useBuilderStatus, useSectionName } from "./builder-context.tsx";

const MAX_LEVEL = 20;

type Mutation = (e: Engine, entity: StrictEntity, options: Content) => StrictEntity;

/**
 * The function that makes an engine mutation with the loaded content. When the engine refuses it, its message shows
 * in the status toast of the builder (docs/design/character-builder.md, "A pick that the character cannot take"): an
 * inline text that comes and goes would move the page. The function returns false after a refusal, and else true.
 */
export function useMutation(): (mutate: Mutation) => boolean {
  const content = useCharacterContent();
  const say = useBuilderStatus();
  return function run(mutate: Mutation) {
    try {
      useCharacter.getState().update((entity) => mutate(engine(), entity, content));
      return true;
    } catch (error) {
      say(error instanceof Error ? error.message : String(error));
      return false;
    }
  };
}

/**
 * The class selection: a row per class, in the entity's order, with its level, and a class to add. A new character
 * has no class (ORC-342): its first class comes with its starting equipment.
 */
export function Classes({ selection }: { selection: BuilderSelection }) {
  const run = useMutation();
  const [adding, setAdding] = useState("");
  const [confirm, confirmDialog] = useConfirm();
  const option = (key: string) => selection.options.find((o) => o.key === key)!;
  const levelOf = (key: string) => option(key).selections.find((s) => s.key === "levels")?.selected.length ?? 1;
  const free = selection.options.filter((o) => !o.selected);
  const toAdd = free.find((o) => o.key === adding) ?? free[0];

  async function replace(index: number, from: string, to: string) {
    const [old, next, levels] = [option(from).name, option(to).name, levelOf(from)];
    if (
      levels > 1 &&
      !(await confirm(
        `Replace ${old} with ${next}? ${old}'s ${levels} levels and their choices are removed, and ${next} starts at level 1. This cannot be undone.`,
        "Replace",
      ))
    )
      return;
    run((e, entity, opts) => e.setClass(entity, index, to, opts));
  }

  async function remove(index: number, key: string) {
    // Removing the first class makes the next one first, at level 1.
    const next = selection.selected[1];
    if (index === 0 && next !== undefined && levelOf(next) > 1) {
      const name = option(next).name;
      const message = `Remove ${option(key).name}? ${name} becomes the first class and returns to level 1, and its other levels and their choices are removed. This cannot be undone.`;
      if (!(await confirm(message, "Remove"))) return;
    }
    run((e, entity, opts) => e.removeClass(entity, key, opts));
  }

  return (
    <>
      {confirmDialog}
      <ol className="space-y-2">
        {selection.selected.map((key, i) => {
          const { name } = option(key);
          const level = levelOf(key);
          return (
            <li key={key} className="flex flex-wrap items-center gap-2">
              <Select
                aria-label={`Class ${i + 1}`}
                value={key}
                options={[option(key), ...free].map((o) => [o.key, o.name])}
                onValueChange={(to) => replace(i, key, to)}
              />
              <span>Level</span>
              <Button
                aria-label={`Remove a ${name} level`}
                disabled={level <= 1}
                onClick={() => run((e, entity, opts) => e.removeLevel(entity, key, opts))}
                size="small"
                icon="minus"
              />
              <span>{level}</span>
              <Button
                aria-label={`Add a ${name} level`}
                disabled={level >= MAX_LEVEL}
                onClick={() => run((e, entity, opts) => e.addLevel(entity, key, opts))}
                size="small"
                icon="plus"
              />
              <Button icon="trash" disabled={selection.selected.length === 1} onClick={() => remove(i, key)} size="small">
                Remove {name}
              </Button>
            </li>
          );
        })}
      </ol>
      {toAdd && (
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Add a class" value={toAdd.key} options={free.map((o) => [o.key, o.name])} onValueChange={setAdding} />
          <Button icon="plus" onClick={() => run((e, entity, opts) => addAClass(e, entity, toAdd.key, opts))} size="small">
            Add class
          </Button>
        </div>
      )}
    </>
  );
}

/**
 * A selection's name and its left mark at the right (docs/design/character-builder.md, "Marks, not sentences"): "2
 * left", "Remove 1" or "Done". The mark has a fixed place, so a pick does not move the heading or change its size.
 * The mark is a part of the heading text: "Languages, 2 left". `mark={false}` gives the heading with no mark, for a
 * part that is no selection with picks, such as an inventory list. When the open step has another section of the same
 * name, the name has the sources of the selection (spec, "Text").
 */
export function Heading({ id, selection, mark = true }: { id: string; selection: BuilderSelection; mark?: boolean }) {
  // On a step with two sections of one name, the name has the source: "Skill Proficiency: Fighter".
  const name = useSectionName(selection);
  return (
    <h3 id={id} className={HEADING_CLASSES}>
      <span className="min-w-0">
        {name}
        {/* A comma for a screen reader: "Languages, 2 left". It is in the line, so no space comes before it. */}
        {mark && <span className="text-[1px] opacity-0">,</span>}
      </span>
      {mark && <LeftMark left={selection.remaining} />}
    </h3>
  );
}

/** The classes of a selection heading: the name at the left, and the mark, when it has one, at the right. */
export const HEADING_CLASSES = "flex items-center gap-3 font-sans text-[15px] font-bold leading-6";

/** A level's hit points: the average or a roll of the class's hit die, or a number typed in. */
export function HitPoints({ selection }: { selection: BuilderSelection }) {
  const id = useId();
  const { entity, sheet } = useOpenCharacter();
  const run = useMutation();
  const { actualPath } = selection;
  // The path is ["class", <class>, "levels", <level>, "hit-points"].
  const die = sheet?.classes.find((c) => c.key === actualPath[1])?.hitDie ?? 0;
  const stored = useMemo(() => storedHitPoints(entity!, actualPath), [entity, actualPath]);
  const write = (method: HitPointsMethod, n: number) => run((e, entity, opts) => e.setField(entity, [...actualPath, method], n, opts));
  const toggle = (method: HitPointsMethod, text: string, n: () => number) => (
    <Toggle value={method} onPressedChange={() => write(method, n())}>
      {text}
    </Toggle>
  );
  return (
    <section aria-labelledby={id} className="space-y-2">
      <Heading id={id} selection={selection} />
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup aria-label="Hit point method" value={stored ? [stored.method] : []} className="flex gap-2">
          {toggle("average", `Average (${averageHitPoints(die)})`, () => averageHitPoints(die))}
          {toggle("roll", `Roll (1d${die})`, () => rollHitPoints(die))}
        </ToggleGroup>
        <BoundedNumberField label="Hit points" min={1} value={stored?.value ?? null} onCommit={(n) => write("manual-entry", n)} />
      </div>
    </section>
  );
}

/** An ability score improvement, such as at fighter level 4 or the half-elf's: picks of each ability, up and down. */
export function Improvements({ selection }: { selection: BuilderSelection }) {
  const id = useId();
  const { sheet } = useOpenCharacter();
  const run = useMutation();
  const { actualPath, max } = selection;
  const full = max !== null && selection.selected.length >= max;
  return (
    <section aria-labelledby={id} className="space-y-2">
      <Heading id={id} selection={selection} />
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ABILITIES.map((ability) => {
          const abbr = ability.toUpperCase();
          const count = selection.selected.filter((key) => unqualify(key) === ability).length;
          const offered = selection.options.some((o) => unqualify(o.key) === ability);
          const total = sheet?.abilities.find((a) => a.ability === ability)?.score ?? 0;
          return (
            <li key={ability} className="text-center">
              <div>{abbr}</div>
              <div className="flex items-center justify-center gap-1">
                <Button
                  aria-label={`Decrease ${abbr}`}
                  disabled={count === 0}
                  onClick={() => run((e, entity, opts) => e.decreaseAbility(entity, actualPath, ability, opts))}
                  size="small"
                  icon="minus"
                />
                <span>+{count}</span>
                <Button
                  aria-label={`Increase ${abbr}`}
                  disabled={!offered || full || total >= 20}
                  onClick={() => run((e, entity, opts) => e.increaseAbility(entity, actualPath, ability, opts))}
                  size="small"
                  icon="plus"
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
