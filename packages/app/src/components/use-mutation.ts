// useMutation (ORC-58), which makes an engine mutation on the open character with the loaded content. A refusal of the
// engine shows in the status toast of the builder (ORC-343).
import { type Content, type Engine, engine, type StrictEntity } from "../engine/engine.ts";
import { useCharacter, useCharacterContent } from "../state/character.ts";
import { useBuilderStatus } from "./builder-context.tsx";

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
