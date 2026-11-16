import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
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

test("with onOpen the text is a button with its own name and a hint; removeName names the X; a marked token says so in its data", () => {
  const openSlot = vi.fn();
  const putBack = vi.fn();
  render(<Token label="Plums" onOpen={openSlot} openName="Change basket Plums" openHint="Change" removeName="Put back Pears" onRemove={putBack} marked />);
  const button = screen.getByRole("button", { name: "Change basket Plums" });
  expect([button.className, button.textContent]).toEqual(["ui-token-label ui-token-open", "PlumsChange"]);
  expect(button.querySelector(".ui-token-hint")?.getAttribute("aria-hidden")).toBe("true");
  fireEvent.click(button);
  expect(openSlot).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Put back Pears" }));
  expect(putBack).toHaveBeenCalledOnce();
  expect(document.querySelector<HTMLElement>(".ui-token")!.dataset.marked).toBe("");
});

test("a token without onRemove has no X, and is not marked unless marked is set", () => {
  render(<Token label="Apples" onOpen={() => {}} />);
  expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Apples"]);
  expect(document.querySelector<HTMLElement>(".ui-token")!.dataset.marked).toBeUndefined();
});

test("when a click on an X takes the X away and the token stays, the focus goes to the token's text button", () => {
  function Slots() {
    const [values, setValues] = useState(["Plums", "Melons"]);
    const first = ["Pears", "Apples"];
    return (
      <Tokens>
        {values.map((value, i) => (
          <Token
            key={i}
            label={value}
            onOpen={() => {}}
            openName={`Change ${value}`}
            onRemove={value === first[i] ? undefined : () => setValues(values.map((v, j) => (j === i ? first[j] : v)))}
            removeName={`Put back ${first[i]}`}
          />
        ))}
      </Tokens>
    );
  }
  render(<Slots />);
  const x = screen.getByRole("button", { name: "Put back Pears" });
  x.focus();
  fireEvent.click(x);
  expect(screen.queryByRole("button", { name: "Put back Pears" })).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Change Pears" }));
});
