// The parts of the builder that each selection uses (ORC-58): useMutation, which makes an engine mutation, and Heading,
// the name and the left mark of a selection, and the hit points that each level of a class asks for. The class cards
// and the class blocks of the Class step are in ClassStep.tsx (ORC-349). The ability score improvements are on the
// Abilities step (AbilityScores.tsx). A refusal of the engine shows in the status toast of the builder (ORC-343).
import { LeftMark, Toggle, ToggleGroup } from "@orc-alchemy/ui";
import { useId, useMemo } from "react";
import type { BuilderSelection } from "../engine/builder.ts";
import { averageHitPoints, type HitPointsMethod, rollHitPoints, storedHitPoints } from "../engine/classes.ts";
import { type Content, type Engine, engine, type StrictEntity } from "../engine/engine.ts";
import { useCharacter, useCharacterContent, useOpenCharacter } from "../state/character.ts";
import { BoundedNumberField } from "./AbilityScores.tsx";
import { useBuilderStatus, useSectionLevel, useSectionName } from "./builder-context.tsx";

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
 * A selection's name and its left mark at the right (docs/design/character-builder.md, "Marks, not sentences"): "2
 * left", "Remove 1" or "Done". The mark has a fixed place, so a pick does not move the heading or change its size.
 * The mark is a part of the heading text: "Languages, 2 left". `mark={false}` gives the heading with no mark, for a
 * part that is no selection with picks, such as an inventory list. When the open step has another section of the same
 * name, the name has the sources of the selection (spec, "Text"). `name` replaces the name, for a section that names
 * its source in its own way, such as "Ability Score Improvement: Fighter 4". The heading is an h3, or an h4 under a
 * group heading (useSectionLevel).
 */
export function Heading({ id, selection, mark = true, name: own }: { id: string; selection: BuilderSelection; mark?: boolean; name?: string }) {
  // On a step with two sections of one name, the name has the source: "Skill Proficiency: Fighter".
  const sectionName = useSectionName(selection);
  const name = own ?? sectionName;
  const H = useSectionLevel() === 4 ? "h4" : "h3";
  return (
    <H id={id} className={HEADING_CLASSES}>
      <span className="min-w-0">
        {name}
        {/* A comma for a screen reader: "Languages, 2 left". It is in the line, so no space comes before it. */}
        {mark && <span className="text-[1px] opacity-0">,</span>}
      </span>
      {mark && <LeftMark left={selection.remaining} />}
    </H>
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
