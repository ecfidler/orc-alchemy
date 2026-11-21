// The page script of e2e/spell-view.spec.ts: the spell view in a wide Dialog, with SRD records.
// No page shows them yet (ORC-285 puts them in the Spells panel), so this page renders them alone.
// The spec bundles this file with Bun; Playwright does not load it.

import { Dialog } from "@orc-alchemy/ui";
import spells from "@pubdoor/dmv/content/spells.json";
import { createElement as h, useState } from "react";
import { createRoot } from "react-dom/client";
import { SpellView } from "../src/components/SpellView.tsx";
import type { SpellRecord, SpellRecordResult } from "../src/engine/spell-records.ts";

const SRD = new Map((spells as SpellRecord[]).map((spell) => [spell.key, spell]));

/** The spell to show for a key: an SRD record, or no record for a key that has none, as `tsunami`. */
const spellFor = (key: string): SpellRecordResult | undefined => {
  const record = SRD.get(key);
  return record && { record, from: "SRD" };
};

function Demo({ spellKey, name }: { spellKey: string; name: string }) {
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
      children: h(SpellView, { name, spell: spellFor(spellKey) }),
    }),
  );
}

declare global {
  interface Window {
    mountSpell: (key: string, name: string) => void;
  }
}

window.mountSpell = (key, name) => {
  createRoot(document.getElementById("root")!).render(h(Demo, { spellKey: key, name }));
};
