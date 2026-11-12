import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { pickFromPicker, removeToken } from "@orc-alchemy/ui/testing/playwright";

// The picker controls of @orc-alchemy/ui (docs/design/homebrew-forms.md, "Controls") in a real browser, with the app's CSS.
// No form uses them yet (ORC-197 to ORC-202), so this page renders them alone.
// Playwright compiles JSX in the files it loads as component-test JSX, so Bun bundles the page's script, once for all tests.
const DEMO = `
import { createElement as h, useState } from "react";
import { createRoot } from "react-dom/client";
import { Chips, Fieldset, ListModal, NumberToggle, Picker, Token, Tokens } from "@orc-alchemy/ui";

const FRUIT = ["Apple", "Banana", "Cherry", "Damson", "Elderberry", "Fig", "Grape", "Kiwi", "Lemon", "Lime", "Mango", "Melon", "Orange", "Peach", "Pear", "Plum", "Quince", "Raspberry", "Strawberry", "Tangerine", "Watermelon"];
const GROUPS = { Orchard: ["Apple", "Cherry", "Damson", "Peach", "Pear", "Plum", "Quince"], Citrus: ["Lemon", "Lime", "Orange", "Tangerine"] };
const groupOf = (name) => Object.keys(GROUPS).find((g) => GROUPS[g].includes(name)) ?? "Other fruit";
const OPTIONS = ["Orchard", "Citrus", "Other fruit"].flatMap((g) => FRUIT.filter((f) => groupOf(f) === g).map((f) => ({ value: f.toLowerCase(), label: f, group: g })));
const BASKETS = [
  { value: "any-melon", label: "Any melon", example: "The picker chooses 1 to 3 melons" },
  { value: "berries", label: "Berries", example: "Raspberries, strawberries, elderberries …" },
  { value: "any-citrus", label: "Any citrus fruit", example: "The picker chooses 1 to 3 citrus fruits" },
  { value: "stone", label: "Stone fruit", example: "Cherries, damsons, peaches, plums" },
];

function Section({ legend, children }) {
  return h(Fieldset, { legend, look: "section" }, children);
}

function PickerCase() {
  const [value, setValue] = useState(["fig", "apple", "lime", "pear"]);
  return h(Section, { legend: "Fruit in the bowl" }, h(Picker, { label: "Add a fruit", title: "Add fruit", options: OPTIONS, value, onValueChange: setValue, search: true }));
}

function ListCase() {
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState([]);
  return h(Section, { legend: "Baskets" },
    h("output", { "data-testid": "baskets" }, picks.join(",")),
    h("button", { className: "ui-button", "data-variant": "ghost", "data-size": "normal", onClick: () => setOpen(true) }, "Add a basket"),
    h(ListModal, { open, onOpenChange: setOpen, title: "Add a basket", items: BASKETS.filter((b) => !picks.includes(b.value)), onPick: (v) => setPicks([...picks, v]) }));
}

function TokensCase() {
  const [n, setN] = useState(2);
  const [names, setNames] = useState(["Apple", "A basket of ripe pears from the far orchard, picked at dawn and packed in straw so that not one of them bruises on the road", "Kiwi", "Watermelon", "Fig"]);
  return h(Section, { legend: "Picks" }, h(Tokens, null,
    h(Token, { label: "Any melon", onRemove: () => {} }, h(NumberToggle, { "aria-label": "Any melon: how many", size: "small", values: [1, 2, 3], value: n, onValueChange: setN })),
    ...names.map((name) => h(Token, { key: name, label: name, onRemove: () => setNames(names.filter((x) => x !== name)) }))));
}

function ToggleCase() {
  const [value, setValue] = useState(1);
  return h(Section, { legend: "Extra baskets" }, h("div", { style: { display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" } },
    h(NumberToggle, { "aria-label": "Extra baskets", values: [null, 1, 2, 3], value, onValueChange: setValue }),
    h("span", null, "baskets of the picker's choice")));
}

function ChipsCase() {
  const [values, setValues] = useState([4, 8, 12, 16, 19]);
  return h(Section, { legend: "Rows" }, h(Chips, { values, options: Array.from({ length: 20 }, (_, i) => i + 1), onValuesChange: setValues, addLabel: "Add a row", name: (n) => "Row " + n }));
}

const CASES = { picker: PickerCase, list: ListCase, tokens: TokensCase, toggle: ToggleCase, chips: ChipsCase };
window.mount = (name) => createRoot(document.getElementById("root")).render(h("main", { style: { maxWidth: "720px", padding: "24px 16px" } }, h(CASES[name])));
`;

