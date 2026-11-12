// The helpers of the builder form tests: each select is found by its label, and a modifier by its name in the add list.
import { pickFromPicker, pickOption } from "@orc-alchemy/ui/testing";
import { screen } from "@testing-library/react";

const combobox = (label: string) => screen.getByRole("combobox", { name: label });

/** Picks the option named `option` in the select labelled `label`. */
export const choose = (label: string, option: string | RegExp) => pickOption(combobox(label), option);

/** The text of the select labelled `label`: its picked option. */
export const shown = (label: string) => combobox(label).textContent;

/** Adds the modifier named `name` from the "+ Add a modifier" list of the form. */
export const addModifier = (name: string) => pickFromPicker(screen.getByRole("button", { name: "Add a modifier" }), name);
