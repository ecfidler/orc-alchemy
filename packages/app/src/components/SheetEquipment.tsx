// The Equipment box of the character sheet: the Gold box, and the gear lines.
import { FramedBox, Label } from "@orc-alchemy/ui";
import { useId } from "react";
import type { Sheet, SheetItem } from "../engine/sheet.ts";

/** Each coin's value in gold pieces: 10 cp = 1 sp, 10 sp = 1 gp, 2 ep = 1 gp, 1 pp = 10 gp. */
const COIN_GP: Record<string, number> = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 };

/** All coins as gold pieces, to two decimals. */
const goldOf = (treasure: SheetItem[]) => Math.round(treasure.reduce((gp, item) => gp + (COIN_GP[item.key] ?? 0) * item.quantity, 0) * 100) / 100;

/** The Equipment box of the sheet: all coins as gold in the Gold box, and the other items as gear lines. */
export function SheetEquipment({ equipment }: { equipment: Sheet["equipment"] }) {
  const gear = [
    ...equipment.weapons,
    ...equipment.armor,
    ...equipment.magicItems,
    ...equipment.other,
    ...equipment.treasure.filter((item) => !Object.hasOwn(COIN_GP, item.key)),
  ];
  return <Equipment gold={goldOf(equipment.treasure)} gear={gear} />;
}

/** Equipment: the Gold box in the top-right corner, and the gear lines wrap beside it, then run the full width under it. */
function Equipment({ gold, gear }: { gold: number; gear: SheetItem[] }) {
  const id = useId();
  return (
    <FramedBox label="Equipment">
      <div className="flow-root text-[14.5px]">
        <div className="float-right mb-1.5 ml-3 grid min-w-16 rounded-md border-[1.5px] border-rule-strong px-2.5 pt-1 pb-[3px] text-center">
          <span role="group" aria-labelledby={id} className="text-[22px] leading-[1.15] tabular-nums">
            {gold.toLocaleString("en-US")}
          </span>
          <Label id={id}>Gold</Label>
        </div>
        {gear.map((item) => (
          <p key={item.key} className="flow-root border-b border-rule py-0.5">
            {item.quantity !== 1 && <span className="tabular-nums">{item.quantity} </span>}
            {item.name}
            {item.equipped && <span className="text-xs text-ink-muted"> (equipped)</span>}
          </p>
        ))}
      </div>
    </FramedBox>
  );
}
