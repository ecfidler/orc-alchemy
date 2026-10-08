// The Description step (ORC-61): the old builder's Description tab. Each
// field keeps its text while the user types, and writes it on blur, or on
// Enter in a one-line field. A write evaluates the whole character, so a
// keystroke does not write.
import { useId, useState } from "react";
import { DESCRIPTION_FIELDS, normalized, setDescription, storedValue, type DescriptionField } from "../engine/description.ts";
import { useOpenCharacter } from "../state/character.ts";
import { useMutation } from "./Classes.tsx";

export function Description() {
  const { entity } = useOpenCharacter();
  const [error, run] = useMutation();
  if (!entity) return null;
  return (
    <div className="space-y-3">
      {error && <p role="alert">{error}</p>}
      {DESCRIPTION_FIELDS.map((field) => (
        <TextField
          key={field.key}
          field={field}
          stored={storedValue(entity, field.key)}
          onCommit={(text) => run((e, entity) => setDescription(e, entity, field.key, text))}
        />
      ))}
    </div>
  );
}

function TextField({ field, stored, onCommit }: { field: DescriptionField; stored: string; onCommit: (text: string) => void }) {
  const id = useId();
  const [text, setText] = useState(stored);
  const [seen, setSeen] = useState(stored);
  // A value changed from elsewhere replaces the text.
  if (stored !== seen) {
    setSeen(stored);
    setText(stored);
  }
  // The field shows the text as stored, so "12.9" becomes "12" for XP, and
  // a text that stores the same value does not write.
  const commit = () => {
    const value = normalized(field.key, text);
    setText(value);
    if (value !== stored) onCommit(text);
  };
  const props = {
    id,
    value: text,
    onChange: (event: { target: { value: string } }) => setText(event.target.value),
    onBlur: commit,
    className: "w-full border border-black px-2 py-1",
  };
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block font-bold">
        {field.label}
      </label>
      {field.kind === "textarea" ? (
        <textarea rows={3} {...props} />
      ) : (
        <input type={field.kind} {...props} onKeyDown={(event) => event.key === "Enter" && commit()} />
      )}
      {field.alt && stored.trim() !== "" && <img src={stored} alt={field.alt} className="h-24 w-24 object-cover" />}
    </div>
  );
}
