// The tests of the vitals panel of the character sheet. Each test renders the whole sheet.
import { optionNames, pickOption } from "@orc-alchemy/ui/testing";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { toSheet } from "../engine/sheet.ts";
import { CharacterSheet } from "./CharacterSheet.tsx";
import { expectedOf, playMocks, sheet, sheetTestHooks } from "./test-sheet.ts";

sheetTestHooks();

test("the builder preview leaves out temporary hit points and death saves", () => {
  render(<CharacterSheet sheet={{ ...sheet, currentHitPoints: 20 }} preview />);
  expect(screen.getByLabelText("Hit Points").textContent).toBe("20 / 28");
  expect(screen.queryByLabelText("Temporary")).toBeNull();
  expect(screen.queryByRole("img", { name: /^(Successes|Failures):/ })).toBeNull();
  // The preview shows the play state of the hit dice, and the box is not a button.
  expect(screen.getByRole("group", { name: "Hit dice" }).textContent).toBe("3 / 3d10");
  expect(screen.queryByRole("button", { name: /^Hit dice/ })).toBeNull();
});

// ORC-176: layout fixes from the level 20 audit.
test("the speed qualifier and the other speeds are separate small lines under the first speed", () => {
  render(
    <CharacterSheet
      sheet={{
        ...sheet,
        speeds: [
          { feet: 60, label: "unarmored" },
          { feet: 30, label: "armored" },
        ],
      }}
    />,
  );
  const speed = screen.getByRole("group", { name: "Speed" });
  expect(speed.textContent).toBe("60 ft. unarmored30 ft. armored");
  // The qualifier is not in the large number font.
  expect(within(speed).getByText("unarmored").className).toContain("text-[9.5px]");
});

/** A sheet with the rows of fighter-20, plate and a shield worn, and the AC pick `pick` (ORC-325). */
const pickedSheet = (pick: unknown = undefined) =>
  toSheet(expectedOf("fighter-20"), pick === undefined ? {} : { "~:orcpub.entity.strict/values": { "~:orc-alchemy.play/ac-pick": pick } });
/** The rows of the table "AC by armor" as [dot, armor, tag, AC, bold], from the text that shows. */
const acTable = () =>
  within(screen.getByRole("table", { name: "Armor class options" }))
    .getAllByRole("row")
    .slice(1)
    .map((row) => {
      const [dot, armor, ac] = [...row.querySelectorAll("td")];
      const shown = (cell: Element | undefined) => cell?.querySelector("span > span:not([aria-hidden])")?.textContent;
      return [dot?.textContent, shown(armor), armor?.querySelector(".uppercase")?.textContent ?? "", shown(ac), row.className.includes("font-semibold")];
    });

test("with play, the Armor Class box is a button that opens the menu Armor class shows; a pick calls play.onAcPick (ORC-325)", async () => {
  const play = playMocks();
  render(<CharacterSheet sheet={pickedSheet()} play={play} />);
  const box = screen.getByRole("button", { name: "Armor class, 20" });
  expect([box.getAttribute("aria-haspopup"), box.textContent]).toEqual(["menu", "20Armor Class"]);
  // The box is not a group in play: the button names it.
  expect(screen.queryByRole("group", { name: "Armor Class" })).toBeNull();
  expect(await optionNames(box)).toEqual([
    "Worn armor 20",
    "Chain Mail + Shield 18",
    "Chain Mail 16",
    "Plate + Shield 20",
    "Plate 18",
    "Unarmored + Shield 15",
    "Unarmored 13",
  ]);
  fireEvent.click(box);
  const menu = await screen.findByRole("menu", { name: "Armor class shows" });
  // Without a pick, Worn armor is checked.
  expect(
    within(menu)
      .getByRole("menuitemradio", { name: /^Worn armor/ })
      .getAttribute("aria-checked"),
  ).toBe("true");
  fireEvent.keyDown(menu, { key: "Escape" });
  await pickOption(box, "Chain Mail 16");
  expect(play.onAcPick).toHaveBeenLastCalledWith({ armor: "chain-mail", shield: null });
  await pickOption(box, "Unarmored 13");
  expect(play.onAcPick).toHaveBeenLastCalledWith({ armor: null, shield: null });
  await pickOption(box, "Worn armor 20");
  expect(play.onAcPick).toHaveBeenLastCalledWith(null);
  expect(play.onAcPick).toHaveBeenCalledTimes(3);
});

test("a pick changes only the number in the box, checks its row in the menu, and marks its row in the table; the worn row keeps its tag (ORC-325)", async () => {
  render(<CharacterSheet sheet={pickedSheet({ "~:armor": "~:chain-mail", "~:shield": null })} play={playMocks()} />);
  const box = screen.getByRole("button", { name: "Armor class, 16" });
  expect(box.textContent).toBe("16Armor Class");
  expect(acTable()).toEqual([
    ["", "Chain Mail + Shield", "", "18", false],
    ["E", "Chain Mail", "", "16", true],
    ["", "Plate + Shield", "worn", "20", false],
    ["", "Plate", "", "18", false],
    ["", "Unarmored + Shield", "", "15", false],
    ["", "Unarmored", "", "13", false],
  ]);
  expect(screen.getAllByRole("img", { name: "Shows in the Armor Class box" })).toHaveLength(1);
  fireEvent.click(box);
  const menu = await screen.findByRole("menu", { name: "Armor class shows" });
  expect(
    within(menu)
      .getAllByRole("menuitemradio")
      .filter((item) => item.getAttribute("aria-checked") === "true")
      .map((item) => item.textContent),
  ).toEqual(["Chain Mail 16"]);
});

test("a pick of a pair that is not in the table is ignored: the worn AC shows, and Worn armor is checked (ORC-325)", async () => {
  render(<CharacterSheet sheet={pickedSheet({ "~:armor": "~:leather", "~:shield": null })} play={playMocks()} />);
  const box = screen.getByRole("button", { name: "Armor class, 20" });
  expect(acTable().filter(([dot]) => dot === "E")).toEqual([["E", "Plate + Shield", "worn", "20", true]]);
  fireEvent.click(box);
  const menu = await screen.findByRole("menu", { name: "Armor class shows" });
  expect(
    within(menu)
      .getByRole("menuitemradio", { name: /^Worn armor/ })
      .getAttribute("aria-checked"),
  ).toBe("true");
});

test("without play, the Armor Class box is not a button; the table shows the same marks (ORC-325)", () => {
  render(<CharacterSheet sheet={pickedSheet({ "~:armor": "~:plate", "~:shield": null })} />);
  expect(screen.queryByRole("button", { name: /^Armor class/ })).toBeNull();
  expect(screen.getByLabelText("Armor Class").textContent).toBe("18");
  expect(acTable().filter(([dot, , tag]) => dot === "E" || tag === "worn")).toEqual([
    ["", "Plate + Shield", "worn", "20", false],
    ["E", "Plate", "", "18", true],
  ]);
});
