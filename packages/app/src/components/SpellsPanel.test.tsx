import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Button } from "@orc-alchemy/ui";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { engine, loadEngine } from "../engine/engine.ts";
import type { SpellRef } from "../engine/sheet.ts";
import { type KnownSpell, type Sheet, type Spellcasting, toSheet } from "../engine/sheet.ts";
import { loadSpellContent } from "../engine/spells.ts";
import { SpellsPanel } from "./SpellsPanel.tsx";

beforeAll(async () => {
  await loadEngine();
  await loadSpellContent();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The Life cleric 9 of the e2e tests (pinned to the builder's calls in src/engine/spell-list.test.ts). */
const cleric = (): Sheet => {
  const entity = JSON.parse(readFileSync(join(import.meta.dirname, "../../e2e/life-cleric-9.strict.json"), "utf8"));
  return toSheet(engine().evaluate(entity).built, entity);
};

/** Renders the open panel in a router, as the sheet page does. */
function renderPanel(sheet: Sheet, at?: SpellRef) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <SpellsPanel
            open
            onOpenChange={() => {}}
            spellcasting={sheet.spellcasting!}
            classes={sheet.classes}
            at={at}
            builderHref="/build/abc?step=Spells"
            onSpendSlots={() => {}}
            onPrepare={() => {}}
          />
        ),
      },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
  return screen.findByRole("dialog", { name: "Spells" });
}

const rowNames = (dialog: HTMLElement) => [...dialog.querySelectorAll("[data-spell-row]")].map((row) => row.textContent);
/** A row by its spell name: its accessible name is the name, then its tags. */
const row = (dialog: HTMLElement, name: string) => within(dialog).getByRole("button", { name: new RegExp(`^${name} ?(Ritual|Concentration)*$`) });
const viewName = (dialog: HTMLElement) => within(dialog.querySelector<HTMLElement>("[data-pane=spell]")!).getByRole("region").querySelector("h3")!.textContent;

test("the header has the title, the class line and, with one source, the three boxes with their full names", async () => {
  const dialog = await renderPanel(cleric());
  expect(within(dialog).getByRole("heading", { level: 2, name: "Spells" })).toBeTruthy();
  expect(within(dialog).getByText("Cleric 9")).toBeTruthy();
  expect(within(dialog).getByRole("group", { name: "Spell save DC" }).textContent).toBe("15");
  expect(within(dialog).getByRole("group", { name: "Spell attack" }).textContent).toBe("+7");
  expect(within(dialog).getByRole("group", { name: "Spellcasting ability" }).textContent).toBe("WIS");
  // No character name in the header.
  expect(within(dialog).queryByText("Ilsa Brightwater")).toBeNull();
  expect(within(dialog).getByRole("link", { name: "Change known spells in the builder" }).getAttribute("href")).toBe("/build/abc?step=Spells");
});

test("with two sources the header has the class line of each class and no boxes", async () => {
  const entity = JSON.parse(readFileSync(join(import.meta.dirname, "../../e2e/warlock-10-sorcerer-9.strict.json"), "utf8"));
  const dialog = await renderPanel(toSheet(engine().evaluate(entity).built, entity));
  expect(within(dialog).getByText("Warlock 10 / Sorcerer 9")).toBeTruthy();
  expect(within(dialog).queryByRole("group", { name: "Spell save DC" })).toBeNull();
});

test("the list shows the cantrips and the prepared and domain spells, by level; the first spell is selected and has the focus", async () => {
  const dialog = await renderPanel(cleric());
  expect(
    within(dialog)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent)
      .slice(0, 6),
  ).toEqual(["Cantrips", "1st level", "2nd level", "3rd level", "4th level", "5th level"]);
  expect(rowNames(dialog)).toHaveLength(22);
  expect(rowNames(dialog).slice(4, 8)).toEqual(["BlessC", "Cure Wounds", "Healing Word", "Shield of FaithC"]);
  expect(within(row(dialog, "Bless")).getByRole("img", { name: "Concentration" }).textContent).toBe("C");
  const guidance = row(dialog, "Guidance");
  expect(guidance.getAttribute("aria-current")).toBe("true");
  // The list is one Tab stop.
  expect([...dialog.querySelectorAll("[data-spell-row][tabindex='0']")]).toEqual([guidance]);
  await waitFor(() => expect(document.activeElement).toBe(guidance));
  expect(viewName(dialog)).toBe("Guidance");
});

