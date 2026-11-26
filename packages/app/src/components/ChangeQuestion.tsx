// The question before a change that removes picks (ORC-344, docs/design/character-builder.md "A change that removes
// picks"): the ui AlertDialog, with the change in its title, the line "These picks go:" and the list of the picks, and
// the buttons Cancel and the action. A change that removes no pick asks nothing. After the action, the picks go and
// then the engine gets the change, through useMutation, so a refusal shows in the status toast.
import { useConfirm } from "@orc-alchemy/ui";
import type { ReactNode, RefObject } from "react";
import { engine } from "../engine/engine.ts";
import { type PickChange, planChange, type RemovedRow } from "../engine/removed-picks.ts";
import { useCharacter, useCharacterContent } from "../state/character.ts";
import { useBuilderStatus } from "./builder-context.tsx";
import { useMutation } from "./Classes.tsx";

/**
 * The picks that go, as the body of the question: "These picks go:", then the rows by place, the step or the level at
 * the left, and the selection and its picks at the right: "Proficiencies", "Skill Proficiency: Insight, Religion".
 */
export function RemovedPicks({ rows }: { rows: RemovedRow[] }) {
  const places = [...new Set(rows.map((row) => row.place))];
  return (
    <>
      <p className="mb-2">These picks go:</p>
      <dl className="space-y-1 font-sans text-[13.5px] leading-5">
        {places.map((place) => (
          <div key={place} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3">
            <dt className="text-ink-muted">{place}</dt>
            {rows
              .filter((row) => row.place === place)
              .map((row) => (
                <dd key={row.selection} className="col-start-2">
                  {row.selection}: {row.picks.join(", ")}
                </dd>
              ))}
          </div>
        ))}
      </dl>
    </>
  );
}

/**
 * The function that makes a change, and the element of its question; render the element in the component. The
 * function asks first when the change removes picks, and makes it only after the action. Cancel changes nothing. At
 * the close the focus goes to `finalFocus`, or else back to the control that had it when the question opened.
 */
export function useChangeQuestion(): [change: (change: PickChange, finalFocus?: RefObject<HTMLElement | null>) => Promise<void>, dialog: ReactNode] {
  const [confirm, dialog] = useConfirm();
  const [, run] = useMutation();
  const content = useCharacterContent();
  const say = useBuilderStatus();

  async function change(change: PickChange, finalFocus?: RefObject<HTMLElement | null>) {
    const entity = useCharacter.getState().entity;
    if (entity === null) return;
    let plan: ReturnType<typeof planChange>;
    try {
      plan = planChange({ engine: engine(), entity, content }, change);
    } catch (e) {
      say(e instanceof Error ? e.message : String(e));
      return;
    }
    const { question, apply } = plan;
    if (question !== null && !(await confirm(question.title, question.action, undefined, { body: <RemovedPicks rows={question.rows} />, finalFocus }))) return;
    run((_, current) => apply(current));
  }
  return [change, dialog];
}
