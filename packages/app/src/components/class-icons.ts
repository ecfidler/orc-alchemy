// The icon of each SRD class (docs/design/theme.md, "Class icons"; ORC-337, ORC-349). The ui package has no 5e words,
// so it names each icon for its drawing, and the app holds the list of the icon of each class.
import type { PixelIconName } from "@orc-alchemy/ui";

/** The pixel icon of each SRD class, by the class key. */
export const CLASS_ICONS: Record<string, PixelIconName> = {
  barbarian: "anger",
  bard: "note",
  cleric: "sun",
  druid: "leaf",
  fighter: "helmet",
  monk: "figure",
  paladin: "shield",
  ranger: "arrow",
  rogue: "dagger",
  sorcerer: "spiral",
  warlock: "chain",
  wizard: "book",
};

/** The icon of the class with the key, or undefined for a class with no icon, such as a homebrew class. */
export const classIcon = (key: string): PixelIconName | undefined => (Object.hasOwn(CLASS_ICONS, key) ? CLASS_ICONS[key] : undefined);
