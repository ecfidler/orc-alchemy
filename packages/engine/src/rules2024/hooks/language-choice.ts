// The hook `language-choice`: a choice of languages that the character does
// not know yet, from the Standard and the Rare Languages tables (SRD 5.2.1
// p20), for example the other language of Thieves' Cant (p62). The options
// are the language records of the loaded content, so a homebrew language is
// an option too.

import { z } from "zod";
import { selection } from "../../core/template.ts";
import type { Built2024 } from "../built.ts";
import { languageOption, notAlready } from "../choices.ts";
import { recordsOf } from "../content.ts";
import { defineHook } from "./hook.ts";

export const languageChoiceHook = defineHook({
  name: "language-choice",
  args: z.strictObject({
    /** The name of the choice, for example "Thieves' Cant". */
    name: z.string().min(1),
    count: z.int().min(1).default(1),
  }),
  apply: ({ name, count }, call) => ({
    modifiers: [],
    selections: [
      selection<Built2024>({
        name,
        min: count,
        max: count,
        options: recordsOf(call.content, "languages").map(({ reference, record }) =>
          languageOption(reference, record.name, [notAlready("Not known already", (built) => built.languages, reference)]),
        ),
      }),
    ],
  }),
});
