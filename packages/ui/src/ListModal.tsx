import { Dialog } from "@base-ui/react/dialog";
import { Input } from "@base-ui/react/input";
import { useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { useRefocus } from "./refocus.ts";

/** One row of a ListModal or one option of a Picker. */
export type ListItem<T> = {
  value: T;
  /** The name. It shows on the row, names the row's button, and is the token's text in a Picker. */
  label: string;
  /** A short example under the name. It describes the row's button. */
  example?: string;
  /** The small heading above the row. Rows of one group must be next to each other. */
  group?: string;
};

type ListModalBase<T> = {
  open: boolean;
  /** Gets false from the X, Done, Escape, a click outside, and a pick that closes the modal. */
  onOpenChange: (open: boolean) => void;
  /** The heading, for example "Add a part". It names the dialog. */
  title: string;
  /** The rows, in the order they show. */
  items: readonly ListItem<T>[];
  /** Gets the value of the row that the user clicks. */
  onPick: (value: T) => void;
  /**
   * The element that gets the focus when the modal closes. By default, the
   * element that had the focus before it opened. A function runs at the
   * close, so it can find an element that the pick made, for example a
   * new token's X when the add button has gone. The rest of the page is
   * still inert then, so find the element with a ref or a DOM query, not
   * by its role.
   */
  finalFocus?: RefObject<HTMLElement | null> | (() => HTMLElement | null);
  /** The line that shows when `items` is empty. */
  emptyText?: string;
};

export type ListModalProps<T> = ListModalBase<T> &
  (
    | {
        /** Not set: a pick closes the modal. The modal has no search and no footer. */
        stayOpen?: false;
        search?: never;
        picked?: never;
        pickedText?: never;
      }
    | {
        /** The modal stays open after a pick. Its footer shows `picked` and a Done button. */
        stayOpen: true;
        /** The number of picks, shown in the footer. */
        picked: number;
        /** The footer text for `picked`, for example `(n) => \`${n} on the form\``. By default it is "3 picked". */
        pickedText?: (picked: number) => string;
        /** A search field above the list. docs/design/homebrew-forms.md, "Picker", gives one to a list of more than about 20 rows. */
        search?: boolean;
      }
  );

const ROW = ".ui-list-row";

/** The rows that match the search text, by name, example or group, in runs of one group. */
function sections<T>(items: readonly ListItem<T>[], query: string) {
  const q = query.trim().toLowerCase();
  const match = (item: ListItem<T>) => !q || [item.label, item.example, item.group].some((text) => text?.toLowerCase().includes(q));
  const runs: { group?: string; rows: ListItem<T>[] }[] = [];
  for (const item of items.filter(match)) {
    const last = runs[runs.length - 1];
    if (last && last.group === item.group) last.rows.push(item);
    else runs.push({ group: item.group, rows: [item] });
  }
  return runs;
}

/**
 * A modal list, with Base UI Dialog inside: a title, a close X, and one
 * list that scrolls. Each row is a button with the name, an optional short
 * example and an "Add" mark. The X, Escape and a click outside close it. On
 * a narrow screen (600px and less) it fills the screen.
 *
 * By default a pick calls `onPick` and closes the modal. With `stayOpen`,
 * the modal stays open: the caller takes the picked row out of `items`, and
 * the focus goes to the next row. Its footer shows the number of picks,
 * which a screen reader reads, and a Done button.
 *
 * The focus goes to the search field, or else to the first row, when the
 * modal opens. Up and Down move between the rows, and Home and End go to
 * the first and last row. The owner sets `open`, so the caller can open
 * and close the modal itself. A Picker uses it this way.
 */
export function ListModal<T>(props: ListModalProps<T>) {
  const { open, onOpenChange, title, finalFocus } = props;
  const popup = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="ui-list-backdrop" />
        <Dialog.Popup
          ref={popup}
          className="ui-list-modal"
          initialFocus={() => popup.current?.querySelector<HTMLElement>(`.ui-list-search, ${ROW}`) ?? true}
          finalFocus={typeof finalFocus === "function" ? () => finalFocus() : (finalFocus ?? true)}
        >
          <div className="ui-list-head">
            <Dialog.Title className="ui-list-title">{title}</Dialog.Title>
            <Dialog.Close aria-label="Close" title="Close" className="ui-x-button" />
          </div>
          <ListBody {...props} popup={popup} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The search field, the rows and the footer. It mounts with the popup, so the search text is new at each open. */
function ListBody<T>({ items, onPick, onOpenChange, emptyText = "Nothing is left to add.", popup, ...props }: ListModalProps<T> & { popup: RefObject<HTMLDivElement | null> }) {
  const [query, setQuery] = useState("");
  const id = useId();
  const refocus = useRefocus(popup, ROW, () => popup.current?.querySelector<HTMLElement>(".ui-list-search, .ui-list-done"));
  const runs = sections(items, props.stayOpen && props.search ? query : "");
  const pick = (value: T) => {
    onPick(value);
    if (!props.stayOpen) onOpenChange(false);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const rows = [...(popup.current?.querySelectorAll<HTMLElement>(ROW) ?? [])];
    const target = event.target as HTMLElement;
    const at = rows.indexOf(target);
    const fromSearch = target.classList.contains("ui-list-search") && event.key === "ArrowDown";
    if (rows.length === 0 || (at < 0 && !fromSearch)) return;
    const next = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: rows.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    if (next < 0) popup.current?.querySelector<HTMLElement>(".ui-list-search")?.focus();
    else rows[Math.min(next, rows.length - 1)]!.focus();
  };
  let row = 0;
  // Stable keys, so a picked row's button unmounts and the focus moves on to the next row; a run's key counts the earlier runs of its group.
  const seen = new Map<string, number>();
  return (
    <>
      {props.stayOpen && props.search && (
        <div className="ui-list-search-row">
          <Input type="search" aria-label="Search" placeholder="Search" autoComplete="off" value={query} onValueChange={setQuery} onKeyDown={onKeyDown} className="ui-input ui-list-search" />
        </div>
      )}
      <div className="ui-list-body" onKeyDown={onKeyDown} onClickCapture={(e) => refocus(e.target)}>
        {runs.length === 0 && <p className="ui-list-none">{items.length > 0 ? "Nothing matches. Try another word." : emptyText}</p>}
        {runs.map((run, r) => {
          const headingId = `${id}-g${r}`;
          const group = run.group ?? "";
          seen.set(group, (seen.get(group) ?? -1) + 1);
          return (
            <div key={`${group}#${seen.get(group)}`}>
              {run.group && (
                <div id={headingId} className="ui-list-group">
                  {run.group}
                </div>
              )}
              <ul className="ui-list" aria-labelledby={run.group ? headingId : undefined}>
                {run.rows.map((item) => {
                  const exampleId = `${id}-e${row++}`;
                  return (
                    <li key={`${item.group ?? ""}:${item.label}`}>
                      <button
                        type="button"
                        className="ui-list-row"
                        data-example={item.example ? "" : undefined}
                        aria-label={item.label}
                        aria-describedby={item.example ? exampleId : undefined}
                        onClick={() => pick(item.value)}
                      >
                        <span className="ui-list-name">{item.label}</span>
                        {item.example && (
                          <span id={exampleId} className="ui-list-example">
                            {item.example}
                          </span>
                        )}
                        <span className="ui-list-add" aria-hidden="true">
                          Add
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      {props.stayOpen && (
        <div className="ui-list-foot">
          <span role="status" className="ui-list-count">
            {(props.pickedText ?? ((n: number) => `${n} picked`))(props.picked)}
          </span>
          <Dialog.Close data-variant="solid" data-size="normal" className="ui-button ui-list-done">
            Done
          </Dialog.Close>
        </div>
      )}
    </>
  );
}
