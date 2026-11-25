// The Conditions and statuses box of the vitals panel (ORC-322,
// docs/design/sheet-interactivity.md "Conditions and statuses"). The rules are in
// engine/conditions.ts; the sheet page applies an action as one sheet change.
// The Exhaustion token (ORC-323) comes after the condition tokens.
import { FramedBox, Menu, SlotCircles, Token, Tokens } from "@orc-alchemy/ui";
import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import { CONDITION_TEXTS } from "../engine/condition-texts.ts";
import {
  type ConditionAction,
  concentrationLabel,
  conditionMenu,
  conditionName,
  EXHAUSTION,
  EXHAUSTION_NAME,
  exhaustionEffects,
  exhaustionValueText,
  statusTokens,
} from "../engine/conditions.ts";
import { type Condition, EXHAUSTION_LIMIT } from "../engine/play.ts";
import type { Sheet } from "../engine/sheet.ts";
import { useMarkName } from "../state/spell-records.ts";

export interface ConditionsBoxProps {
  sheet: Pick<Sheet, "concentration" | "conditions" | "conditionImmune" | "currentHitPoints" | "deathSaves" | "exhaustion">;
  /** Applies an action of the box. Without it, as on a read-only sheet, the tokens have no X and there is no Add condition menu. */
  onAction?: (action: ConditionAction) => void;
  /** On a narrow sheet, the panel that gives a rule popup its width. */
  popupWidthOf?: RefObject<HTMLElement | null> | null;
}

/**
 * The box "Conditions and statuses": the token of the concentration mark,
 * the condition tokens in the order of the menu, the Unconscious token that
 * the app adds at 0 hit points, the Exhaustion token, then "+ Add
 * condition". A click on the name of a condition opens its rule text. On a
 * read-only sheet the box shows only when it has a token.
 */
export function ConditionsBox({ sheet, onAction, popupWidthOf }: ConditionsBoxProps) {
  const [rule, setRule] = useState<Condition | typeof EXHAUSTION | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const tokens = statusTokens(sheet);
  const menu = conditionMenu(sheet.conditions, sheet.conditionImmune, sheet.exhaustion);
  // When the circles take the level to 0, the token goes with the focus on it: the focus goes to "+ Add condition".
  const level = useRef(sheet.exhaustion);
  useLayoutEffect(() => {
    const from = level.current;
    level.current = sheet.exhaustion;
    if (from === 0 || sheet.exhaustion > 0) return;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    box.current?.querySelector<HTMLElement>(".ui-chip-add")?.focus();
  }, [sheet.exhaustion]);
  if (!onAction && tokens.length === 0) return null;
  return (
    // The wrapper marks the box, so that a layout test can measure the panel without the tokens.
    <div ref={box} data-conditions-box className="grid">
      <FramedBox label="Conditions and statuses">
        <Tokens className="min-h-7">
          {tokens.map((token) =>
            token.kind === "concentration" ? (
              <ConcentrationToken key="concentration" spell={token.spell} onAction={onAction} />
            ) : token.kind === "exhaustion" ? (
              <ExhaustionToken
                key="exhaustion"
                level={token.level}
                open={rule === EXHAUSTION}
                onOpenChange={(open) => setRule(open ? EXHAUSTION : null)}
                popupWidthOf={popupWidthOf}
                onAction={onAction}
              />
            ) : (
              <Token
                key={`${token.condition}${token.auto ? "-auto" : ""}`}
                label={conditionName(token.condition)}
                size="small"
                groupName={token.auto ? `${conditionName(token.condition)}, 0 hit points` : conditionName(token.condition)}
                look={token.auto ? "dashed" : "plain"}
                note={token.auto ? "0 hit points" : undefined}
                popup={{
                  open: rule === token.condition,
                  onOpenChange: (open) => setRule(open ? token.condition : null),
                  title: conditionName(token.condition),
                  widthOf: popupWidthOf,
                  children: (
                    <ul className="grid list-disc gap-1 pl-5 font-sans text-[13.5px] leading-snug">
                      {CONDITION_TEXTS[token.condition].map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  ),
                }}
                onRemove={!token.auto && onAction ? () => onAction({ kind: "remove", condition: token.condition }) : undefined}
              />
            ),
          )}
          {onAction && menu.length > 0 && (
            <Menu
              label="Add condition"
              className="ui-chip-add"
              items={menu.map((entry) => [entry.condition, entry.name, entry.note || undefined] as const)}
              onPick={(condition) => onAction(condition === EXHAUSTION ? { kind: "exhaustion", level: 1 } : { kind: "add", condition })}
            />
          )}
        </Tokens>
      </FramedBox>
    </div>
  );
}

interface ExhaustionTokenProps {
  level: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  popupWidthOf?: RefObject<HTMLElement | null> | null;
  onAction?: (action: ConditionAction) => void;
}

/**
 * The Exhaustion token: its name, six circles and an X. The circles show the
 * level, with the rule "one more, one less"; a screen reader reads
 * "Exhaustion, level 2 of 6". The X sets the level to 0. A mouse over the
 * token, or a click on its name, opens the effects of the six levels, with
 * the levels that apply in bold. It has no "Level n" label.
 */
function ExhaustionToken({ level, open, onOpenChange, popupWidthOf, onAction }: ExhaustionTokenProps) {
  return (
    <Token
      label={EXHAUSTION_NAME}
      groupName={EXHAUSTION_NAME}
      size="small"
      popupOnHover
      popup={{
        open,
        onOpenChange,
        title: EXHAUSTION_NAME,
        widthOf: popupWidthOf,
        children: (
          <ol className="grid gap-0.5 font-sans text-[13px] leading-snug" aria-label="Effects of each level">
            {exhaustionEffects(level).map((effect) => (
              <li
                key={effect.level}
                data-applies={effect.applies ? "" : undefined}
                className={`grid grid-cols-[18px_1fr] ${effect.applies ? "font-semibold text-ink" : "text-ink-muted"}`}
              >
                <span>{effect.level}</span>
                <span>
                  {effect.text}
                  {effect.applies && <span className="sr-only"> (applies)</span>}
                </span>
              </li>
            ))}
          </ol>
        ),
      }}
      onRemove={onAction ? () => onAction({ kind: "exhaustion", level: 0 }) : undefined}
    >
      <SlotCircles
        label={EXHAUSTION_NAME}
        count={EXHAUSTION_LIMIT}
        marked={level}
        valueText={exhaustionValueText}
        onChange={onAction ? (next) => onAction({ kind: "exhaustion", level: next }) : undefined}
      />
    </Token>
  );
}

/** The token of the concentration mark, in the bubble color: "Concentrating on Bless", with the X "Stop concentrating on Bless". */
function ConcentrationToken({ spell, onAction }: { spell: string; onAction?: (action: ConditionAction) => void }) {
  const name = useMarkName(spell);
  const label = concentrationLabel(name);
  return (
    <Token
      label={label}
      groupName={label}
      size="small"
      look="bubble"
      removeName={`Stop concentrating on ${name}`}
      onRemove={onAction ? () => onAction({ kind: "end-concentration", name }) : undefined}
    />
  );
}
