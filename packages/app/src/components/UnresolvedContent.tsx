import { Button, Select, StuckNote } from "@orc-alchemy/ui";
import { useMemo, useState } from "react";
import { Link } from "react-router";
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
      <Select
        aria-label={`Replacement for ${unresolved.key}`}
        value={to}
        options={[["", "Leave it unresolved"], ...unresolved.suggestions.map((s): [string, string] => [s.key, suggestionLabel(s)])]}
        onValueChange={setTo}
      />
      <Button aria-label={`Remap ${unresolved.key}`} disabled={to === "" || busy} onClick={remap} size="small">
        Remap
      </Button>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}

/**
 * The open character's unresolved content, checked against the loaded packs,
 * for its sheet. The user must act, so a stuck note says how.
 */
export function OpenCharacterGaps({ characterName }: { characterName: string }) {
  const entity = useCharacter((state) => state.entity);
  const content = useHomebrew((state) => state.content);
  const unresolved = useMemo(() => (entity === null ? [] : missingContent(entity, content)), [entity, content]);
  if (unresolved.length === 0) return null;
  const note = (
    <>
      <b>
        {unresolved.length} {unresolved.length === 1 ? "option is" : "options are"} left out of the sheet.
      </b>{" "}
      To use {unresolved.length === 1 ? "it" : "them"}, load the homebrew pack on the <Link to="/import">Import page</Link>.
    </>
  );
  return (
    <StuckNote note={note}>
      <section aria-label="Unresolved content" className="border border-black p-2">
        <UnresolvedContent characterName={characterName} unresolved={unresolved} />
      </section>
    </StuckNote>
  );
}
