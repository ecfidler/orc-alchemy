// The select helpers of the builder form tests: each control is found by its label.
import { pickOption } from "@orc-alchemy/ui/testing";
import { screen } from "@testing-library/react";

const combobox = (label: string) => screen.getByRole("combobox", { name: label });

/** Picks the option named `option` in the select labelled `label`. */
export const choose = (label: string, option: string | RegExp) => pickOption(combobox(label), option);

/** The text of the select labelled `label`: its picked option. */
export const shown = (label: string) => combobox(label).textContent;
