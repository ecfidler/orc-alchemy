import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

const LONG = "A long note that wraps to the widest note the package draws, at 240 pixels, so the tilt drops its low corner the most.";
const cases = [
  { name: "a framed box, long note", width: 420, note: LONG, box: "FramedBox" },
  { name: "a framed box, short note", width: 420, note: "Short.", box: "FramedBox" },
  { name: "a framed box in a narrow column", width: 180, note: "A note in a narrow column, narrower than the widest note.", box: "FramedBox" },
  { name: "a small box", width: 420, note: LONG, box: "SmallBox" },
  { name: "a stat box", width: 420, note: LONG, box: "StatBox" },
] as const;

// Playwright compiles JSX in the files it loads as component-test JSX.
// So Bun, which runs the package's TSX as it is, renders the markup, once for all cases.
const markup: string[] = JSON.parse(
  execFileSync(
    "bun",
    [
      "--eval",
      `
      import { createElement as h } from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      import { FramedBox, SmallBox, StatBox, StuckNote } from "@orc-alchemy/ui";
      const boxes = {
        FramedBox: () => h(FramedBox, { label: "Box" }, h("p", null, "The box's content")),
        SmallBox: () => h(SmallBox, { label: "Box", value: "+2" }),
        StatBox: () => h(StatBox, { label: "Box", value: "+3", oval: "16" }),
      };
      const cases = ${JSON.stringify(cases)};
      console.log(JSON.stringify(cases.map((c) => renderToStaticMarkup(h(StuckNote, { note: c.note }, boxes[c.box]())))));`,
    ],
    { cwd: import.meta.dirname, encoding: "utf8" },
  ),
);

// The stuck note's hard placement rule (docs/design/theme.md, "Stuck note"), measured with the app's own CSS.
cases.forEach(({ name, width, box: kind }, i) => {
  test(`a stuck note overlaps only the top edge of its box: ${name}, ${width}px column`, async ({ page }) => {
    await page.goto("/");
    const styles = await page.evaluate(() => [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map((link) => link.href));
    expect(styles.length).toBeGreaterThan(0);
    const links = styles.map((href) => `<link rel="stylesheet" href="${href}">`).join("");
    await page.setContent(`${links}<main style="width:${width}px;padding:40px">${markup[i]}</main>`);
    // The note's size, and so its tilted corner, depends on the font.
    await page.evaluate(() => document.fonts.ready);

    const rect = (selector: string) => page.locator(selector).evaluate((element) => element.getBoundingClientRect().toJSON() as DOMRect);
    // The top of the content inside the box's first part, below that part's border and padding.
    const contentTop = await page.locator(".ui-stuck > :last-child > :first-child").evaluate((element) => {
      const style = getComputedStyle(element);
      return element.getBoundingClientRect().top + parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop);
    });
    // The bounding box of the tilted note holds all of it, so this is the worst case.
    const [noteBox, box] = [await rect(".ui-stuck-note"), await rect(".ui-stuck > :last-child")];
    expect(noteBox.bottom).toBeGreaterThan(box.top);
    expect(noteBox.bottom).toBeLessThanOrEqual(contentTop);
    if (kind === "SmallBox") {
      // The value cell starts at the top of the box, so the divider runs to the box's top edge.
      expect((await rect(".ui-small-box-value")).top - box.top).toBeLessThan(2);
    }
  });
});
