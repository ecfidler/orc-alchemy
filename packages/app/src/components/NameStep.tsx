// The Name step (ORC-342, docs/design/character-builder.md, "The Name step"):
// one field, the character name. As a Description field, it keeps its text
// while the user types, and writes it on blur or on Enter.
import { FieldLabel, TextInput } from "@orc-alchemy/ui";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { NAME_KEY, setDescription, storedValue } from "../engine/description.ts";
import { useOpenCharacter } from "../state/character.ts";
import { useMutation } from "./Classes.tsx";

/**
 * `autoFocus`: the field gets the focus when the step shows, for a new character. `onEnter`: Enter in the field
 * writes the name and then calls it, to go to the Class step.
 */
export function NameStep({ autoFocus, onEnter }: { autoFocus: boolean; onEnter: () => void }) {
  const { entity } = useOpenCharacter();
  const [error, run] = useMutation();
  const stored = entity ? storedValue(entity, NAME_KEY) : "";
  const [text, setText] = useState(stored);
  const [seen, setSeen] = useState(stored);
  // A name changed from elsewhere replaces the text.
  if (stored !== seen) {
    setSeen(stored);
    setText(stored);
  }
  const field = useRef<HTMLDivElement>(null);
  // Read only at the start, so a later render does not take the focus again.
  const focusAtStart = useRef(autoFocus);
  useEffect(() => {
    if (focusAtStart.current) field.current?.querySelector("input")?.focus();
  }, []);

  const commit = () => {
    if (text !== stored) run((e, entity) => setDescription(e, entity, NAME_KEY, text));
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commit();
    onEnter();
  };
  return (
    <div className="space-y-2">
      {error && <p role="alert">{error}</p>}
      {/* The wrapper takes the blur and the Enter of the field, which TextInput does not take as props. */}
      <div ref={field} onBlur={commit} onKeyDown={onKeyDown}>
        <FieldLabel label="Character name">
          <TextInput value={text} onValueChange={setText} />
        </FieldLabel>
      </div>
    </div>
  );
}
