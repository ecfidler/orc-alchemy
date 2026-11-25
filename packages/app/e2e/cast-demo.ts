// The page script of the unlinked-uses test of e2e/cast.spec.ts (ORC-321): the spell view of a spell with a cast
// note that names uses the app cannot link, in a wide Dialog, with SRD records. The SRD gives no such note to a
// spell with a level, so the sheet cannot show this case. The spec bundles this file with Bun; Playwright does not
// load it.
import { Dialog } from "@orc-alchemy/ui";
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { CastControl } from "../src/components/CastControl.tsx";
import { SpellView } from "../src/components/SpellView.tsx";
import { type CastSlots, castChoices } from "../src/engine/cast.ts";
import { loadSpellContent } from "../src/engine/spells.ts";

/** A warlock 20: 4 pact slots of the 5th level, none spent. */
const SLOTS: CastSlots = { slots: [], pact: { slotLevel: 5, count: 4, spent: 0 }, casters: [] };

declare global {
  interface Window {
    mountCast: (key: string, name: string, castNote: string) => Promise<void>;
  }
}

/** Loads the SRD records, then shows the spell view of the SRD spell `key`, known with the cast note `castNote`. */
window.mountCast = async (key, name, castNote) => {
  const record = (await loadSpellContent()).get(key)!;
  const spell = { key, source: "Warlock", prepared: false, castNote, level: record.level };
  const choices = castChoices(spell, record, SLOTS, null);
  const control =
    choices.kind === "none"
      ? null
      : h(CastControl, {
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
  createRoot(document.getElementById("root")!).render(
    h(Dialog, {
      open: true,
      onOpenChange: () => {},
      size: "wide",
      title: "Spells",
      footer: false,
      header: h("h2", { className: "ui-list-title" }, "Spells"),
      children: h(SpellView, { name, spell: { record, from: "SRD" }, castNote, control }),
    }),
  );
};
