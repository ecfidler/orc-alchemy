import { Button, type ButtonVariant } from "@orc-alchemy/ui";
import { type ReactNode, useState } from "react";
import { hasCustomItems } from "../engine/custom.ts";
import { loadEngine } from "../engine/engine.ts";
import { characterFile, exportBundle } from "../engine/import.ts";
import { exportOrcbrew } from "../engine/orcbrew-export.ts";
import { flushAutosave } from "../state/character.ts";
import { bundleHomebrew, orcbrewHomebrew, restorePacks, useHomebrew } from "../state/homebrew.ts";
import { getCharacter, listCharacters } from "../storage/characters.ts";

/** What the old Dungeon Master's Vault does with custom options, for the export of one character and of all (ORC-137). */
const CUSTOM_WARNING_ONE = "This character has custom options. The old Dungeon Master's Vault cannot read them, so the character does not open there as it is.";
const CUSTOM_WARNING_ALL =
  "Some characters have custom options. The old Dungeon Master's Vault cannot read them, so those characters do not open there as they are.";

/**
 * Downloads a stored character as a dmv-character file, after saving any
 * pending changes. With custom content, it then warns that the old app
 * cannot read the custom options. Its messages show under the button, or,
 * with onMessages, where the caller puts them (ExportMessageLines), so a
 * row of buttons keeps its line. Loads the engine on demand.
 */
export function ExportCharacter({
  id,
  label = "Export this character",
  variant,
  onMessages,
}: {
  id: string;
  label?: ReactNode;
  variant?: ButtonVariant;
  onMessages?: (messages: ExportMessages) => void;
}) {
  return (
    <ExportButton
      label={label}
      variant={variant}
      onMessages={onMessages}
      onExport={async () => {
        await Promise.all([loadEngine(), flushAutosave()]);
        const record = await getCharacter(id);
        if (record === undefined) throw new Error("The character is no longer stored");
        download(`${fileName(record.name)}.json`, characterFile(record));
        return { warning: hasCustomItems(record.custom) ? CUSTOM_WARNING_ONE : null };
      }}
    />
  );
}

/**
 * Downloads every stored character, pack and magic item as a dmv-export
 * bundle, and the packs as all-content.orcbrew for the old app. The packs go in as stored,
 * disabled ones too: the bundle keeps their flags, and the .orcbrew file
 * marks them with the old app's :disabled? flag. Magic items go in as item
 * maps without their flags, so a browser that has none of them loads each one
 * enabled. A pack that fails validateForExport stops the .orcbrew file, not
 * the bundle. Quarantined records are left out, with a notice. Each
 * character goes in with its custom content, and when one has some, a
 * warning says that the old app cannot read it. The .orcbrew file has
 * packs only, never custom content. Loads the engine on demand.
 */
export function ExportEverything() {
  return (
    <div>
      <ExportButton
        label="Export everything"
        onExport={async () => {
          await Promise.all([loadEngine(), flushAutosave(), restorePacks()]);
          const records = await listCharacters();
          const packs = bundleHomebrew();
          const hasPacks = Object.keys(packs.homebrew).length > 0;
          const magicItems = useHomebrew.getState().magicItems.map((r) => r.item);
          if (records.length === 0 && !hasPacks && magicItems.length === 0) throw new Error("There are no characters or homebrew to export");
          download("dmv-export.json", exportBundle(records, window.location.origin, packs, magicItems));
          const notices: string[] = [];
          const { quarantined } = useHomebrew.getState();
          if (quarantined.length > 0) {
            notices.push(`These stored packs could not be read and are not in the export: ${quarantined.map((q) => q.id).join(", ")}.`);
          }
          if (hasPacks) {
            const orcbrew = exportOrcbrew(orcbrewHomebrew(), { pretty: true });
            if ("invalid" in orcbrew) {
              const names = orcbrew.invalid.map((p) => p.pack).join(", ");
              notices.push(`all-content.orcbrew was not written: the old app would refuse ${names}. To see why, or to export anyway, use My Content.`);
            } else downloadText(orcbrew.fileName, orcbrew.text, "application/edn");
          }
          return { message: notices.join(" ") || null, warning: records.some((r) => hasCustomItems(r.custom)) ? CUSTOM_WARNING_ALL : null };
        }}
      />
      <p>With homebrew, it also writes all-content.orcbrew for the old app. That file has no magic items, because the old app has no magic-item homebrew.</p>
    </div>
  );
}

/** What an export button shows after a click, or onExport returns after the download. */
export interface ExportMessages {
  /** Why the export failed, or the notice of a partial export. */
  message: string | null;
  /** What the old app cannot read in the export. */
  warning: string | null;
}

const NO_MESSAGES: ExportMessages = { message: null, warning: null };

/** An export's messages in their own block: the message as an alert, and the warning as a note in --warning text. Nothing with neither. */
export function ExportMessageLines({ message, warning, className = "" }: ExportMessages & { className?: string }) {
  if (!message && !warning) return null;
  return (
    <div className={`space-y-1 ${className}`}>
      {message && <p role="alert">{message}</p>}
      {warning && (
        <p role="note" className="text-warning">
          {warning}
        </p>
      )}
    </div>
  );
}

/** With onMessages, the button gives its messages to the caller and does not show them. */
function ExportButton({
  label,
  variant = "link",
  onExport,
  onMessages,
}: {
  label: ReactNode;
  variant?: ButtonVariant;
  /** Downloads the file, and returns what to show after it, or nothing. */
  onExport: () => Promise<Partial<ExportMessages> | void>;
  onMessages?: (messages: ExportMessages) => void;
}) {
  const [messages, setMessages] = useState<ExportMessages>(NO_MESSAGES);
  const show = (next: ExportMessages) => (onMessages ?? setMessages)(next);
  async function onClick() {
    show(NO_MESSAGES);
    try {
      const result = await onExport();
      show({ ...NO_MESSAGES, ...result });
    } catch (e) {
      show({ message: e instanceof Error ? e.message : String(e), warning: null });
    }
  }
  if (onMessages) {
    return (
      <Button onClick={onClick} variant={variant}>
        {label}
      </Button>
    );
  }
  return (
    <div className="space-y-1">
      <Button onClick={onClick} variant={variant}>
        {label}
      </Button>
      <ExportMessageLines {...messages} />
    </div>
  );
}

function download(name: string, data: unknown) {
  downloadText(name, JSON.stringify(data, null, 2), "application/json");
}

/** Downloads text as a file. */
export function downloadText(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // Some browsers read the blob after click() returns, so keep it a while.
  setTimeout(() => URL.revokeObjectURL(url), 40_000);
}

/** The browser replaces any characters a file system refuses. */
const fileName = (name: string | null) => name?.trim() || "character";
