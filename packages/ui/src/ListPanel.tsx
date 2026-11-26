import { Input } from "@base-ui/react/input";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Dialog } from "./Dialog.tsx";
import { LockIcon, PixelIcon, type PixelIconName } from "./Icon.tsx";
import { ListRow } from "./ListRow.tsx";

/** One row of a ListPanel. */
export type ListPanelItem<T> = {
  value: T;
  /** The name. It shows on the row and names the row's button. The `aside` and the `unavailable` text describe the button. */
  label: string;
  /** A short text small at the right of the row, for example the name of the content pack of the option. */
  aside?: string;
  /**
   * Why the option cannot be picked. The row then has the lock icon and a dimmed name, and the text describes its
   * button. A click still shows the option in the panel, where the owner's `action` gives the reason.
   */
  unavailable?: string;
};

/** Where a ListPanel shows the detail of an item: in the panel beside the list, or in the modal of a narrow part. */
export type ListPanelPlace = "panel" | "modal";

export type ListPanelProps<T> = {
  /** The name of the list, for example "Backgrounds". */
  label: string;
  /** The rows, in the order they show. */
  items: readonly ListPanelItem<T>[];
  /**
   * A last row that does not scroll with the list and that the search does not filter, for example an entry that
   * makes a new option. `icon` shows at its start.
   */
  fixedRow?: ListPanelItem<T> & { icon?: PixelIconName };
  /** The value of the row that the panel shows first. The panel then shows it, and its row has the focus at the mount. */
  defaultCurrent?: T | null;
  /** The value of the picked row: it is bold and has the check icon. */
  picked?: T | null;
  /** A search field above the list, which filters by name. `placeholder` gives the count, for example "Search 42 backgrounds". */
  search?: { placeholder: string };
  /** The content of the panel for an item: the name, the text and the facts. It scrolls. In the modal, the title names the item. */
  detail: (item: ListPanelItem<T>, place: ListPanelPlace) => ReactNode;
  /** The row at the bottom of the panel for an item, for example a reason and a Choose button. It does not scroll. */
  action: (item: ListPanelItem<T>, place: ListPanelPlace) => ReactNode;
  /** The text of the panel before a click on a row, for example "Select a background to read about it." */
  emptyText: string;
};

const ROW = ".ui-list-panel-row";

/**
 * A list with a detail panel: the list at the left, 250px wide, and the panel at the right. The two have one fixed
 * height, 440px, so a change of the current row moves nothing. A click on a row shows it in the panel and gives the
 * row `aria-current`; it picks nothing. The owner's `action` row at the bottom of the panel makes the pick.
 *
 * When the part is narrower than 560px, the list has the full width and a height of 400px, the panel does not show,
 * and a click on a row opens the detail in a modal (`Dialog`), with the action in its footer.
 *
 * Tab goes through the rows, and Up and Down, Home and End move between them, as in a `ListModal`. Down in the search
 * field goes to the first row, and Up on the first row goes back to the field.
 */
export function ListPanel<T>({ label, items, fixedRow, defaultCurrent = null, picked = null, search, detail, action, emptyText }: ListPanelProps<T>) {
  const id = useId();
  const [current, setCurrent] = useState<T | null>(defaultCurrent);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const all = fixedRow ? [...items, fixedRow] : items;
  const item = current === null ? undefined : all.find((i) => Object.is(i.value, current));
  const q = search ? query.trim().toLowerCase() : "";
  const shown = q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;

  // The current row has the focus at the mount, for example when the list opens again on the picked option.
  useEffect(() => {
    if (defaultCurrent === null) return;
    root.current?.querySelector<HTMLElement>(`${ROW}[aria-current]`)?.focus();
    // Only at the mount: a later defaultCurrent does not move the focus.
  }, []);

  // A new item starts at the top of the panel.
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 0;
  }, [current]);

  /** True when the part is narrow: the panel does not show, so the detail opens in a modal. */
  const narrow = () => panel.current !== null && getComputedStyle(panel.current).display === "none";

  function show(value: T) {
    setCurrent(value);
    if (narrow()) setModal(true);
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const rows = [...(root.current?.querySelectorAll<HTMLElement>(ROW) ?? [])];
    const target = event.target as HTMLElement;
    const at = rows.indexOf(target);
    const fromSearch = target.classList.contains("ui-list-panel-search") && event.key === "ArrowDown";
    if (rows.length === 0 || (at < 0 && !fromSearch)) return;
    const next = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: rows.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    if (next < 0) root.current?.querySelector<HTMLElement>(".ui-list-panel-search")?.focus();
    else rows[Math.min(next, rows.length - 1)]!.focus();
  };

  const row = (i: ListPanelItem<T>, n: number, icon?: PixelIconName) => {
    const locked = i.unavailable !== undefined;
    const isPicked = picked !== null && Object.is(i.value, picked);
    const reasonId = `${id}-r${n}`;
    const asideId = `${id}-a${n}`;
    const described = [i.aside && asideId, locked && reasonId].filter(Boolean).join(" ");
    return (
      <ListRow
        className="ui-list-panel-row"
        data-unavailable={locked ? "" : undefined}
        data-picked={isPicked ? "" : undefined}
        aria-label={i.label}
        aria-current={current !== null && Object.is(i.value, current) ? "true" : undefined}
        aria-describedby={described || undefined}
        onClick={() => show(i.value)}
      >
        <span className="ui-list-panel-mark">{locked ? <LockIcon /> : isPicked ? <PixelIcon name="check" /> : icon && <PixelIcon name={icon} />}</span>
        <span className="ui-list-panel-name">{i.label}</span>
        {i.aside && (
          <span id={asideId} className="ui-list-panel-aside">
            {i.aside}
          </span>
        )}
        {locked && (
          <span id={reasonId} hidden>
            {i.unavailable}
          </span>
        )}
      </ListRow>
    );
  };

  return (
    <div ref={root} className="ui-list-panel">
      <div className="ui-list-panel-grid">
        <div className="ui-list-panel-list" onKeyDown={onKeyDown}>
          {search && (
            <Input
              type="search"
              aria-label="Search"
              placeholder={search.placeholder}
              autoComplete="off"
              value={query}
              onValueChange={setQuery}
              className="ui-list-panel-search"
            />
          )}
          <div className="ui-list-panel-rows">
            {shown.length === 0 ? (
              <p className="ui-list-none">{items.length > 0 ? "Nothing matches. Try another word." : "Nothing to pick."}</p>
            ) : (
              <ul aria-label={label} className="ui-list-panel-ul">
                {shown.map((i, n) => (
                  <li key={`${n}:${i.label}`}>{row(i, n)}</li>
                ))}
              </ul>
            )}
          </div>
          {fixedRow && <div className="ui-list-panel-fixed">{row(fixedRow, all.length - 1, fixedRow.icon)}</div>}
        </div>
        <section ref={panel} className="ui-list-panel-detail" aria-label={item?.label}>
          {item ? (
            <>
              <div ref={scroll} className="ui-list-panel-scroll">
                {detail(item, "panel")}
              </div>
              <div className="ui-list-panel-act">{action(item, "panel")}</div>
            </>
          ) : (
            <p className="ui-list-panel-empty">{emptyText}</p>
          )}
        </section>
      </div>
      <Dialog open={modal && item !== undefined} onOpenChange={setModal} title={item?.label ?? label} actions={item && action(item, "modal")}>
        {item && detail(item, "modal")}
      </Dialog>
    </div>
  );
}