const script: string = execFileSync(
  "bun",
  [
    "--eval",
    `
    const result = await Bun.build({
      entrypoints: ["demo"],
      define: { "process.env.NODE_ENV": '"production"' },
      plugins: [{ name: "demo", setup(build) {
        build.onResolve({ filter: /^demo$/ }, () => ({ path: "demo", namespace: "demo" }));
        build.onLoad({ filter: /.*/, namespace: "demo" }, () => ({ contents: ${JSON.stringify(DEMO)}, loader: "jsx", resolveDir: process.cwd() }));
      } }],
    });
    if (!result.success) throw new AggregateError(result.logs);
    process.stdout.write(await result.outputs[0].text());`,
  ],
  { cwd: import.meta.dirname, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
);

async function show(page: Page, name: string, theme: "light" | "dark" = "light") {
  await page.goto("/");
  const styles = await page.evaluate(() => [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map((link) => link.href));
  const links = styles.map((href) => `<link rel="stylesheet" href="${href}">`).join("");
  await page.setContent(`<!doctype html><html data-theme="${theme}"><head>${links}</head><body><div id="root"></div></body></html>`);
  await page.addScriptTag({ content: script });
  await page.evaluate((name) => (window as unknown as { mount: (name: string) => void }).mount(name), name);
  await page.evaluate(() => document.fonts.ready);
}

test("the picker with the keyboard: Enter opens it, the focus is in the search field, and Escape gives it back", async ({ page }) => {
  await show(page, "picker");
  const add = page.getByRole("button", { name: "Add a fruit" });
  await expect(add).toHaveAccessibleDescription("17 more");
  await add.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Add fruit" });
  await expect(dialog.getByRole("searchbox", { name: "Search" })).toBeFocused();
  await page.keyboard.type("an");
  await expect(dialog.locator(".ui-list-row")).toHaveText(["OrangeAdd", "TangerineAdd", "BananaAdd", "MangoAdd"]);
  await page.keyboard.press("ArrowDown");
  await expect(dialog.getByRole("button", { name: "Orange", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  // The picked row leaves, and the focus goes to the next row.
  await expect(dialog.getByRole("button", { name: "Tangerine" })).toBeFocused();
  await expect(dialog.getByRole("status")).toHaveText("5 picked");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(add).toBeFocused();
  await expect(page.locator(".ui-token-label")).toHaveText(["Apple", "Pear", "Lime", "Orange", "Fig"]);
});

test("the Playwright helpers pick from a picker and remove a token", async ({ page }) => {
  await show(page, "picker");
  await pickFromPicker(page.getByRole("button", { name: "Add a fruit" }), ["Plum", /^Kiwi$/]);
  await expect(page.locator(".ui-token-label")).toHaveText(["Apple", "Pear", "Plum", "Lime", "Fig", "Kiwi"]);
  await removeToken(page.locator(".ui-picker"), "Pear");
  await expect(page.locator(".ui-token-label")).toHaveText(["Apple", "Plum", "Lime", "Fig", "Kiwi"]);
  // The focus goes to the next token's X.
  await expect(page.getByRole("button", { name: "Remove Plum" })).toBeFocused();
});

test("a list that closes on a click: a click outside closes it, and a pick closes it", async ({ page }) => {
  await show(page, "list");
  const add = page.getByRole("button", { name: "Add a basket" });
  await add.click();
  const dialog = page.getByRole("dialog", { name: "Add a basket" });
  await expect(dialog.getByRole("button", { name: "Any melon" })).toBeFocused();
  await page.mouse.click(5, 5);
  await expect(dialog).toBeHidden();
  await pickFromPicker(add, "Berries");
  await expect(page.getByTestId("baskets")).toHaveText("berries");
  await expect(add).toBeFocused();
});

test("on a phone the modal fills the screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 });
  await show(page, "picker");
  await page.getByRole("button", { name: "Add a fruit" }).click();
  const box = await page.getByRole("dialog").boundingBox();
  expect(box).toEqual({ x: 0, y: 0, width: 390, height: 760 });
});

test("tokens wrap on one line, and a long name wraps inside its token", async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 600 });
  await show(page, "tokens");
  const line = (await page.locator(".ui-tokens").boundingBox())!;
  const tokens = await page.locator(".ui-token").evaluateAll((all) => all.map((t) => t.getBoundingClientRect().toJSON() as DOMRect));
  expect(new Set(tokens.map((t) => Math.round(t.top))).size).toBeGreaterThan(1);
  for (const t of tokens) expect(t.right).toBeLessThanOrEqual(line.x + line.width + 0.5);
  expect(tokens[2]!.height).toBeGreaterThan(40);
});

// Screenshots for the PR: PR_SCREENSHOTS=1 bun run e2e -- picker.spec.ts
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2, viewport: { width: 760, height: 820 } });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  const shot = (what: string, theme: string) => join(dir, `orc-196-${what}-${theme}.png`);
  for (const theme of ["light", "dark"] as const) {
    test(`the picker controls, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      const main = page.locator("main");
      await show(page, "picker", theme);
      await main.screenshot({ path: shot("picker-closed", theme) });
      await page.getByRole("button", { name: "Add a fruit" }).click();
      await page.getByRole("button", { name: "Banana" }).click();
      await page.getByRole("button", { name: "Banana" }).waitFor({ state: "detached" });
      await page.screenshot({ path: shot("picker-modal", theme) });

      await show(page, "list", theme);
      await page.getByRole("button", { name: "Add a basket" }).click();
      await page.getByRole("dialog").waitFor();
      await page.screenshot({ path: shot("list-modal", theme) });

      await page.setViewportSize({ width: 480, height: 400 });
      await show(page, "tokens", theme);
      await main.screenshot({ path: shot("tokens", theme) });

      await show(page, "toggle", theme);
      await main.screenshot({ path: shot("number-toggle", theme) });

      await page.setViewportSize({ width: 760, height: 520 });
      await show(page, "chips", theme);
      await page.getByRole("button", { name: "Add a row" }).click();
      await page.getByRole("menu").waitFor();
      await page.screenshot({ path: shot("chips-menu", theme) });

      await page.setViewportSize({ width: 390, height: 760 });
      await show(page, "picker", theme);
      await page.getByRole("button", { name: "Add a fruit" }).click();
      await page.getByRole("dialog").waitFor();
      await page.screenshot({ path: shot("picker-phone", theme) });
    });
  }
});
