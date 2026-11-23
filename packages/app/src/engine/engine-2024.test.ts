// The app consumes the 2024 engine as a workspace package (ORC-222). The
// sheet for a 2024 character comes in ORC-238.

import { evaluate } from "@orc-alchemy/engine";
import { expect, test } from "vitest";

test("the 2024 engine package resolves from the app", () => {
  expect(evaluate({ selections: [] }, { rules: "2024" }).built.proficiencyBonus).toBe(2);
});
