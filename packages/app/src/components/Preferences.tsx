// The Preferences page at /preferences (ORC-149, ORC-165). Each change applies
// at once; there is no Save button. Later options get their own headings below
// "Appearance". Preferences stay in this browser and are never exported.
import { Select, useThemePreference, type SelectOption, type ThemePreference } from "@orc-alchemy/ui";
import { useId } from "react";

const THEMES: SelectOption<ThemePreference>[] = [
  ["light", "Light"],
  ["dark", "Dark"],
  ["system", "Match System"],
];

export function Preferences() {
  const appearance = useId();
  const [theme, setTheme] = useThemePreference();
  return (
    <>
      <h1 className="text-xl">Preferences</h1>
      <section aria-labelledby={appearance} className="mt-4 space-y-2">
        <h2 id={appearance} className="font-bold">
          Appearance
        </h2>
        <label className="inline-flex items-center gap-2">
          Theme
          <Select value={theme} options={THEMES} onValueChange={setTheme} />
        </label>
      </section>
    </>
  );
}
