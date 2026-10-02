// The open character (Plan Set 1 doc 04): the entity is the single source of
// truth; built and selections are derived from it with useEvaluation.
import { create } from "zustand";
import { useEvaluation, type StrictEntity } from "../engine/engine.ts";

interface CharacterState {
  entity: StrictEntity | null;
  dirty: boolean;
  /** Opens a character as stored, with no unsaved changes. */
  load: (entity: StrictEntity) => void;
  /** Applies an engine mutation, such as (e) => engine().select(e, path, key). */
  update: (mutate: (entity: StrictEntity) => StrictEntity) => void;
}

export const useCharacter = create<CharacterState>()((set, get) => ({
  entity: null,
  dirty: false,
  load: (entity) => set({ entity, dirty: false }),
  update: (mutate) => {
    const { entity } = get();
    if (entity === null) throw new Error("No character is open");
    set({ entity: mutate(entity), dirty: true });
  },
}));

/** The open character as { entity, built, selections, dirty }; built and selections are null with no character open. */
export function useOpenCharacter() {
  const entity = useCharacter((state) => state.entity);
  const dirty = useCharacter((state) => state.dirty);
  const evaluation = useEvaluation(entity);
  return { entity, built: evaluation?.built ?? null, selections: evaluation?.selections ?? null, dirty };
}
