import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, expect, test } from "vitest";
import { Button } from "./Button.tsx";
import { SmallPopup } from "./SmallPopup.tsx";

afterEach(cleanup);

/** A box with a count, whose button opens a popup with a field and an Add button. Add closes the popup. */
function Counter({ fill = false }: { fill?: boolean }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(3);
  const [entry, setEntry] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  return (
    <div ref={panel}>
      <div ref={box}>
        <SmallPopup
          open={open}
          onOpenChange={setOpen}
          title="Count"
          anchor={box}
          widthOf={fill ? panel : undefined}
          trigger={
            <Button variant="bare" aria-label={`Count, ${count}`}>
              {count}
            </Button>
          }
        >
          <label>
            Amount <input value={entry} onChange={(event) => setEntry(event.target.value)} />
          </label>
          <Button
            onClick={() => {
              setCount((n) => n + Number(entry));
              setOpen(false);
            }}
          >
            Add
          </Button>
        </SmallPopup>
      </div>
      <button type="button">Elsewhere</button>
    </div>
  );
}

const openPopup = async () => {
  const trigger = screen.getByRole("button", { name: /^Count, / });
  trigger.focus();
  fireEvent.click(trigger);
  return { trigger, popup: await screen.findByRole("dialog", { name: "Count" }) };
};

test("the trigger opens the popup with its title and controls, no close button, and the focus on the first field", async () => {
  render(<Counter />);
  const { trigger, popup } = await openPopup();
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(popup.className).toBe("ui-popup");
  expect(within(popup).getByText("Count").className).toBe("ui-popup-title");
  expect(
    within(popup)
      .getAllByRole("button")
      .map((b) => b.textContent),
  ).toEqual(["Add"]);
  await waitFor(() => expect(document.activeElement).toBe(within(popup).getByRole("textbox", { name: "Amount" })));
});

test("an action that closes the popup gives the focus back to the trigger", async () => {
  render(<Counter />);
  const { popup } = await openPopup();
  fireEvent.change(within(popup).getByRole("textbox", { name: "Amount" }), { target: { value: "2" } });
  fireEvent.click(within(popup).getByRole("button", { name: "Add" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const trigger = screen.getByRole("button", { name: "Count, 5" });
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

test("Escape closes the popup, and the focus goes back to the trigger", async () => {
  render(<Counter />);
  const { trigger, popup } = await openPopup();
  await waitFor(() => expect(document.activeElement).toBe(within(popup).getByRole("textbox")));
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

test("a click outside closes the popup", async () => {
  render(<Counter />);
  await openPopup();
  const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
  fireEvent.pointerDown(elsewhere);
  fireEvent.mouseDown(elsewhere);
  fireEvent.click(elsewhere);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("with widthOf, the popup is marked to take the width of that element", async () => {
  render(<Counter fill />);
  const { popup } = await openPopup();
  expect(popup.hasAttribute("data-fill")).toBe(true);
  cleanup();
  render(<Counter />);
  expect((await openPopup()).popup.hasAttribute("data-fill")).toBe(false);
});
