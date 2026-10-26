import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

// These tests read theme.css itself, so the values they check are the values the app gets.
const css = readFileSync(join(import.meta.dirname, "../theme.css"), "utf8");

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`theme.css has no block ${selector}`);
  return css.slice(start, css.indexOf("}", start));
}

function variables(body: string): Map<string, string> {
  return new Map([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
}

const light = variables(block(":root"));
const darkMedia = variables(block(':root:not([data-theme="light"])'));
const darkAttribute = variables(block(':root[data-theme="dark"]'));
// The dark blocks list only the tokens that change.
const dark = new Map([...light, ...darkAttribute]);

type Rgb = [number, number, number];

function hex(value: string): Rgb {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (!match) throw new Error(`not a hex color: ${value}`);
  const n = parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A color token: a hex value, or `color-mix(in srgb, var(--a) N%, var(--b))`. */
function color(tokens: Map<string, string>, name: string): Rgb {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`no token ${name}`);
  const mix = /^color-mix\(in srgb, var\((--[\w-]+)\) (\d+)%, var\((--[\w-]+)\)\)$/.exec(value);
  if (!mix) return hex(value);
  const a = color(tokens, mix[1]);
  const b = color(tokens, mix[3]);
  const p = Number(mix[2]) / 100;
  return [0, 1, 2].map((i) => a[i] * p + b[i] * (1 - p)) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const MARK = 3;

// [foreground, background, minimum]. When you add a text token, add its pairs here.
const pairs: [string, string, number][] = [
  ...["--paper", "--paper-raised", "--panel"].flatMap((background): [string, string, number][] => [
    ["--ink", background, TEXT],
    ["--ink-muted", background, TEXT],
    ["--danger", background, TEXT],
    ["--success", background, TEXT],
    ["--info", background, TEXT],
    ["--warning", background, TEXT],
    // --caution is text on the page (4.55 : 1 in light), but only a mark on the shaded panel (4.06 : 1).
    ["--caution", background, background === "--panel" ? MARK : TEXT],
    ["--rule-strong", background, MARK],
  ]),
  ["--ink", "--bubble", TEXT],
  ["--ink-muted", "--bubble", TEXT],
  ["--note-ink", "--note", TEXT],
  ["--note-ink", "--note-red", TEXT],
  ["--note-ink", "--note-blue", TEXT],
  ...["--flag-yellow", "--flag-blue", "--flag-green", "--flag-orange"].map((flag): [string, string, number] => ["--flag-ink", flag, TEXT]),
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s mode", (_, tokens) => {
  test.each(pairs)("%s on %s is at least %d : 1", (foreground, background, minimum) => {
    expect(contrast(color(tokens, foreground), color(tokens, background))).toBeGreaterThanOrEqual(minimum);
  });
});

test("the contrast math matches the spec's figures", () => {
  expect(contrast(color(light, "--ink"), color(light, "--paper"))).toBeCloseTo(15.53, 2);
  expect(contrast(color(light, "--caution"), color(light, "--paper"))).toBeCloseTo(4.55, 2);
  expect(contrast(color(dark, "--ink-muted"), color(dark, "--paper"))).toBeCloseTo(9.36, 2);
});

test("the media-query dark block and the attribute dark block are the same", () => {
  expect(darkMedia).toEqual(darkAttribute);
});

test("every token has a utility, except the non-colors", () => {
  const mapped = variables(block("@theme inline"));
  const missing = [...light.keys()].filter((name) => !mapped.has(`--color-${name.slice(2)}`));
  expect(missing).toEqual(["--stain-op", "--grain-opacity"]);
});