test("opened at a spell, that spell is selected and has the focus", async () => {
  const dialog = await renderPanel(cleric(), { key: "raise-dead", source: "Cleric" });
  await waitFor(() => expect(document.activeElement).toBe(row(dialog, "Raise Dead")));
  expect(row(dialog, "Raise Dead").getAttribute("aria-current")).toBe("true");
  expect(viewName(dialog)).toBe("Raise Dead");
});

test("the arrow keys, Home and End move the focus and the selection, and a live region says the new spell", async () => {
  const dialog = await renderPanel(cleric());
  await waitFor(() => expect(document.activeElement).toBe(row(dialog, "Guidance")));
  const live = dialog.querySelector("[aria-live=polite]")!;
  expect(live.textContent).toBe("");
  fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
  expect(document.activeElement).toBe(row(dialog, "Light"));
  expect(row(dialog, "Light").getAttribute("aria-current")).toBe("true");
  expect(viewName(dialog)).toBe("Light");
  expect(liveText(dialog)).toBe("Light");
  fireEvent.keyDown(document.activeElement!, { key: "End" });
  expect(document.activeElement).toBe(row(dialog, "Raise Dead"));
  fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
  expect(document.activeElement).toBe(row(dialog, "Raise Dead"));
  fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
  expect(document.activeElement).toBe(row(dialog, "Mass Cure Wounds"));
  fireEvent.keyDown(document.activeElement!, { key: "Home" });
  expect(document.activeElement).toBe(row(dialog, "Guidance"));
  expect(viewName(dialog)).toBe("Guidance");
  // A click selects too.
  fireEvent.click(row(dialog, "Aid"));
  expect(viewName(dialog)).toBe("Aid");
  expect([...dialog.querySelectorAll("[data-spell-row][tabindex='0']")]).toHaveLength(1);
});

test("the search filters the rows by name, hides a group with no match, and says when no spell matches", async () => {
  const dialog = await renderPanel(cleric());
  const search = within(dialog).getByRole("textbox", { name: "Search spells" });
  fireEvent.change(search, { target: { value: "heal" } });
  expect(rowNames(dialog)).toEqual(["Healing Word", "Prayer of Healing"]);
  const listHeadings = within(dialog.querySelector<HTMLElement>("[data-pane=list]")!).getAllByRole("heading");
  expect(listHeadings.map((heading) => heading.textContent)).toEqual(["1st level", "2nd level"]);
  // The selected spell is not in the list: the first row is the Tab stop, and the spell view keeps the spell.
  expect(row(dialog, "Healing Word").tabIndex).toBe(0);
  expect(viewName(dialog)).toBe("Guidance");
  fireEvent.change(search, { target: { value: "zzz" } });
  expect(rowNames(dialog)).toEqual([]);
  expect(within(dialog).getByText("No spells match.")).toBeTruthy();
});

const known = (key: string, name: string): KnownSpell => ({
  key,
  name,
  source: "Hill Dwarf",
  ability: "wis",
  alwaysPrepared: false,
  prepared: false,
  castNote: null,
});
const dwarf = (spells: KnownSpell[], slots: Spellcasting["slots"] = []): Sheet => ({
  ...cleric(),
  classes: [],
  spellcasting: {
    slots,
    pact: null,
    casters: [{ name: "Hill Dwarf", ability: "wis", saveDc: 11, attackBonus: 3, prepares: false, canPrepare: null }],
    byLevel: [{ level: 1, spells }],
    knownModes: {},
  },
});

test("a spell with no record stays in the list with the name from its key, and its view says the app has no text", async () => {
  const dialog = await renderPanel(dwarf([known("tsunami", "Tsunami"), known("bless", "Bless")]));
  expect(rowNames(dialog)).toEqual(["BlessC", "Tsunami"]);
  fireEvent.click(row(dialog, "Tsunami"));
  expect(viewName(dialog)).toBe("Tsunami");
  expect(within(dialog).getByText("The app has no text for this spell.")).toBeTruthy();
});

