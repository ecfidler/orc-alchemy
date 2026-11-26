// The level control of a class block (ORC-349, docs/design/character-builder.md "The class block"): a minus button,
// a number field and a plus button. The rules of a level are in engine/class-block.ts.
import { Button, NumberField } from "@orc-alchemy/ui";
import type { Ref } from "react";
import { MAX_CLASS_LEVEL } from "../engine/class-block.ts";

interface LevelControlProps {
  /** The name of the class, for the names of the controls: "Fighter level", "Add a Fighter level". */
  name: string;
  level: number;
  /** False when the class cannot have one more level, at class level 20 or at character level 20: the plus button is disabled. */
  canRaise: boolean;
  onLevel: (level: number) => void;
  /** A ref to the level field, for the focus. */
  field?: Ref<HTMLInputElement>;
}

/**
 * The level control of a class: a minus button, a number field that takes 1 to 20, and a plus button. The buttons have
 * an aria-label. A typed level counts when the field loses the focus, and at Enter, after which the focus stays in the
 * field. Up and Down in the field are the plus and the minus button. The field shows the level of the class: after a
 * typed level that does not count, such as a lower level after Cancel, it shows the level again. An arrow key sets the
 * level from the level of the class, and drops a typed level that did not count yet.
 */
export function LevelControl({ name, level, canRaise, onLevel, field }: LevelControlProps) {
  return (
    <span className="inline-flex items-center gap-1 font-sans text-[13px]">
      <span aria-hidden="true" className="mr-1 font-semibold">
        Level
      </span>
      <Button
        aria-label={`Remove a ${name} level`}
        icon="minus"
        disabled={level <= 1}
        onClick={() => onLevel(level - 1)}
        className="grid size-[34px] place-items-center p-0"
      />
      <NumberField
        aria-label={`${name} level`}
        min={1}
        max={MAX_CLASS_LEVEL}
        value={level}
        stepFromValue
        onValueChange={() => {}}
        onValueCommitted={(n) => {
          if (n !== null && n !== level) onLevel(n);
        }}
        inputRef={field}
        className="h-[34px] w-[46px] px-0 text-center font-serif text-[19px] font-medium"
      />
      <Button
        aria-label={`Add a ${name} level`}
        icon="plus"
        disabled={!canRaise}
        onClick={() => onLevel(level + 1)}
        className="grid size-[34px] place-items-center p-0"
      />
    </span>
  );
}
