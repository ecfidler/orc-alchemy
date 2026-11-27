// The helpers of the magic item form tests: the routes of the builder, the form's fields, and the stored items.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { useHomebrew } from "../../state/homebrew.ts";
import { HomebrewBuilder } from "../HomebrewBuilder.tsx";
import { MyContent } from "../MyContent.tsx";

/** Unmounts the page and removes the stored magic items and packs, after each test. */
export async function resetHomebrew() {
  cleanup();
  for (const { id } of useHomebrew.getState().magicItems) await useHomebrew.getState().removeMagicItem(id);
  for (const { id } of useHomebrew.getState().packs) await useHomebrew.getState().remove(id);
}

export function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/content", element: <MyContent /> },
      { path: "/content/new/:type", element: <HomebrewBuilder /> },
      { path: "/content/edit/:type/:key", element: <HomebrewBuilder /> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

/** Waits for the form and its fields, which show when the content lists are read. */
export async function form(name: string) {
  await screen.findByRole("form", { name });
  await screen.findByLabelText("Rarity");
}
export const save = () => screen.getByRole<HTMLButtonElement>("button", { name: "Save" });
export const type = (label: string, value: string) =>
  fireEvent.change(screen.queryByRole("textbox", { name: label }) ?? screen.getByRole("combobox", { name: label }), { target: { value } });
export const group = (name: string) => within(screen.getByRole("group", { name }));
export const stored = (key: string) => useHomebrew.getState().magicItems.find((r) => r.id === key);
export const MI = "~:orcpub.dnd.e5.magic-items/";
export const W = "~:orcpub.dnd.e5.weapons/";