test("with no spell to show, the spell view says to select a spell, and a level with slots keeps its heading", async () => {
  const dialog = await renderPanel(dwarf([], [{ level: 1, count: 2, spent: 0 }]));
  expect(rowNames(dialog)).toEqual([]);
  expect(within(dialog).getByRole("heading", { level: 3, name: "1st level" })).toBeTruthy();
  expect(within(dialog).getByText("Select a spell to read it.")).toBeTruthy();
  // No search yet, so no "No spells match."
  expect(within(dialog).queryByText("No spells match.")).toBeNull();
});

/** Makes the window a phone: 600px and less. */
const asPhone = () =>
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(max-width: 600px)", addEventListener() {}, removeEventListener() {} }));

/** The text of the live region, without the no-break space that marks a repeated message. */
const liveText = (dialog: HTMLElement) => dialog.querySelector("[aria-live=polite]")!.textContent!.replace(/\u00a0/g, "");

/**
 * The panel of a new page load, whose spell chunk loads only when `release` is called. `phone` makes the window a
 * phone first. Returns the dialog and `release`, which resolves when the spells are in.
 */
async function renderLoading(at?: SpellRef) {
  vi.resetModules();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.doMock("@pubdoor/dmv/content/spells.json", async () => {
    await gate;
    return vi.importActual("@pubdoor/dmv/content/spells.json");
  });
  const { SpellsPanel: FreshPanel } = await import("./SpellsPanel.tsx");
  const { loadSpellContent: freshLoad } = await import("../engine/spells.ts");
  const sheet = cleric();
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <FreshPanel
            open
            onOpenChange={() => {}}
            spellcasting={sheet.spellcasting!}
            classes={sheet.classes}
            at={at}
            builderHref="/b"
            onSpendSlots={() => {}}
            onPrepare={() => {}}
          />
        ),
      },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
  const dialog = await screen.findByRole("dialog", { name: "Spells" });
  return {
    dialog,
    load: async () => {
      release();
      await act(() => freshLoad());
      vi.doUnmock("@pubdoor/dmv/content/spells.json");
    },
  };
}

test("while the spell chunk loads, the list says so, the spell view waits, and the selected row gets the focus when the spells show", async () => {
  const { dialog, load } = await renderLoading();
  expect(within(dialog).getByRole("status").textContent).toBe("Loading spells…");
  // No record yet: the spell view does not say that the app has no text.
  expect(within(dialog).queryByText("The app has no text for this spell.")).toBeNull();
  expect(dialog.querySelector("[data-pane=spell]")!.textContent).toBe("");
  // The dialog gives the focus to its first control meanwhile: for a cleric, the "Prepare spells" button.
  await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Prepare spells" })));
  await load();
  await waitFor(() => expect(document.activeElement).toBe(row(dialog, "Guidance")));
  expect(viewName(dialog)).toBe("Guidance");
});

test("a focus that the user moved while the spells load stays where the user put it", async () => {
  const { dialog, load } = await renderLoading();
  const close = within(dialog).getByRole("button", { name: "Close" });
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  close.focus();
  await load();
  await within(dialog).findAllByRole("button", { name: /^Guidance/ });
  expect(document.activeElement).toBe(close);
});

test("on a phone, opened at a spell while the spells load, the spell view says Loading spells…, then shows the spell and says its name", async () => {
  asPhone();
  const { dialog, load } = await renderLoading({ key: "aid", source: "Cleric" });
  const pane = dialog.querySelector<HTMLElement>("[data-pane=spell]")!;
  expect(within(pane).getByText("Loading spells…")).toBeTruthy();
  expect(within(pane).queryByText("The app has no text for this spell.")).toBeNull();
  await load();
  await waitFor(() => expect(viewName(dialog)).toBe("Aid"));
  expect(liveText(dialog)).toBe("Aid");
});

