import type { Page } from "@playwright/test";

// The helpers that the e2e specs of the homebrew forms share.

/** The card of feature n in a feature list: the box around its fields. */
export const featureCard = (page: Page, n: number) => page.getByRole("textbox", { name: `Feature ${n} name` }).locator("xpath=ancestor::div[contains(@class, 'bg-paper-raised')][1]");
