// The Rest button of the action row (ORC-318, ORC-319,
// docs/design/sheet-interactivity.md "The Rest button"): a menu of the rests,
// and the dialog of each. The dialogs are in ShortRestDialog.tsx and
// LongRestDialog.tsx; the rules are in engine/rest.ts. The sheet page
// applies a rest as one sheet change.
import { Menu } from "@orc-alchemy/ui";
import { type ReactNode, useRef, useState } from "react";
import { REST_NAMES, type RestAction, type RestKind, restKinds } from "../engine/rest.ts";
import type { Sheet } from "../engine/sheet.ts";
import { DawnDialog, LongRestDialog } from "./LongRestDialog.tsx";
import type { RestDialogProps } from "./RestDialog.tsx";
import { ShortRestDialog } from "./ShortRestDialog.tsx";

export interface RestButtonProps {
  sheet: Sheet;
  /** Applies a rest that the user finished, as one sheet change. */
  onRest: (action: RestAction) => void;
  /** The random source of Roll for me. Math.random by default. */
  random?: () => number;
}

/** The dialog of each entry of the menu. */
const DIALOGS: Record<RestKind, (props: RestDialogProps & { random?: () => number }) => ReactNode> = {
  short: ShortRestDialog,
  long: LongRestDialog,
  dawn: DawnDialog,
};

/**
 * The Rest button of the action row, with the moon icon: a menu of the
 * rests (Dawn only with Dawn uses), and the dialog of each. At the close of
 * a dialog, the focus goes back to the button.
 */
export function RestButton({ sheet, onRest, random }: RestButtonProps) {
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState<RestKind | null>(null);
  // The last entry picked: its dialog stays mounted while it closes.
  const [kind, setKind] = useState<RestKind | null>(null);
  // Each open mounts the dialog again, so it starts with no picks and reads the sheet of now.
  const [opens, setOpens] = useState(0);
  const RestKindDialog = kind && DIALOGS[kind];
  return (
    <>
      <Menu
        label="Rest"
        icon="moon"
        size="normal"
        buttonRef={button}
        items={restKinds(sheet).map((kind) => [kind, REST_NAMES[kind]])}
        onPick={(kind) => {
          setOpens((n) => n + 1);
          setKind(kind);
          setOpen(kind);
        }}
      />
      {RestKindDialog && (
        <RestKindDialog
          key={opens}
          open={open !== null}
          sheet={sheet}
          onCancel={() => setOpen(null)}
          onFinish={(action) => {
            setOpen(null);
            onRest(action);
          }}
          finalFocus={button}
          random={random}
        />
      )}
    </>
  );
}
