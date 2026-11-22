import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";
import { FeedbackLink, feedbackUrl } from "./FeedbackLink.tsx";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const FORM = "https://docs.google.com/forms/d/e/FORM/viewform?usp=pp_url";

test("feedbackUrl fills each field, plain or URL-encoded, and encodes the values", () => {
  const url = feedbackUrl(`${FORM}&entry.1=%7Bpage%7D&entry.2={build}&entry.3=%7bBrowser%7d`, {
    page: "/sheet/a1?tab=spells&x=1",
    build: "abc1234",
    browser: "Mozilla/5.0 (X11)",
  });
  const params = new URL(url).searchParams;
  expect(params.get("entry.1")).toBe("/sheet/a1?tab=spells&x=1");
  expect(params.get("entry.2")).toBe("abc1234");
  expect(params.get("entry.3")).toBe("Mozilla/5.0 (X11)");
  expect(params.get("usp")).toBe("pp_url");
});

test("feedbackUrl leaves a link without fields as it is", () => {
  expect(feedbackUrl(FORM, { page: "/", build: "b", browser: "c" })).toBe(FORM);
});

test("a build without a feedback form has no feedback link", () => {
  vi.stubEnv("VITE_FEEDBACK_URL", "");
  render(
    <MemoryRouter>
      <FeedbackLink />
    </MemoryRouter>,
  );
  expect(screen.queryByRole("link", { name: "Send feedback" })).toBeNull();
});

test("on a beta build, the feedback link opens the form in a new tab with the page and the build", () => {
  vi.stubEnv("VITE_FEEDBACK_URL", `${FORM}&entry.1=%7Bpage%7D&entry.2=%7Bbuild%7D`);
  vi.stubEnv("VITE_BETA_BUILD", "0123456789abcdef");
  render(
    <MemoryRouter initialEntries={["/sheet/c7?tab=spells"]}>
      <FeedbackLink />
    </MemoryRouter>,
  );
  const link = screen.getByRole("link", { name: "Send feedback" });
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  const params = new URL(link.getAttribute("href")!).searchParams;
  expect(params.get("entry.1")).toBe("/sheet/c7?tab=spells");
  expect(params.get("entry.2")).toBe("0123456789abcdef");
});
