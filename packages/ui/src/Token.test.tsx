import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { NumberToggle } from "./NumberToggle.tsx";
import { Token, Tokens } from "./Token.tsx";

afterEach(cleanup);

test("a token shows its text, and its X, named Remove {label}, removes it", () => {
  const remove = vi.fn();
  render(<Token label="A basket of ripe pears from the far orchard" onRemove={remove} />);
  const x = screen.getByRole("button", { name: "Remove A basket of ripe pears from the far orchard" });
  expect([x.className, x.dataset.size]).toEqual(["ui-x-button", "small"]);
  fireEvent.click(x);
  expect(remove).toHaveBeenCalledOnce();
});

test("name names the X when the text is short", () => {
  render(<Token label="4" name="Row 4" onRemove={() => {}} />);
  expect(screen.getByRole("button", { name: "Remove Row 4" })).toBeTruthy();
});

test("a token can hold a small control, which keeps its own name", () => {
  const change = vi.fn();
  render(
    <Tokens>
      <Token label="Any melon" onRemove={() => {}}>
        <NumberToggle aria-label="Any melon: how many" size="small" values={[1, 2, 3]} value={1} onValueChange={change} />
      </Token>
    </Tokens>,
  );
  const token = document.querySelector<HTMLElement>(".ui-tokens > .ui-token")!;
  const toggle = within(token).getByRole("group", { name: "Any melon: how many" });
  expect(toggle.dataset.size).toBe("small");
  fireEvent.click(within(toggle).getByRole("button", { name: "3" }));
  expect(change).toHaveBeenCalledWith(3);
  // A click on the control is not a removal, so the focus stays where it is.
  expect(within(token).getByRole("button", { name: "Remove Any melon" })).toBeTruthy();
});
