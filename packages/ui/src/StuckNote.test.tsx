import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { FramedBox } from "./Paper.tsx";
import { StuckNote } from "./StuckNote.tsx";

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
