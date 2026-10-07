import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, expect, test } from "vitest";
import { routes } from "./routes.tsx";

afterEach(cleanup);

function renderAt(path: string) {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

test("index route renders inside the shell", () => {
  renderAt("/");
  expect(screen.getByRole("link", { name: "Alchemy 5e" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Characters" })).toBeTruthy();
  expect(screen.getByLabelText("Import character file")).toBeTruthy();
  expect(screen.getByLabelText("Load homebrew file")).toBeTruthy();
});

test("the sheet route for an unknown character says so once the engine loads", async () => {
  renderAt("/sheet/no-such-id");
  expect(await screen.findByRole("heading", { name: "Character not found" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Back to characters" })).toBeTruthy();
});

test("the build route for an unknown character says so once the engine loads", async () => {
  renderAt("/build/no-such-id");
  expect(await screen.findByRole("heading", { name: "Character not found" })).toBeTruthy();
});

test("New character opens the builder, and a pick updates the preview", async () => {
  renderAt("/");
  fireEvent.click(screen.getByRole("button", { name: "New character" }));
  const preview = await screen.findByRole("region", { name: "Preview" }, { timeout: 5000 });
  expect(within(preview).getByText("Barbarian 1")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Sheet" })).toBeTruthy();

  const race = screen.getByRole("region", { name: /^Race/ });
  fireEvent.click(within(race).getByRole("button", { name: "Dwarf" }));
  expect(within(race).getByRole("button", { name: "Dwarf" }).getAttribute("aria-pressed")).toBe("true");
  expect(within(preview).getByText("Dwarf")).toBeTruthy();
  // Dwarf opens its subrace.
  expect(within(race).getByRole("region", { name: /^Subrace/ })).toBeTruthy();
});

test("unknown paths render the not-found page", () => {
  renderAt("/no-such-page");
  expect(screen.getByRole("heading", { name: "Page not found" })).toBeTruthy();
});
