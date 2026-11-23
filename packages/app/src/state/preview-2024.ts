// The 2024 rules preview (ORC-238, ORC-308): a flag of this browser that
// shows the 2024 rules preview page at /dev/2024. The Experimental section of
// Preferences turns it on and off. It stays until the 2024 rules are a
// normal part of the app. When localStorage cannot be read or written, as
// in some private windows, the flag stays in memory until the page reloads
// (storedValue of @orc-alchemy/ui).
import { storedValue, useStoredValue } from "@orc-alchemy/ui";

/** The localStorage key of the flag. The value "on" turns the preview on; with no value it is off. */
export const PREVIEW_2024_KEY = "alchemy-dev-2024";

const previewStore = storedValue<boolean>(PREVIEW_2024_KEY, {
  parse: (stored) => stored === "on",
  serialize: (on) => (on ? "on" : null),
  fallback: false,
});

/** True while the 2024 rules preview is on, and the function that turns it on or off. */
export const usePreview2024 = () => useStoredValue(previewStore, false);
