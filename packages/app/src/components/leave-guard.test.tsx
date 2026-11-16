// The leave guard of the homebrew forms (ORC-211): a changed form asks
// before navigation in the app, and the browser warns before a reload.
import "fake-indexeddb/auto";
import { answerConfirmDialog } from "@orc-alchemy/ui/testing";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test } from "vitest";
import { sameRecord } from "../engine/content.ts";
import { loadEngine } from "../engine/engine.ts";
import { useHomebrew } from "../state/homebrew.ts";
import { BUILDERS, HomebrewBuilder } from "./HomebrewBuilder.tsx";

beforeAll(() => loadEngine());

const { saveItem } = useHomebrew.getState();
afterEach(async () => {
  cleanup();
  useHomebrew.setState({ saveItem });
  for (const { id } of useHomebrew.getState().magicItems) await useHomebrew.getState().removeMagicItem(id);
  for (const { id } of useHomebrew.getState().packs) await useHomebrew.getState().remove(id);
});

/** The form at the path, with My Content before it in the history, and a second page for a rail link. */
function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/content", element: <h1>My Content</h1> },
      { path: "/characters", element: <h1>Characters</h1> },
      { path: "/content/new/:type", element: <HomebrewBuilder /> },
      { path: "/content/edit/:type/:key", element: <HomebrewBuilder /> },
      { path: "/content/edit/:type/:pack/:key", element: <HomebrewBuilder /> },
    ],
    { initialEntries: ["/content", path], initialIndex: 1 },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const name = () => screen.getByRole<HTMLInputElement>("textbox", { name: "Name" });
const type = (value: string) => fireEvent.change(name(), { target: { value } });
const cancel = () => fireEvent.click(screen.getByRole("link", { name: "Cancel" }));
const save = () => fireEvent.click(screen.getByRole("button", { name: "Save" }));
const question = (one: string) => `This ${one} has changes that are not saved. Leave anyway?`;
/** Whether the browser would warn before a reload or a close of the tab. */
const warns = () => !window.dispatchEvent(new Event("beforeunload", { cancelable: true }));
/** Waits one turn of the router, then says whether a dialog is open. */
async function asked() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  return screen.queryByRole("alertdialog") !== null;
}
const DEFAULT = "Default Option Source";
/** Stores a feat and a magic item named Keen, and returns the paths of their edit forms. */
async function storeKeen() {
  await useHomebrew.getState().saveItem(DEFAULT, "~:orcpub.dnd.e5/feats", { "~:name": "Keen", "~:key": "~:keen", "~:option-pack": DEFAULT });
  await BUILDERS.magicItem.save!({ "~:orcpub.dnd.e5.magic-items/name": "Keen", "~:orcpub.dnd.e5.magic-items/type": "~:wondrous-item" });
  return { feat: `/content/edit/feat/${encodeURIComponent(DEFAULT)}/keen`, magicItem: "/content/edit/magicItem/keen" };
}

