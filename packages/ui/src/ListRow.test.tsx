import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { ListRow } from "./ListRow.tsx";

afterEach(cleanup);

test("a list row is a button of type button with the row class, takes layout classes and ARIA state, and gives a ref", () => {
  const onClick = vi.fn();
  const ref = createRef<HTMLButtonElement>();
  render(
    <ListRow ref={ref} aria-current="true" tabIndex={-1} data-row="north" className="px-2" onClick={onClick}>
      <span>North map</span>
      <span>Tag</span>
    </ListRow>,
  );
  const row = screen.getByRole("button", { name: /^North map ?Tag$/ });
  expect(ref.current).toBe(row);
  // src/picker.css: a current row has the ink fill, paper text and a paper focus ring.
  expect([row.className, row.getAttribute("type"), row.getAttribute("aria-current"), row.tabIndex, row.dataset.row]).toEqual([
    "ui-list-row px-2",
    "button",
    "true",
    -1,
    "north",
  ]);
  fireEvent.click(row);
  expect(onClick).toHaveBeenCalledOnce();
});
