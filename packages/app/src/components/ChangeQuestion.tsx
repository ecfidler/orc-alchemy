// The question before a change that removes picks (ORC-344, docs/design/character-builder.md "A change that removes
// picks"): the ui AlertDialog, with the change in its title, the line "These picks go:" and the list of the picks, and
// the buttons Cancel and the action. A change that removes no pick asks nothing. After the action, the picks go and
// then the engine gets the change, through useMutation, so a refusal shows in the status toast. When the character
// changed while the question was open, the change is planned again for it, and it is made only when it removes no
// pick that the question did not list.
import { useConfirm } from "@orc-alchemy/ui";
import type { ReactNode, RefObject } from "react";
import { engine } from "../engine/engine.ts";
import { type ChangePlan, type PickChange, planChange, type RemovedRow } from "../engine/removed-picks.ts";
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
  const run = useMutation();
  const content = useCharacterContent();
  const say = useBuilderStatus();

  /** The plan of the change for the stored character, or null when there is no character or the plan throws. */
  function plan(change: PickChange): ChangePlan | null {
    const entity = useCharacter.getState().entity;
    if (entity === null) return null;
    try {
      return planChange({ engine: engine(), entity, content }, change);
    } catch (e) {
      say(e instanceof Error ? e.message : String(e));
      return null;
    }
  }

  async function change(change: PickChange, finalFocus?: RefObject<HTMLElement | null>) {
    const first = plan(change);
    if (first === null) return;
    const { question } = first;
    if (question !== null && !(await confirm(question.title, question.action, undefined, { body: <RemovedPicks rows={question.rows} />, finalFocus }))) return;
    // The stored character can change while the question is open: then the plan is made again for it.
    let chosen = first;
    if (useCharacter.getState().entity !== first.entity) {
      const next = plan(change);
      const listed = new Set(first.removed.map((path) => path.join("/")));
      // The player did not agree to a pick that the question did not list.
      if (next === null || next.removed.some((path) => !listed.has(path.join("/")))) return;
      chosen = next;
    }
    run(() => chosen.apply());
  }
  return [change, dialog];
}
