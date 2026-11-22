// The note of a failed save (docs/design/spells-panel.md "A failed save"). The
// shell shows it at the top of the app, and the Spells panel shows it under
// its header with a "Try again" button. The two use this part, so the text
// has one home.
import { AlertNote, Button } from "@orc-alchemy/ui";
import { useStorage } from "../storage/characters.ts";

/**
 * True while the note of a failed save shows: a save failed, and the storage
 * is not in memory and not outdated. In those two states the shell shows its
 * own note, which tells the user what to do.
 */
export function useSaveFailed(): boolean {
  return useStorage((state) => state.failed && !state.inMemory && !state.outdated);
}

/** The alert note of a failed save. With `onRetry` it has a "Try again" button, which saves again. */
export function SaveFailedNote({ onRetry }: { onRetry?: () => void }) {
  return (
    <AlertNote tone="failed">
      <b>Saving to this browser failed.</b> Recent changes may not be kept.
      {onRetry && (
        <>
          {" "}
          <Button variant="link" onClick={onRetry}>
            Try again
          </Button>
        </>
      )}
    </AlertNote>
  );
}
