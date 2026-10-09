import { useMemo, useState } from "react";
import { missingContent, OPTION_LABEL, type ContentSuggestion, type UnresolvedKey } from "../engine/reconcile.ts";
import { useCharacter } from "../state/character.ts";
import { useHomebrew } from "../state/homebrew.ts";

type OnRemap = (unresolved: UnresolvedKey, newKey: string) => Promise<void>;

const suggestionLabel = ({ key, name, source, similarity }: ContentSuggestion) =>
  `${name ?? key} (${key}${source ? `, from ${source}` : ""}, ${Math.round(similarity * 100)}% match)`;

/** The unresolved key above u in the character, if any: a remap of u cannot resolve while it does not. */
const unresolvedParent = (u: UnresolvedKey, unresolved: UnresolvedKey[]) =>
  unresolved.find((other) => other.path.length < u.path.length && other.path.every((key, i) => u.path[i] === key));

/**
 * A character's option keys that do not resolve (quirk R8), left out of its
 * sheet. With onRemap, each key with suggestions offers them and a Remap
 * button. Remap gives the option the chosen key. A key stays unresolved
 * until the user remaps it. A key under another unresolved key offers no
 * remap until that one resolves.
 */
export function UnresolvedContent({
  characterName,
  unresolved,
  onRemap,
}: {
  characterName: string;
  unresolved: UnresolvedKey[];
  onRemap?: OnRemap;
}) {
  if (unresolved.length === 0) return null;
  return (
    <>
      <p>Unresolved content, left out of the sheet:</p>
      <ul aria-label={`Unresolved content for ${characterName}`} className="ml-4 list-disc space-y-1">
        {unresolved.map((u) => {
          const parent = unresolvedParent(u, unresolved);
          return (
            <li key={u.path.join("/")}>
              {u.label}: {u.key} ({u.path.join(" / ")})
              {onRemap &&
                u.suggestions.length > 0 &&
                (parent ? (
                  <p>
                    {parent.label === OPTION_LABEL
                      ? "To remap it, first load the pack that has the option above it."
                      : `To remap it, first remap its ${parent.label.toLowerCase()} or load the pack that has it.`}
                  </p>
                ) : (
                  <Remap unresolved={u} onRemap={onRemap} />
                ))}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Remap({ unresolved, onRemap }: { unresolved: UnresolvedKey; onRemap: OnRemap }) {
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remap() {
    setError(null);
    setBusy(true);
    try {
      await onRemap(unresolved, to);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={`Replacement for ${unresolved.key}`}
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="border border-black"
      >
        <option value="">Leave it unresolved</option>
        {unresolved.suggestions.map((s) => (
          <option key={s.key} value={s.key}>
            {suggestionLabel(s)}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label={`Remap ${unresolved.key}`}
        disabled={to === "" || busy}
        onClick={remap}
        className="border border-black px-2 disabled:opacity-50"
      >
        Remap
      </button>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}

/** The open character's unresolved content, checked against the loaded packs, for its sheet. */
export function OpenCharacterGaps({ characterName }: { characterName: string }) {
  const entity = useCharacter((state) => state.entity);
  const homebrew = useHomebrew((state) => state.homebrew);
  const unresolved = useMemo(() => (entity === null ? [] : missingContent(entity, homebrew)), [entity, homebrew]);
  if (unresolved.length === 0) return null;
  return (
    <section aria-label="Unresolved content" className="border border-black p-2">
      <UnresolvedContent characterName={characterName} unresolved={unresolved} />
      <p>To use it, load the homebrew pack that has it on the Import page.</p>
    </section>
  );
}
