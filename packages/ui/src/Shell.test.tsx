import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AlertNote, AlertNotes } from "./AlertNote.tsx";
import { FlagTab, FlagTabs, Shell } from "./Shell.tsx";

afterEach(cleanup);

test("the shell puts the logo and the nav in the rail, and the children in main", () => {
  render(
    <Shell
      logo={<a href="/">Logo</a>}
      nav={
        <FlagTabs label="Main">
          <FlagTab color="yellow" current render={<a href="/one" />}>
            One
          </FlagTab>
          <FlagTab color="blue" current={false} render={<a href="/two" />}>
            Two
          </FlagTab>
        </FlagTabs>
      }
    >
      <h1>Page</h1>
    </Shell>,
  );
  const rail = screen.getByRole("complementary");
  expect(within(rail).getByRole("link", { name: "Logo" })).toBeTruthy();
  const nav = within(rail).getByRole("navigation", { name: "Main" });
  const [one, two] = within(nav).getAllByRole("link");
  expect([one.textContent, one.getAttribute("href"), one.getAttribute("aria-current"), one.dataset.flag]).toEqual(["One", "/one", "page", "yellow"]);
  expect([two.textContent, two.getAttribute("aria-current"), two.dataset.flag]).toEqual(["Two", null, "blue"]);
  expect(within(screen.getByRole("main")).getByRole("heading", { name: "Page" })).toBeTruthy();
});

test("act and failed notes are alerts; an info note is a status with a dismiss button", () => {
  const dismiss = vi.fn();
  render(
    <AlertNotes>
      <AlertNote tone="act">
        Do this. <button type="button">Do it</button>
      </AlertNote>
      <AlertNote tone="failed">It failed.</AlertNote>
      <AlertNote tone="info" onDismiss={dismiss}>
        For your information.
      </AlertNote>
    </AlertNotes>,
  );
  const [act, failed] = screen.getAllByRole("alert");
  expect(act.textContent).toBe("ActDo this. Do it");
  expect(within(act).getByRole("button", { name: "Do it" })).toBeTruthy();
  expect(failed.textContent).toBe("FailedIt failed.");
  expect(within(failed).queryByRole("button")).toBeNull();

  const info = screen.getByRole("status");
  fireEvent.click(within(info).getByRole("button", { name: "Dismiss" }));
  expect(dismiss).toHaveBeenCalledOnce();
});
