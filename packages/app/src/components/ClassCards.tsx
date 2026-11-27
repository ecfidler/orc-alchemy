// The class cards and the modal of a class (ORC-349, ORC-351, docs/design/character-builder.md "The class cards" and
// "A second class"): the cards of the first class, of Change and of "Add a class", and the modal that a card or About
// opens.
import { Button, Dialog, PixelIcon } from "@orc-alchemy/ui";
import { type ReactNode, useId, useState } from "react";
import type { BuilderOption } from "../engine/builder.ts";
import { type ClassNeeds, needsText } from "../engine/class-block.ts";
import { CLASS_TYPE } from "../engine/class-detail.ts";
import { ClassDetail } from "./ClassDetail.tsx";
import { classIcon } from "./class-icons.ts";
import { useOptionPack } from "./OptionDetail.tsx";

interface ClassCardsProps {
  options: BuilderOption[];
  /** The classes that the character cannot take, by key, with what each needs (unavailableClasses). */
  needs?: Map<string, ClassNeeds>;
  /** The button of the modal of a card that makes the pick, with the function that closes the modal. */
  action: (option: BuilderOption, close: () => void) => ReactNode;
}

/**
 * The class cards (spec, "The class cards"): 6 in a row, and 3 in a row when the part is narrower than 560px. A card
 * shows the class icon at 32px and the name; a class with no icon shows the name only, at the same size. A click on a
 * card opens the class in a modal, with the action. The modal gives the focus back to its card when it closes. A class
 * in `needs` cannot be taken: its card is dimmed, with what it needs below the name ("Needs Str 13"), and its card is a
 * little higher for two lines of that text (ORC-351).
 */
export function ClassCards({ options, action, needs }: ClassCardsProps) {
  const id = useId();
  const [shown, setShown] = useState<BuilderOption | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <div className="@container/classes">
      <ul aria-label="Classes" className="grid grid-cols-3 gap-2 @min-[560px]/classes:grid-cols-6">
        {options.map((option) => {
          const icon = classIcon(option.key);
          const need = needs?.get(option.key);
          const needId = `${id}-${option.key}`;
          return (
            <li key={option.key}>
              <Button
                variant="bare"
                data-class-card=""
                data-unavailable={need === undefined ? undefined : ""}
                aria-haspopup="dialog"
                aria-label={need === undefined ? undefined : option.name}
                aria-describedby={need === undefined ? undefined : needId}
                onClick={() => {
                  setShown(option);
                  setOpen(true);
                }}
                className={`grid w-full place-items-center gap-0.5 border border-rule-strong bg-paper-raised px-1 pt-2 pb-1.5 text-center font-sans text-[13.5px] leading-tight font-semibold hover:bg-panel ${needs ? "h-[106px] grid-rows-[36px_auto_26px]" : "h-[92px] grid-rows-[36px_auto_14px]"}`}
              >
                {icon ? <PixelIcon name={icon} className={`me-0 size-8 ${need === undefined ? "" : "opacity-40"}`} /> : <span />}
                <span className={`max-w-full min-w-0 [overflow-wrap:anywhere] ${need === undefined ? "" : "opacity-40"}`}>{option.name}</span>
                <small id={needId} className="self-start text-[10.5px] leading-[1.15] font-medium text-ink-muted">
                  {need === undefined ? "" : needsText(need)}
                </small>
              </Button>
            </li>
          );
        })}
      </ul>
      {shown && <ClassModal option={shown} open={open} onOpenChange={setOpen} action={action(shown, () => setOpen(false))} />}
    </div>
  );
}

/**
 * The modal of a class: the detail of the class (ClassDetail), which scrolls, and, when it has one, the action in a
 * row at the bottom right that stays in view (ORC-367), such as "Choose Fighter". About opens it with no action.
 */
export function ClassModal({
  option,
  open,
  onOpenChange,
  action,
}: {
  option: BuilderOption;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: ReactNode;
}) {
  const pack = useOptionPack(CLASS_TYPE)(option.key);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={option.name} size="narrow" footer={false} actions={action}>
      <ClassDetail optionKey={option.key} name={option.name} pack={pack} />
    </Dialog>
  );
}
