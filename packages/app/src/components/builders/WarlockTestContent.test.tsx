// ORC-76 done-when: the forms recreate the whole warlock-test-content pack of
// the fixtures (the Spy background, the Keen Mind feat and the Drow subrace),
// and its .orcbrew export reads back as the fixture's pack.
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test } from "vitest";
import { withoutDisabledFlag } from "../../engine/content.ts";
import { engine, loadEngine } from "../../engine/engine.ts";
import { exportOrcbrew } from "../../engine/orcbrew-export.ts";
import { orcbrewHomebrew, useHomebrew } from "../../state/homebrew.ts";
import { HomebrewBuilder } from "../HomebrewBuilder.tsx";

beforeAll(() => loadEngine());
afterEach(async () => {
  cleanup();
  for (const { id } of useHomebrew.getState().packs) await useHomebrew.getState().remove(id);
});

const PACK = "Warlock Test Content";
const fixture = join(import.meta.dirname, "../../../../../fixtures/orcbrew/warlock-test-content.orcbrew");

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/content", element: <h1>My Content</h1> },
      { path: "/content/new/:type", element: <HomebrewBuilder /> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const check = (group: string, label: string) => fireEvent.click(within(screen.getByRole("group", { name: group })).getByLabelText(label));
async function save(router: ReturnType<typeof renderAt>) {
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  cleanup();
}
function addTrait(name: string, description: string) {
  fireEvent.click(screen.getByRole("button", { name: "Add feature / trait" }));
  type("Feature 1 name", name);
  type("Feature 1 description", description);
}

test("the background, feat and subrace forms recreate the warlock test content pack", async () => {
  let router = renderAt("/content/new/background");
  await screen.findByLabelText("Name");
  type("Option source (pack)", PACK);
  type("Name", "Spy");
  type(
    "Description",
    "Criminal variant. Ported from test/cljc/orcpub/dnd/e5/warlock_test.clj (spy-bg-cfg) so the warlock golden character can be built from an .orcbrew pack.",
  );
  check("Skill Proficiencies", "Deception");
  check("Skill Proficiencies", "Stealth");
  addTrait("Criminal Contact", "reliable criminal underworld contact");
  await save(router);

  router = renderAt("/content/new/feat");
  await screen.findByRole("group", { name: "Race prerequisites" });
  type("Option source (pack)", PACK);
  type("Name", "Keen Mind");
  type("Description", "increase INT by 1; always know north; recall anything within a month");
  check("Ability Increase Options", "Intelligence");
  await save(router);

  router = renderAt("/content/new/subrace");
  await screen.findByLabelText("Spell 1");
  type("Option source (pack)", PACK);
  type("Name", "Dark Elf (Drow)");
  type("Race", "~:elf");
  type("Charisma", "1");
  type("Darkvision", "120");
  for (const weapon of ["Rapier", "Shortsword", "Crossbow, hand"]) check("Weapon Proficiencies", weapon);
  addTrait("Sunlight Sensitivity", "Disadvantage on attack and perception rolls in direct sunlight");
  await save(router);

  expect(engine().validateForExport(useHomebrew.getState().homebrew!).valid).toBe(true);
  const parsed = engine().parseOrcbrew(readFileSync(fixture, "utf8"), { name: PACK }).data as Record<string, object>;
  expect(Object.keys(parsed)).toEqual([PACK]);
  expect(Object.keys(parsed[PACK]).sort()).toEqual(["~:orcpub.dnd.e5/backgrounds", "~:orcpub.dnd.e5/feats", "~:orcpub.dnd.e5/subraces"]);
  const exported = exportOrcbrew(orcbrewHomebrew(), { pack: PACK });
  if (!("text" in exported)) throw new Error("The pack did not export");
  // The whole pack, without the old pack flag, as in the ORC-75 fixture tests.
  expect(engine().parseOrcbrew(exported.text, { name: PACK }).data![PACK]).toEqual(withoutDisabledFlag(parsed[PACK]));
});
