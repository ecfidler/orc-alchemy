// The fold of the Spell slots block in the Spells panel (ORC-286,
// docs/design/spells-panel.md "Where the circles are"). The block starts
// open. When the user folds it, it stays folded on this device: the fold is
// state of this browser only, as the theme is. It is not a Preference and
// not a part of the character. When localStorage cannot be read or written,
// as in some private windows, the fold stays in memory until the page
// reloads (storedValue of @orc-alchemy/ui).
import { storedValue, useStoredValue } from "@orc-alchemy/ui";

/** The localStorage key of the fold. The value "1" is a folded block; with no value the block is open. */
export const SPELL_SLOTS_FOLDED_KEY = "spell-slots-folded";

const folded = storedValue<boolean>(SPELL_SLOTS_FOLDED_KEY, {
  parse: (stored) => stored === "1",
  serialize: (value) => (value ? "1" : null),
  fallback: false,
});

/** True while the Spell slots block is folded, and the function that folds or opens it. */
export const useSpellSlotsFolded = () => useStoredValue(folded, false);