test("sameRecord ignores the order of keys and empty values, and sees each other difference", () => {
  expect(sameRecord({ a: 1, b: { c: [1, "x"], d: true } }, { b: { d: true, c: [1, "x"] }, a: 1 })).toBe(true);
  // An emptied field, a cleared checkbox, and a list or set with no picks are the same as no key.
  expect(sameRecord({ a: 1, b: "", c: undefined, d: false, e: [], f: { "~#set": [] }, g: { h: "" } }, { a: 1 })).toBe(true);
  expect(sameRecord({ a: { "~#set": [] } }, { a: [] })).toBe(true);
  expect(sameRecord({ a: 1 }, { a: 1, b: "x" })).toBe(false);
  expect(sameRecord({ a: true }, {})).toBe(false);
  expect(sameRecord({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
  expect(sameRecord({ a: [1] }, { a: { 0: 1 } })).toBe(false);
  expect(sameRecord({ a: null }, {})).toBe(false);
  expect(sameRecord({ a: 0 }, {})).toBe(false);
});

test("a checkbox that the user checks and clears is not a change", async () => {
  const router = renderAt("/content/new/spell");
  await screen.findByRole("form", { name: "New spell" });
  const ritual = screen.getByRole("checkbox", { name: "Ritual" });
  fireEvent.click(ritual);
  expect(warns()).toBe(true);
  fireEvent.click(ritual);
  expect(warns()).toBe(false);
  cancel();
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"));
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

test.each(Object.entries(BUILDERS))("a new %s form asks only after a change", async (key, { one }) => {
  const router = renderAt(`/content/new/${key}`);
  await screen.findByRole("form", { name: `New ${one}` });
  await screen.findByRole("textbox", { name: "Name" });
  expect(warns()).toBe(false);
  type("Keen");
  expect(warns()).toBe(true);
  cancel();
  expect(await answerConfirmDialog("Stay")).toBe(question(one));
  expect(router.state.location.pathname).toBe(`/content/new/${key}`);
  expect(name().value).toBe("Keen");
  // A change that the user reverses is not a change.
  type("");
  expect(warns()).toBe(false);
  cancel();
  await screen.findByRole("heading", { name: "My Content" });
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

test.each(["feat", "magicItem"] as const)(
  "a changed new %s form asks at Cancel, at a link and at Back; Stay keeps the values, and Leave goes to the page",
  async (key) => {
    const { one } = BUILDERS[key];
    const router = renderAt(`/content/new/${key}`);
    await screen.findByRole("form", { name: `New ${one}` });
    type("Keen");

    cancel();
    expect(await answerConfirmDialog("Stay")).toBe(question(one));
    void router.navigate("/characters");
    expect(await answerConfirmDialog("Stay")).toBe(question(one));
    void router.navigate(-1);
    expect(await answerConfirmDialog("Stay")).toBe(question(one));
    expect(router.state.location.pathname).toBe(`/content/new/${key}`);
    expect(name().value).toBe("Keen");

    void router.navigate("/characters");
    await answerConfirmDialog("Leave");
    await screen.findByRole("heading", { name: "Characters" });
    // The listener goes with the form.
    expect(warns()).toBe(false);
  },
);

test.each(["feat", "magicItem"] as const)("an edit %s form asks only after a change", async (key) => {
  const paths = await storeKeen();
  const { one } = BUILDERS[key];
  let router = renderAt(paths[key]);
  await screen.findByRole("form", { name: `Edit ${one}` });
  expect(name().value).toBe("Keen");
  expect(warns()).toBe(false);
  void router.navigate(-1);
  await screen.findByRole("heading", { name: "My Content" });
  expect(screen.queryByRole("alertdialog")).toBeNull();
  cleanup();

  router = renderAt(paths[key]);
  await screen.findByRole("form", { name: `Edit ${one}` });
  type("Keen Mind");
  expect(warns()).toBe(true);
  void router.navigate(-1);
  expect(await answerConfirmDialog("Stay")).toBe(question(one));
  expect(name().value).toBe("Keen Mind");
  cancel();
  await answerConfirmDialog("Leave");
  await screen.findByRole("heading", { name: "My Content" });
});

test.each(["feat", "magicItem"] as const)("Save of a changed %s form leaves without a question", async (key) => {
  const { one } = BUILDERS[key];
  const router = renderAt(`/content/new/${key}`);
  await screen.findByRole("form", { name: `New ${one}` });
  type("Keen");
  save();
  // Save builds the packs with the item, which is slow under load.
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  expect(await asked()).toBe(false);
  expect(warns()).toBe(false);
});

test("a save that fails keeps the guard on", async () => {
  useHomebrew.setState({ saveItem: () => Promise.reject(new Error("The disk is full")) });
  const router = renderAt("/content/new/feat");
  await screen.findByRole("form", { name: "New feat" });
  type("Keen");
  save();
  expect((await screen.findByRole("alert")).textContent).toBe("The disk is full");
  expect(router.state.location.pathname).toBe("/content/new/feat");
  expect(warns()).toBe(true);
  cancel();
  expect(await answerConfirmDialog("Stay")).toBe(question("feat"));

  // The next save goes through, and then leaves without a question.
  useHomebrew.setState({ saveItem });
  save();
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  expect(await asked()).toBe(false);
});
