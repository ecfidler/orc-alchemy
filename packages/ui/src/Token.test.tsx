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

test("with popup the text is a button that opens a small popup under the token; the focus goes back to it at the close", async () => {
  function Fruit() {
    const [open, setOpen] = useState(false);
    return <Token label="Plums" onRemove={() => {}} popup={{ open, onOpenChange: setOpen, title: "Plums", children: <p>Sweet and dark.</p> }} />;
  }
  render(<Fruit />);
  const button = screen.getByRole("button", { name: "Plums" });
  expect(button.classList.contains("ui-token-open")).toBe(true);
  fireEvent.click(button);
  const popup = await screen.findByRole("dialog", { name: "Plums" });
  expect(popup.textContent).toContain("Sweet and dark.");
  fireEvent.keyDown(popup, { key: "Escape" });
  await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await vi.waitFor(() => expect(document.activeElement).toBe(button));
});

test("with popupOnHover a mouse over the token opens the popup with no focus move; leaving closes it; a click keeps it open", async () => {
  function Fruit() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Token label="Plums" popupOnHover popup={{ open, onOpenChange: setOpen, title: "Plums", children: <p>Sweet and dark.</p> }} />
        <span data-testid="open">{String(open)}</span>
      </>
    );
  }
  render(<Fruit />);
  const token = document.querySelector<HTMLElement>(".ui-token")!;
  const button = screen.getByRole("button", { name: "Plums" });
  fireEvent.pointerOver(token, { pointerType: "mouse" });
  await screen.findByRole("dialog", { name: "Plums" });
  expect(screen.getByTestId("open").textContent).toBe("false");
  expect(document.activeElement).toBe(document.body);
  fireEvent.pointerOut(token, { pointerType: "mouse" });
  await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  // A click while the mouse holds it open makes it an open by the click: leaving the token does not close it.
  fireEvent.pointerOver(token, { pointerType: "mouse" });
  await screen.findByRole("dialog", { name: "Plums" });
  fireEvent.click(button);
  await vi.waitFor(() => expect(screen.getByTestId("open").textContent).toBe("true"));
  fireEvent.pointerOut(token, { pointerType: "mouse" });
  expect(screen.getByRole("dialog", { name: "Plums" })).toBeTruthy();
});

test("with popupOnHover a press on another control of the token keeps the popup that the mouse opened", async () => {
  const pick = vi.fn();
  render(
    <Token label="Plums" popupOnHover popup={{ open: false, onOpenChange: () => {}, title: "Plums", children: <p>Sweet and dark.</p> }}>
      <button type="button" onClick={pick}>
        More
      </button>
    </Token>,
  );
  fireEvent.pointerOver(document.querySelector<HTMLElement>(".ui-token")!, { pointerType: "mouse" });
  await screen.findByRole("dialog", { name: "Plums" });
  const more = screen.getByRole("button", { name: "More" });
  fireEvent.pointerDown(more, { pointerType: "mouse" });
  fireEvent.mouseDown(more);
  fireEvent.click(more);
  expect(pick).toHaveBeenCalledOnce();
  expect(screen.getByRole("dialog", { name: "Plums" })).toBeTruthy();
});

test("with popupOnHover a touch does not open the popup", () => {
  render(<Token label="Plums" popupOnHover popup={{ open: false, onOpenChange: () => {}, title: "Plums", children: <p>Sweet and dark.</p> }} />);
  fireEvent.pointerOver(document.querySelector<HTMLElement>(".ui-token")!, { pointerType: "touch" });
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("note, look and groupName: a muted note after the text, a dashed or a bubble look, and a group with its name", () => {
  render(
    <Tokens>
      <Token label="Pears" note="from the tree" look="dashed" groupName="Pears, from the tree" />
      <Token label="Figs" look="bubble" onRemove={() => {}} />
      <Token label="Plums" look="plain" />
    </Tokens>,
  );
  const pears = screen.getByRole("group", { name: "Pears, from the tree" });
  expect([pears.dataset.look, pears.querySelector(".ui-token-note")?.textContent, pears.querySelector("button")]).toEqual(["dashed", "from the tree", null]);
  const [, figs, plums] = [...document.querySelectorAll<HTMLElement>(".ui-token")];
  expect([figs?.dataset.look, figs?.getAttribute("role"), plums?.dataset.look]).toEqual(["bubble", null, undefined]);
});

test("size small marks the token for its small look", () => {
  render(<Token label="Figs" size="small" />);
  expect(document.querySelector<HTMLElement>(".ui-token")!.dataset.size).toBe("small");
});

test("the three label modes do not mix: props of two modes together are a type error", () => {
  const popup = { open: false, onOpenChange: () => {}, title: "Plums", children: "Sweet and dark." };
  const wrong = [
    // @ts-expect-error onOpen and popup are two modes.
    <Token key="open-popup" label="Plums" onOpen={() => {}} popup={popup} />,
    // @ts-expect-error openHint belongs to onOpen, not to popup.
    <Token key="hint-popup" label="Plums" openHint="Change" popup={popup} />,
    // @ts-expect-error popupOnHover needs popup.
    <Token key="hover-plain" label="Plums" popupOnHover />,
    // @ts-expect-error openName needs a button: onOpen or popup.
    <Token key="name-plain" label="Plums" openName="Change Plums" />,
  ];
  expect(wrong).toHaveLength(4);
});
