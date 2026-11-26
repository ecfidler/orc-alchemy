import type { KeyboardEvent } from "react";

/**
 * The keys of a list with a search field, as a ListModal and a ListPanel have them. Up and Down move between the rows
 * (the elements in `container` that match `rowSelector`), and Home and End go to the first and the last row. Down in
 * the search field (the element with the class `searchClass`) goes to the first row, and Up on the first row goes back
 * to the field. Call it from the onKeyDown of the element that holds the rows.
 */
export function moveInList(event: KeyboardEvent, container: HTMLElement | null, rowSelector: string, searchClass: string): void {
  const rows = [...(container?.querySelectorAll<HTMLElement>(rowSelector) ?? [])];
  const target = event.target as HTMLElement;
  const at = rows.indexOf(target);
  const fromSearch = target.classList.contains(searchClass) && event.key === "ArrowDown";
  if (rows.length === 0 || (at < 0 && !fromSearch)) return;
  const next = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: rows.length - 1 }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  if (next < 0) container?.querySelector<HTMLElement>(`.${searchClass}`)?.focus();
  else rows[Math.min(next, rows.length - 1)]!.focus();
}

/**
 * The line of a list that shows no row: "Nothing matches. Try another word." when the list has items and the search
 * finds none of them, else `emptyText`.
 */
export function ListNone({ hasItems, emptyText }: { hasItems: boolean; emptyText: string }) {
  return <p className="ui-list-none">{hasItems ? "Nothing matches. Try another word." : emptyText}</p>;
}
