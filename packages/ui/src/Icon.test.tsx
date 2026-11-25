import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { LockIcon, PixelIcon } from "./Icon.tsx";

afterEach(cleanup);

test("the lock icon is the lock pixel icon with no space after it, hidden from a screen reader", () => {
  const { container } = render(<LockIcon className="ml-1" />);
  const svg = container.querySelector("svg")!;
  expect([svg.getAttribute("aria-hidden"), svg.getAttribute("class"), svg.dataset.icon, svg.getAttribute("width")]).toEqual([
    "true",
    "ui-icon ui-icon-alone ml-1",
    "lock",
    "16",
  ]);
});

test("a pixel icon is a 16px SVG in the text color, hidden from a screen reader, with a path for each of its three tones", () => {
  const { container } = render(<PixelIcon name="x" className="ml-1" />);
  const svg = container.querySelector("svg")!;
  expect([svg.getAttribute("aria-hidden"), svg.getAttribute("class"), svg.getAttribute("width"), svg.getAttribute("fill"), svg.dataset.icon]).toEqual([
    "true",
    "ui-icon ml-1",
    "16",
    "currentColor",
    "x",
  ]);
  expect([...svg.children].map((path) => path.getAttribute("opacity"))).toEqual(["1", "0.75", "0.25"]);
  // The first row of the X is ".++..........++.": two runs of the edge tone, and the shape starts on the second row.
  expect(svg.children[1].getAttribute("d")).toMatch(/^M1 0h2v1h-2zM13 0h2v1h-2z/);
  expect(svg.children[0].getAttribute("d")).toMatch(/^M1 1h2v1h-2z/);
});

test("each SRD class has a pixel icon", () => {
  const classes = ["barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"] as const;
  for (const name of classes) {
    const { container } = render(<PixelIcon name={name} />);
    const svg = container.querySelector(`svg[data-icon="${name}"]`)!;
    // Each tone has pixels: a shape, an edge above it and a shadow below it.
    expect([...svg.children].map((path) => path.getAttribute("d") !== "")).toEqual([true, true, true]);
    cleanup();
  }
});
