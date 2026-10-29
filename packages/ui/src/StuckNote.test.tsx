import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { FramedBox } from "./Paper.tsx";
import { NoteCount, StuckNote } from "./StuckNote.tsx";

afterEach(cleanup);

// The app's e2e/stuck-note.spec.ts measures in a browser that the note does not cover the box's content.
test("a stuck note is a note above its box, and a button in it is its action", () => {
  const fix = vi.fn();
  render(
    <StuckNote
      note={
        <>
          1 row is missing.{" "}
          <button type="button" onClick={fix}>
            Fix it
          </button>
        </>
      }
    >
      <FramedBox label="Rows">
        <p>Row A</p>
      </FramedBox>
    </StuckNote>,
  );
  const note = screen.getByRole("note");
  expect(note.className).toBe("ui-stuck-note");
  expect(note.textContent).toBe("1 row is missing. Fix it");
  // The note comes first, so it takes its own space above the box.
  expect(note.nextElementSibling).toBe(screen.getByRole("group", { name: "Rows" }));
  expect(note.parentElement!.className).toBe("ui-stuck");
  // The paper is inside the note, so the note's shadow is not clipped with the paper's corner.
  expect(note.firstElementChild!.className).toBe("ui-stuck-note-paper");
  fireEvent.click(screen.getByRole("button", { name: "Fix it" }));
  expect(fix).toHaveBeenCalledOnce();
});

test("a note count is a mark only: a screen reader gets the count from the words beside it", () => {
  render(
    <button type="button">
      Rows<span className="sr-only"> (2 to do)</span>
      <NoteCount>2</NoteCount>
    </button>,
  );
  const count = screen.getByText("2");
  expect(count.className).toBe("ui-note-count");
  expect(count.getAttribute("aria-hidden")).toBe("true");
  // The name has no "2" from the count. (jsdom drops the space at the start of an inline span.)
  expect(screen.getByRole("button", { name: /^Rows ?\(2 to do\)$/ })).toBeTruthy();
});

test("with no note, the box shows alone, and a note that comes and goes keeps the same box element", () => {
  const box = (
    <FramedBox label="Rows">
      <p>Row A</p>
    </FramedBox>
  );
  const { rerender } = render(<StuckNote note="1 row is missing.">{box}</StuckNote>);
  const element = screen.getByRole("group", { name: "Rows" });
  rerender(<StuckNote note={null}>{box}</StuckNote>);
  expect(screen.queryByRole("note")).toBeNull();
  expect(screen.getByRole("group", { name: "Rows" })).toBe(element);
  rerender(<StuckNote note="1 row is missing.">{box}</StuckNote>);
  expect(screen.getByRole("note").textContent).toBe("1 row is missing.");
  expect(screen.getByRole("group", { name: "Rows" })).toBe(element);
});
