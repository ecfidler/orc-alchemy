// useMutation (ORC-58), which makes an engine mutation on the open character with the loaded content. A refusal of the
// engine shows in the status toast of the builder (ORC-343). usePendingMutation (ORC-369) makes it after the next
// paint, so the button that started it shows that it is busy first.
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { type Content, type Engine, engine, type StrictEntity } from "../engine/engine.ts";
import { useCharacter, useCharacterContent } from "../state/character.ts";
import { useBuilderStatus } from "./builder-context.tsx";

export type Mutation = (e: Engine, entity: StrictEntity, options: Content) => StrictEntity;

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

/** Calls `then` after the browser paints the next frame: a timeout from the frame callback runs after its paint. */
function afterPaint(then: () => void) {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => setTimeout(then, 0));
  else setTimeout(then, 0);
}

/**
 * A mutation that starts from a button and can take more than a frame, such as a pick (docs/design/character-builder.md,
 * "A pick that is on its way"). `later(id, mutate)` adds `id` to `pending` at once, and makes the mutation after the
 * next paint, so the button can show that it is busy before the work starts. The mutation and the end of `pending`
 * come in one render, so the button stops being busy when the result shows. Each id stays in `pending` until its own
 * mutation is made, also when the user starts another one in the same frame. A second call with an id that is still
 * pending does nothing, so a double click picks once. With `defer` false, `later` makes the mutation at once, for a
 * control that has no busy look, and `pending` stays empty.
 */
export function usePendingMutation(defer = true): { pending: ReadonlySet<string>; later: (id: string, mutate: Mutation) => void } {
  const run = useMutation();
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const queued = useRef(new Set<string>());
  function later(id: string, mutate: Mutation) {
    if (!defer) {
      run(mutate);
      return;
    }
    if (queued.current.has(id)) return;
    queued.current.add(id);
    setPending((now) => new Set(now).add(id));
    afterPaint(() =>
      // In one render before the next input, so a click after it sees the new picks.
      flushSync(() => {
        queued.current.delete(id);
        run(mutate);
        setPending((now) => {
          const next = new Set(now);
          next.delete(id);
          return next;
        });
      }),
    );
  }
  return { pending, later };
}
