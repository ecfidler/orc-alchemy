import { execFileSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";

// The page of the spell view alone (e2e/spell-view-demo.ts), which e2e/spell-view.spec.ts and e2e/cast.spec.ts
// share. Bun bundles the page's script once, at the first use. See e2e/picker.spec.ts for the reasons.

let script: string | undefined;
const pageScript = () =>
  (script ??= execFileSync(
    "bun",
    [
      "--eval",
      `
    const result = await Bun.build({ entrypoints: ["./spell-view-demo.ts"], define: { "process.env.NODE_ENV": '"development"' } });
    if (!result.success) throw new AggregateError(result.logs);
    process.stdout.write(await result.outputs[0].text());`,
    ],
    { cwd: import.meta.dirname, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  ));

/**
 * Shows the page with the spell of `key`, with the styles of the app, and opens the dialog from its button. With
 * `castNote`, the spell has that cast note and the Cast control of a warlock 20.
 */
export async function showSpellView(
  page: Page,
  key: string,
  name: string,
  { theme = "light", castNote = null }: { theme?: "light" | "dark"; castNote?: string | null } = {},
) {
  await page.goto("/");
  const styles = await page.evaluate(() => [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map((link) => link.href));
  const links = styles.map((href) => `<link rel="stylesheet" href="${href}">`).join("");
  await page.setContent(`<!doctype html><html data-theme="${theme}"><head>${links}</head><body><div id="root"></div></body></html>`);
  await page.addScriptTag({ content: pageScript() });
  await page.evaluate(async ([key, name, castNote]) => await window.mountSpell(key!, name!, castNote ?? null), [key, name, castNote]);
  await page.evaluate(() => document.fonts.ready);
  const open = page.getByRole("button", { name: "Open the spell" });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "Spells" });
  await expect(dialog).toBeVisible();
  return { open, dialog };
}
