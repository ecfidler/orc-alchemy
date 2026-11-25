// The page script of e2e/spell-view.spec.ts: the spell view in a wide Dialog, with SRD records.
// The Spells panel (ORC-285, e2e/spells-panel.spec.ts) shows them on the sheet; this page tests the view alone.
// With a cast note, the view also has the Cast control of a warlock 20 (ORC-321, e2e/cast.spec.ts): a note such as
// "uses Fey Step" that the app cannot link. The SRD gives no such note to a spell with a level, so the sheet cannot
// show this case. The specs bundle this file with Bun (e2e/spell-view-page.ts); Playwright does not load it.
import { Dialog } from "@orc-alchemy/ui";
import { createElement as h, type ReactNode, useState } from "react";
import { createRoot } from "react-dom/client";
import { CastControl } from "../src/components/CastControl.tsx";
import { SpellView } from "../src/components/SpellView.tsx";
import { type CastSlots, castChoices } from "../src/engine/cast.ts";
import type { SpellRecordResult } from "../src/engine/spell-records.ts";
import { loadSpellContent } from "../src/engine/spells.ts";

/** A warlock 20: 4 pact slots of the 5th level, none spent. */
const SLOTS: CastSlots = { slots: [], pact: { slotLevel: 5, count: 4, spent: 0 }, casters: [] };

function Demo({ spell, name, castNote, control }: { spell: SpellRecordResult | undefined; name: string; castNote: string | null; control: ReactNode }) {
  const [open, setOpen] = useState(false);
  return h(
    "main",
    { style: { padding: "24px 16px" } },
    h("button", { type: "button", onClick: () => setOpen(true) }, "Open the spell"),
    h(Dialog, {
      open,
      onOpenChange: setOpen,
      size: "wide",
      title: "Spells",
      footer: false,
      header: h("h2", { className: "ui-list-title" }, "Spells"),
      children: h(SpellView, { name, spell, castNote, control }),
    }),
  );
}

/** The Cast control of the SRD spell of `record`, known by a warlock 20 with the cast note `castNote`, or null for no control. */
function castControl(record: SpellRecordResult["record"], name: string, castNote: string): ReactNode {
  const spell = { key: record.key, source: "Warlock", prepared: false, castNote, level: record.level };
  const choices = castChoices(spell, record, { slots: SLOTS, concentration: null, uses: [] });
  if (choices.kind === "none") return null;
  return h(CastControl, {
    spell,
    name,
    record,
    choices,
    concentration: null,
    concentrationName: null,
    onCast: () => {},
    status: "",
    statusKey: 0,
    phone: window.matchMedia("(max-width: 600px)").matches,
  });
}

declare global {
  interface Window {
    mountSpell: (key: string, name: string, castNote: string | null) => Promise<void>;
  }
}

/**
 * Loads the SRD records, then shows the spell of `key`: its SRD record, or no record for a key that has none, as
 * `tsunami`. With `castNote`, the spell has that cast note and its Cast control.
 */
window.mountSpell = async (key, name, castNote) => {
  const record = (await loadSpellContent()).get(key);
  const spell: SpellRecordResult | undefined = record && { record, from: "SRD" };
  const control = record && castNote !== null ? castControl(record, name, castNote) : null;
  createRoot(document.getElementById("root")!).render(h(Demo, { spell, name, castNote, control }));
};
