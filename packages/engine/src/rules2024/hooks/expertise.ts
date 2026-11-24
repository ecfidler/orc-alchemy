// The hook `expertise`: a choice of skills in which the character gains
// Expertise, for example the Rogue at levels 1 and 6 (SRD 5.2.1 p61). An
// option needs the proficiency in the skill, and a skill can have Expertise
// once (p182).

import { z } from "zod";
import { option, type Prereq, selection } from "../../core/template.ts";
import { type Built2024, m, SKILLS, type Skill } from "../built.ts";
import { notAlready, skillName } from "../choices.ts";
import { defineHook } from "./hook.ts";

function skillPrereqs(skill: Skill, name: string): Prereq<Built2024>[] {
  return [
    { label: `Proficiency in ${name}`, canChoose: (built) => built.skillProficiencies.includes(skill) },
    notAlready("Not Expertise already", (built) => built.expertise, skill),
  ];
}

export const expertiseHook = defineHook({
  name: "expertise",
  args: z.strictObject({
    /** The number of skills. */
    count: z.int().min(1),
  }),
  apply: ({ count }, call) => ({
    modifiers: [],
    selections: [
      selection<Built2024>({
        name: "Expertise",
        min: count,
        max: count,
        options: (Object.keys(SKILLS) as Skill[]).map((skill) => {
          const name = skillName(call.content, skill);
          return option<Built2024>({ key: skill, name, modifiers: [m.push("expertise", skill)], prereqs: skillPrereqs(skill, name) });
        }),
      }),
    ],
  }),
});
