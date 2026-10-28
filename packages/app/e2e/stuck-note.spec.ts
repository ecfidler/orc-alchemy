import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

// Playwright compiles JSX in the files it loads as component-test JSX, so Bun, which runs the package's TSX as it is, renders the markup.
function stuckNoteMarkup(note: string): string {
  const script = `
    import { createElement as h } from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { FramedBox, StuckNote } from "@orc-alchemy/ui";
    const content = h("p", { id: "content" }, "The box's content");
    console.log(renderToStaticMarkup(h(StuckNote, { note: ${JSON.stringify(note)} }, h(FramedBox, { label: "Box" }, content))));`;
  return execFileSync("bun", ["--eval", script], { cwd: import.meta.dirname, encoding: "utf8" });
}

// The stuck note's hard placement rule (docs/design/theme.md, "Stuck note"), measured with the app's own CSS.
for (const [width, note] of [
  [420, "A long note that wraps to the widest note the package draws, at 240 pixels, so the tilt drops its low corner the most."],
  [420, "Short."],
  [180, "A note in a narrow column, which is narrower than the widest note."],
] as const) {
  test(`a stuck note overlaps only the top edge of its box, in a ${width}px column: "${note.slice(0, 12)}"`, async ({ page }) => {
    await page.goto("/");
    const styles = await page.evaluate(() => [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map((link) => link.href));
    expect(styles.length).toBeGreaterThan(0);
    const links = styles.map((href) => `<link rel="stylesheet" href="${href}">`).join("");
    await page.setContent(`${links}<main style="width:${width}px;padding:40px">${stuckNoteMarkup(note)}</main>`);

    const rect = (selector: string) => page.locator(selector).evaluate((element) => element.getBoundingClientRect().toJSON() as DOMRect);
    // The bounding box of the tilted note holds all of it, so this is the worst case.
    const [noteBox, box, content] = [await rect(".ui-stuck-note"), await rect(".ui-framed-box"), await rect("#content")];
    expect(noteBox.bottom).toBeGreaterThan(box.top);
    expect(noteBox.bottom).toBeLessThanOrEqual(content.top);
  });
}
