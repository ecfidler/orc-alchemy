import { Checkbox, Select, type SelectOption, type ThemePreference, useThemePreference } from "@orc-alchemy/ui";
import { useId } from "react";
import { Link } from "react-router";
import { usePreview2024 } from "../state/preview-2024.ts";

const THEMES: SelectOption<ThemePreference>[] = [
  ["light", "Light"],
  ["dark", "Dark"],
  ["system", "Match System"],
];

/**
 * The Preferences page at `/preferences` (ORC-149). Each change applies at
 * once; there is no Save button. Later options get their own headings below
 * "Appearance". Preferences stay in this browser and are never exported.
 * "Experimental" holds features that are not finished (ORC-308).
 */
export function Preferences() {
  const appearance = useId();
  const experimental = useId();
  const [theme, setTheme] = useThemePreference();
  const [preview, setPreview] = usePreview2024();
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
      <section aria-labelledby={experimental} className="mt-6 space-y-2">
        <h2 id={experimental} className="font-bold">
          Experimental
        </h2>
        <p className="text-sm text-ink-muted">Features that are not finished. They can change or break.</p>
        <Checkbox checked={preview} onCheckedChange={setPreview} label="2024 rules preview" />
        {preview && (
          <p>
            <Link to="/dev/2024" className="underline">
              Open the 2024 rules preview
            </Link>
          </p>
        )}
      </section>
    </>
  );
}