test("on a phone a row replaces the list with the spell view, and Back to the list gives the focus to the row", async () => {
  asPhone();
  const dialog = await renderPanel(cleric());
  const list = dialog.querySelector<HTMLElement>("[data-pane=list]")!;
  const view = dialog.querySelector<HTMLElement>("[data-pane=spell]")!;
  expect(view.hidden).toBe(true);
  await waitFor(() => expect(document.activeElement).toBe(row(dialog, "Guidance")));
  // The arrow keys move the focus only.
  fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
  expect(document.activeElement).toBe(row(dialog, "Light"));
  expect(row(dialog, "Guidance").getAttribute("aria-current")).toBe("true");
  list.scrollTop = 120;
  fireEvent.click(row(dialog, "Aid"));
  expect(list.hidden).toBe(true);
  expect(view.hidden).toBe(false);
  expect(viewName(dialog)).toBe("Aid");
  const back = within(dialog).getByRole("button", { name: "Back to the list" });
  expect(document.activeElement).toBe(back);
  fireEvent.click(back);
  expect(list.hidden).toBe(false);
  expect(view.hidden).toBe(true);
  expect(list.scrollTop).toBe(120);
  expect(document.activeElement).toBe(row(dialog, "Aid"));
});

test("on a phone, opened at a spell, the panel shows its spell view with the focus on Back to the list", async () => {
  asPhone();
  const dialog = await renderPanel(cleric(), { key: "aid", source: "Cleric" });
  expect(viewName(dialog)).toBe("Aid");
  await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Back to the list" })));
});

test("on a phone, opened at a spell, the live region says its name, and Back to the list scrolls the row into view", async () => {
  asPhone();
  const scrolled: Element[] = [];
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this);
  };
  try {
    const dialog = await renderPanel(cleric(), { key: "raise-dead", source: "Cleric" });
    // The focus on the Back button does not read the spell, so the live region says it.
    await waitFor(() => expect(liveText(dialog)).toBe("Raise Dead"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Back to the list" }));
    // No position was kept, as the list did not show before: the row scrolls into view.
    expect(scrolled).toContain(row(dialog, "Raise Dead"));
    expect(document.activeElement).toBe(row(dialog, "Raise Dead"));
  } finally {
    // jsdom has no scrollIntoView.
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  }
});

test("on a phone, a tap on the selected row opens its spell view, and the live region says its name again", async () => {
  asPhone();
  const dialog = await renderPanel(cleric());
  const live = dialog.querySelector("[aria-live=polite]")!;
  fireEvent.click(row(dialog, "Guidance"));
  expect(viewName(dialog)).toBe("Guidance");
  expect(liveText(dialog)).toBe("Guidance");
  const first = live.textContent;
  fireEvent.click(within(dialog).getByRole("button", { name: "Back to the list" }));
  fireEvent.click(row(dialog, "Guidance"));
  // The same name, as a new message: the text of the region changed.
  expect(liveText(dialog)).toBe("Guidance");
  expect(live.textContent).not.toBe(first);
});

test("a reopen starts again: the search is empty and the first spell is selected", async () => {
  function Reopen() {
    const [open, setOpen] = useState(false);
    const sheet = cleric();
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open spells</Button>
        <SpellsPanel
          open={open}
          onOpenChange={setOpen}
          spellcasting={sheet.spellcasting!}
          classes={sheet.classes}
          builderHref="/b"
          onSpendSlots={() => {}}
          onPrepare={() => {}}
        />
      </>
    );
  }
  render(<RouterProvider router={createMemoryRouter([{ path: "/", element: <Reopen /> }], { initialEntries: ["/"] })} />);
  fireEvent.click(screen.getByRole("button", { name: "Open spells" }));
  let dialog = await screen.findByRole("dialog", { name: "Spells" });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Search spells" }), { target: { value: "heal" } });
  fireEvent.click(row(dialog, "Prayer of Healing"));
  expect(rowNames(dialog)).toEqual(["Healing Word", "Prayer of Healing"]);
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Open spells" }));
  dialog = await screen.findByRole("dialog", { name: "Spells" });
  expect((within(dialog).getByRole("textbox", { name: "Search spells" }) as HTMLInputElement).value).toBe("");
  expect(rowNames(dialog)).toHaveLength(22);
  expect(row(dialog, "Guidance").getAttribute("aria-current")).toBe("true");
  expect(viewName(dialog)).toBe("Guidance");
});
