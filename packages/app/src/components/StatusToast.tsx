// The status toast of the sheet page (ORC-326, docs/design/sheet-interactivity.md
// "The status toast"): the text of the last action, and the concentration note
// after Damage with a concentration mark (ORC-322). It is at the bottom of the
// screen and takes no space in the sheet, so a text that comes and goes moves
// nothing. The route gives the text and the note in the play props.
import { Toast } from "@orc-alchemy/ui";
import { concentrationNoteText } from "../engine/conditions.ts";
import type { SheetPlay } from "../engine/sheet.ts";
import { useMarkName } from "./ConditionsBox.tsx";

export function StatusToast({ play }: { play: Pick<SheetPlay, "status" | "statusKey" | "concentrationNote" | "onDismissNote"> }) {
  const note = play.concentrationNote ?? null;
  const name = useMarkName(note?.spell ?? "");
  const onDismiss = play.onDismissNote;
  return (
    <Toast
      status={play.status}
      statusKey={play.statusKey ?? 0}
      noteName="Concentration note"
      note={
        note && onDismiss
          ? { text: concentrationNoteText(name, note.dc), action: { label: "Dismiss", name: "Dismiss the concentration note", onClick: onDismiss } }
          : null
      }
    />
  );
}
