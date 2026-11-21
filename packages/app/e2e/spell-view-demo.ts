// The page script of e2e/spell-view.spec.ts: the spell view in a wide Dialog, with SRD records.
// The Spells panel (ORC-285, e2e/spells-panel.spec.ts) shows them on the sheet; this page tests the view alone.
// The spec bundles this file with Bun; Playwright does not load it.
import { Dialog } from "@orc-alchemy/ui";
import { createElement as h, useState } from "react";
import { createRoot } from "react-dom/client";
import { SpellView } from "../src/components/SpellView.tsx";
import type { SpellRecordResult } from "../src/engine/spell-records.ts";
import { loadSpellContent } from "../src/engine/spells.ts";

function Demo({ spell, name }: { spell: SpellRecordResult | undefined; name: string }) {
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
      children: h(SpellView, { name, spell }),
    }),
  );
}

declare global {
  interface Window {
    mountSpell: (key: string, name: string) => Promise<void>;
  }
}

/** Loads the SRD records, then shows the spell of `key`: its SRD record, or no record for a key that has none, as `tsunami`. */
window.mountSpell = async (key, name) => {
  const record = (await loadSpellContent()).get(key);
  const spell: SpellRecordResult | undefined = record && { record, from: "SRD" };
  createRoot(document.getElementById("root")!).render(h(Demo, { spell, name }));
};
