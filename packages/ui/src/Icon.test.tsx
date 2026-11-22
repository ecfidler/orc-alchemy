import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { LockIcon } from "./Icon.tsx";

afterEach(cleanup);

test("the lock icon is an SVG in the text color, hidden from a screen reader, and it does not shrink", () => {
  const { container } = render(<LockIcon className="ml-1" />);
  const svg = container.querySelector("svg")!;
  expect([svg.getAttribute("aria-hidden"), svg.getAttribute("class"), svg.style.flexShrink, svg.getAttribute("width")]).toEqual(["true", "ml-1", "0", "13"]);
  expect([...svg.children].every((part) => [part.getAttribute("fill"), part.getAttribute("stroke")].includes("currentColor"))).toBe(true);
});
