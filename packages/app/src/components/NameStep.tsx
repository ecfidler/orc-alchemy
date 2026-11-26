// The Name step (ORC-342, docs/design/character-builder.md, "The Name step"):
// one field, the character name. As a Description field, it keeps its text
// while the user types, and writes it on blur or on Enter (useDraft).
import { FieldLabel, TextInput } from "@orc-alchemy/ui";
import type { KeyboardEvent } from "react";
import { NAME_KEY, setDescription, storedValue } from "../engine/description.ts";
import { useOpenCharacter } from "../state/character.ts";
import { useDraft } from "./use-draft.ts";
import { useMutation } from "./use-mutation.ts";

/**
 * `autoFocus`: the field gets the focus when the step shows, for a new character. `onEnter`: Enter in the field
 * writes the name and then calls it, to go to the Class step. When the write fails, the refusal shows in the status
 * toast, and Enter does not call it: the player stays on the Name step.
 */
export function NameStep({ autoFocus, onEnter }: { autoFocus: boolean; onEnter: () => void }) {
  const { entity } = useOpenCharacter();
  const run = useMutation();
  const stored = entity ? storedValue(entity, NAME_KEY) : "";
  const { text, setText, commit } = useDraft(stored, (text) => run((e, entity) => setDescription(e, entity, NAME_KEY, text)));

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (commit()) onEnter();
  };
  return (
    <div className="space-y-2">
      <FieldLabel label="Character name">
        <TextInput value={text} onValueChange={setText} onBlur={commit} onKeyDown={onKeyDown} autoFocus={autoFocus} />
      </FieldLabel>
    </div>
  );
}
