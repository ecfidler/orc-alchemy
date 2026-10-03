import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/react";
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
});

test("the sheet route for an unknown character says so once the engine loads", async () => {
  renderAt("/sheet/no-such-id");
  expect(await screen.findByRole("heading", { name: "Character not found" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Back to characters" })).toBeTruthy();
});

test("unknown paths render the not-found page", () => {
  renderAt("/no-such-page");
  expect(screen.getByRole("heading", { name: "Page not found" })).toBeTruthy();
});
