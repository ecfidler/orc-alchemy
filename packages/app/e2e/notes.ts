import { expect, type Locator } from "@playwright/test";

/**
 * The stuck note's hard placement rule (docs/design/theme.md, "Stuck note"),
 * on a page of the app: the note overlaps its box's top edge, and its bottom
 * is above the box's content, under the box's top border and padding.
 */
export async function expectNoteClearOfContent(note: Locator) {
  const { noteBottom, boxTop, contentTop } = await note.evaluate((element) => {
    const box = element.parentElement!.lastElementChild!;
    const style = getComputedStyle(box);
    const rect = box.getBoundingClientRect();
    return {
      // The bounding box of the tilted note holds all of it, so this is the worst case.
      noteBottom: element.getBoundingClientRect().bottom,
      boxTop: rect.top,
      contentTop: rect.top + parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop),
    };
  });
  expect(noteBottom).toBeGreaterThan(boxTop);
  expect(noteBottom).toBeLessThanOrEqual(contentTop);
}
