// The Description step (ORC-61, ORC-352, docs/design/character-builder.md "The Description step"): Alignment first, a
// ui Select, and then the other 18 fields of the old builder's Description tab, as ui TextInput and TextArea with the
// label above the field. Each field keeps its text while the user types, and writes it on blur, or on Enter in a
// one-line field. A write evaluates the whole character, so a keystroke does not write. The character name is on the
// Name step (ORC-342).
import { FieldLabel, LeftMark, Select, TextArea, TextInput } from "@orc-alchemy/ui";
import type { BuilderSelection } from "../engine/builder.ts";
import { DESCRIPTION_FIELDS, type DescriptionField, NAME_KEY, normalized, setDescription, storedValue } from "../engine/description.ts";
import { shownOptions } from "../engine/selection-control.ts";
import { useOpenCharacter } from "../state/character.ts";
import { usePick } from "./SelectionControl.tsx";
import { Comma } from "./selection-heading.tsx";
import { useDraft } from "./use-draft.ts";
import { useMutation } from "./use-mutation.ts";

/** The fields of the Description step: all but the name. */
const FIELDS = DESCRIPTION_FIELDS.filter((field) => field.key !== NAME_KEY);

/** `alignment`: the alignment selection of the character, the first field of the step. */
export function Description({ alignment }: { alignment?: BuilderSelection }) {
  const { entity } = useOpenCharacter();
  const run = useMutation();
  if (!entity) return null;
  return (
    // The one-line fields are three in a row on a step 600px wide or more, and one on a narrower step, as on a phone.
    // The width of the step counts, not that of the page. A text area and a URL, with its image, have the full width.
    <div className="@container/description">
      <div data-fields="" className="grid grid-cols-1 gap-x-[18px] gap-y-3 @min-[600px]/description:grid-cols-3">
        {alignment && <AlignmentField selection={alignment} />}
        {FIELDS.map((field) => (
          <TextField
            key={field.key}
            field={field}
            stored={storedValue(entity, field.key)}
            onCommit={(text) => run((e, entity) => setDescription(e, entity, field.key, text))}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Alignment, a ui Select with the label "Alignment". The left mark of the selection is at the right of the label, in
 * a fixed place, and is a part of the name of the select: "Alignment, 1 left". A pick is a pick of the selection, so a
 * refusal of the engine shows in the status toast.
 */
function AlignmentField({ selection }: { selection: BuilderSelection }) {
  const { replace, dialog } = usePick(selection);
  const current = selection.selected[0] ?? null;
  return (
    <div className="col-span-full">
      <FieldLabel
        label={
          <span className="flex w-64 max-w-full items-center gap-3">
            <span>
              {selection.name}
              <Comma />
            </span>
            <span className="ml-auto flex tracking-normal normal-case">
              <LeftMark left={selection.remaining} />
            </span>
          </span>
        }
      >
        <Select
          value={current}
          options={shownOptions(selection).map((option): [string, string] => [option.key, option.name])}
          onValueChange={(key) => key !== current && replace(current ?? undefined, key)}
          placeholder="Choose"
          className="w-64 max-w-full"
        />
      </FieldLabel>
      {dialog}
    </div>
  );
}

function TextField({ field, stored, onCommit }: { field: DescriptionField; stored: string; onCommit: (text: string) => boolean }) {
  // The field shows the text as stored, so "12.9" becomes "12" for XP, and
  // a text that stores the same value does not write.
  const { text, setText, commit } = useDraft(stored, onCommit, (text) => normalized(field.key, text));
  const wide = field.kind === "textarea" || field.kind === "url";
  return (
    <div className={wide ? "col-span-full space-y-2" : undefined}>
      <FieldLabel label={field.label}>
        {field.kind === "textarea" ? (
          <TextArea value={text} onValueChange={setText} onBlur={commit} rows={3} />
        ) : (
          <TextInput value={text} onValueChange={setText} onBlur={commit} onKeyDown={(event) => event.key === "Enter" && commit()} width="full" />
        )}
      </FieldLabel>
      {field.alt && stored.trim() !== "" && <img src={stored} alt={field.alt} className="h-24 w-24 object-cover" />}
    </div>
  );
}
