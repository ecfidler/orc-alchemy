// The Equipment step (ORC-59): the inventory lists, as the old builder's
// inventory selectors, the one "Add items" list modal for all of them
// (ORC-373), and the worn armor, shield and weapons in hand, as the old
// sheet's Equipped Items. Each list is a table (ORC-374). Each change is an
// engine mutation.
import { AddButton, Button, Checkbox, type ListItem, ListModal, Select, TextInput, XButton } from "@orc-alchemy/ui";
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import type { BuilderSelection } from "../engine/builder.ts";
import {
  addCustomItem,
  attunedItems,
  CUSTOM_VALUES,
  changeCustomItem,
  customItems,
  type Hand,
  hand,
  itemWeights,
  removeCustomItem,
  setAttuned,
  setCarried,
  setQuantity,
  storedItems,
  wield,
} from "../engine/equipment.ts";
import { useOpenCharacter } from "../state/character.ts";
import { BoundedNumberField } from "./AbilityScores.tsx";
import { HEADING_CLASSES, Heading } from "./selection-heading.tsx";
import { useMutation, usePendingMutation } from "./use-mutation.ts";

const MAGIC_LISTS = ["magic-weapons", "magic-armor", "other-magic-items"];
/** As the SRD: a character can attune to no more than 3 magic items at once. */
const MAX_ATTUNED = 3;

/** An item to add: its inventory list, such as "armor", and its key. */
type ItemPick = { list: string; key: string };
const pickId = ({ list, key }: ItemPick) => `${list}/${key}`;

/**
 * The "Add items" button of the step, and its list modal (ORC-373): a group for each inventory list, in the order of
 * `lists`, with the items that are not in the list yet, A to Z. A pick goes to its own list. The modal stays open, and
 * the picked item leaves it. A row is busy while its pick is on its way.
 */
export function AddItems({ lists }: { lists: BuilderSelection[] }) {
  const { entity } = useOpenCharacter();
  const { pending, later } = usePendingMutation();
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const items: ListItem<ItemPick>[] = lists.flatMap((selection) => {
    const stored = new Set(storedItems(entity!, selection.key).map((item) => item.key));
    return selection.options
      .filter((o) => !stored.has(o.key))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((o) => {
        const value = { list: selection.key, key: o.key };
        return { value, label: o.name, group: selection.name, ...(pending.has(pickId(value)) && { busy: true }) };
      });
  });
  function pick(value: ItemPick) {
    if (pending.has(pickId(value))) return;
    setAdded((n) => n + 1);
    later(pickId(value), (e, entity) => e.addInventoryItem(entity, value.list, value.key));
  }
  return (
    <>
      <AddButton
        ref={button}
        label="Add items"
        // A pick that is on its way is busy until it shows in its list. When the modal closes first, the button shows it.
        aria-busy={pending.size > 0 || undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setAdded(0);
          setOpen(true);
        }}
      />
      <ListModal
        open={open}
        onOpenChange={setOpen}
        title="Add items"
        items={items}
        onPick={pick}
        stayOpen
        picked={added}
        pickedText={(n) => `${n} added`}
        search
        finalFocus={button}
      />
    </>
  );
}

const POUNDS = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
/** A weight in pounds, as the inventory tables show it: "65 lb.", "0.05 lb."; a dash for no weight. */
const lb = (pounds: number | null) => (pounds === null ? "—" : `${POUNDS.format(pounds)} lb.`);

let loadedWeights: Map<string, number> | null = null;
const NO_WEIGHTS = new Map<string, number>();

/** The weight of one of each SRD item, by key (itemWeights). Until it loads, or when it cannot load, no item has a weight. */
function useItemWeights(): Map<string, number> {
  const [weights, setWeights] = useState(loadedWeights);
  useEffect(() => {
    if (weights !== null) return;
    let live = true;
    itemWeights()
      .then((map) => {
        loadedWeights = map;
        if (live) setWeights(map);
      })
      // Offline, the weights show as dashes.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [weights]);
  return weights ?? NO_WEIGHTS;
}

/** The attuned box of a row of a magic list. */
type Attuned = { checked: boolean; disabled: boolean; onChange: (on: boolean) => void };

/** One row of an inventory table, for an item or a custom item: Carried, Name, Attuned (magic lists), Weight, Quantity, Remove. */
function ItemRow(props: {
  name: string;
  /** The Name cell: the name, or the name field of a custom item. */
  nameCell: ReactNode;
  carried: boolean;
  onCarried: (carried: boolean) => void;
  /** Undefined in a list that is not magic, and null for a row in a magic list that cannot be attuned. */
  attuned?: Attuned | null;
  weight: number | null;
  quantity: number;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const { name, attuned } = props;
  return (
    <tr className="border-t border-rule">
      <td className="py-1 pr-2 text-center">
        <Checkbox aria-label={`Carried: ${name}`} checked={props.carried} onCheckedChange={props.onCarried} />
      </td>
      <td className="w-full py-1 pr-2">{props.nameCell}</td>
      {attuned !== undefined && (
        <td className="py-1 pr-2 text-center">
          {attuned && <Checkbox aria-label={`Attuned: ${name}`} checked={attuned.checked} disabled={attuned.disabled} onCheckedChange={attuned.onChange} />}
        </td>
      )}
      <td className="py-1 pr-2 text-right whitespace-nowrap tabular-nums">{lb(props.weight)}</td>
      <td className="py-1 pr-2">
        <BoundedNumberField label={`Quantity: ${name}`} min={1} value={props.quantity} onCommit={props.onQuantity} />
      </td>
      <td className="py-1">
        <XButton aria-label={`Remove ${name}`} size="small" onClick={props.onRemove} />
      </td>
    </tr>
  );
}

/** The header row of an inventory table. */
function HeaderRow({ magic }: { magic: boolean }) {
  const th = "pb-1 pr-2 font-bold";
  return (
    <tr className="font-sans text-[12.5px]">
      <th scope="col" className={th}>
        Carried
      </th>
      <th scope="col" className={th}>
        Name
      </th>
      {magic && (
        <th scope="col" className={th}>
          Attuned
        </th>
      )}
      <th scope="col" className={`${th} text-right`}>
        Weight
      </th>
      <th scope="col" className={th}>
        Quantity
      </th>
      <th scope="col" className="pb-1">
        <span className="sr-only">Remove</span>
      </th>
    </tr>
  );
}

/**
 * An inventory list, such as Armor, as a table (ORC-374): a row per item, then a row per custom item, and the total
 * weight under it. The total adds weight × quantity of each item with a known weight. An empty list shows one line.
 */
export function Inventory({ selection }: { selection: BuilderSelection }) {
  const id = useId();
  const { entity } = useOpenCharacter();
  const run = useMutation();
  const weights = useItemWeights();
  const list = selection.key;
  const customKey = CUSTOM_VALUES[list];
  const items = useMemo(() => storedItems(entity!, list), [entity, list]);
  const custom = useMemo(() => (customKey ? customItems(entity!, customKey) : []), [entity, customKey]);
  const attuned = useMemo(() => attunedItems(entity!), [entity]);
  const nameOf = (key: string) => selection.options.find((o) => o.key === key)?.name ?? key;
  const magic = MAGIC_LISTS.includes(list);
  const known = items.filter((item) => weights.has(item.key));
  const total = known.length > 0 ? known.reduce((sum, item) => sum + weights.get(item.key)! * item.quantity, 0) : null;
  const attunedBox = (key: string): Attuned => {
    const on = attuned.includes(key);
    return { checked: on, disabled: !on && attuned.length >= MAX_ATTUNED, onChange: (next) => run((e, entity) => setAttuned(e, entity, key, next)) };
  };

  return (
    <section aria-labelledby={id} className="space-y-2">
      {/* An inventory list has no picks to make, so it has no mark. */}
      <Heading id={id} selection={selection} mark={false} />
      {items.length + custom.length === 0 ? (
        <p className="font-sans text-[13.5px] text-ink-muted">No {selection.name.toLowerCase()} yet.</p>
      ) : (
        <>
          {/* At a narrow width the table scrolls in its own box, not the page. */}
          <div className="overflow-x-auto">
            <table aria-labelledby={id} className="w-full border-collapse text-left text-[15px]">
              <thead>
                <HeaderRow magic={magic} />
              </thead>
              <tbody>
                {items.map((item) => {
                  const name = nameOf(item.key);
                  return (
                    <ItemRow
                      key={item.key}
                      name={name}
                      nameCell={name}
                      carried={item.equipped}
                      onCarried={(carried) => run((e, entity, opts) => setCarried(e, entity, list, item.key, carried, opts))}
                      attuned={magic ? attunedBox(item.key) : undefined}
                      weight={weights.get(item.key) ?? null}
                      quantity={item.quantity}
                      onQuantity={(n) => run((e, entity, opts) => setQuantity(e, entity, list, item.key, n, opts))}
                      // An item removed is no longer attuned.
                      onRemove={() => run((e, entity) => setAttuned(e, e.removeInventoryItem(entity, list, item.key), item.key, false))}
                    />
                  );
                })}
                {custom.map((item, i) => (
                  <ItemRow
                    key={`custom-${i}`}
                    name={item.name}
                    nameCell={
                      item.starting ? (
                        item.name
                      ) : (
                        <TextInput
                          aria-label={`Custom item ${i + 1} name`}
                          width="full"
                          value={item.name}
                          onValueChange={(name) => run((e, entity) => changeCustomItem(e, entity, customKey, i, { name }))}
                        />
                      )
                    }
                    carried={item.equipped}
                    onCarried={(equipped) => run((e, entity) => changeCustomItem(e, entity, customKey, i, { equipped }))}
                    attuned={magic ? null : undefined}
                    weight={null}
                    quantity={item.quantity}
                    onQuantity={(n) => run((e, entity) => changeCustomItem(e, entity, customKey, i, { quantity: n }))}
                    onRemove={() => run((e, entity) => removeCustomItem(e, entity, customKey, item.name))}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <p className="font-sans text-[13.5px]">
            Total weight: <span className="tabular-nums">{lb(total)}</span>
          </p>
        </>
      )}
      {customKey && (
        <Button icon="plus" onClick={() => run((e, entity) => addCustomItem(e, entity, customKey))} size="small">
          Add custom item
        </Button>
      )}
    </section>
  );
}

/**
 * The worn armor, wielded shield and weapons in hand, as the old sheet: each
 * lists the carried items that fit. The off hand shows only when it is set,
 * or the main hand holds a weapon that can be dual-wielded.
 */
export function Hands({ lists }: { lists: BuilderSelection[] }) {
  const id = useId();
  const { entity, sheet } = useOpenCharacter();
  const run = useMutation();
  if (!sheet) return null;
  const { armorClassOptions, equipment, weaponAttacks } = sheet;
  const all = [...equipment.weapons, ...equipment.armor, ...equipment.magicItems];
  const carried = new Set(all.filter((item) => item.equipped).map((item) => item.key));
  const nameOf = (key: string) => lists.flatMap((l) => l.options).find((o) => o.key === key)?.name ?? all.find((item) => item.key === key)?.name ?? key;
  const keysOf = (keys: (string | undefined)[]) => [...new Set(keys)].filter((key) => key !== undefined && carried.has(key)) as string[];
  const armor = keysOf(armorClassOptions.map((o) => o.armor?.key));
  const shields = keysOf(armorClassOptions.map((o) => o.shield?.key));
  const weapons = keysOf(weaponAttacks.map((w) => w.key));
  const dualWield = keysOf(weaponAttacks.filter((w) => w.offHandDamageModifier !== null).map((w) => w.key));
  // With no armor or shield stored, the best combination, as the sheet's AC.
  const [worn, wielded] = [hand(entity!, "worn-armor"), hand(entity!, "wielded-shield")];
  const best =
    worn === null && wielded === null
      ? armorClassOptions.reduce<(typeof armorClassOptions)[number] | undefined>((a, o) => (a && a.ac >= o.ac ? a : o), undefined)
      : undefined;
  const main = hand(entity!, "main-hand-weapon") ?? "none";
  const off = hand(entity!, "off-hand-weapon") ?? "none";
  const showOff = off !== "none" || dualWield.includes(main);

  const dropdown = (label: string, key: Hand, value: string, keys: string[]) => (
    <label className="flex flex-col">
      <span>{label}</span>
      <Select
        aria-label={label}
        // A stored item that is no longer carried shows as none, as the old dropdowns did.
        value={keys.includes(value) ? value : "none"}
        options={[["none", "<none>"], ...keys.map((k): [string, string] => [k, nameOf(k)])]}
        onValueChange={(next) => run((e, entity) => wield(e, entity, key, next))}
      />
    </label>
  );
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h3 id={id} className={HEADING_CLASSES}>
        Equipped Items
      </h3>
      <div className="flex flex-wrap gap-4">
        {dropdown("Worn armor", "worn-armor", worn ?? best?.armor?.key ?? "none", armor)}
        {dropdown("Wielded shield", "wielded-shield", wielded ?? best?.shield?.key ?? "none", shields)}
        {dropdown("Main hand", "main-hand-weapon", main, weapons)}
        {showOff && dropdown("Off hand", "off-hand-weapon", off, dualWield)}
      </div>
    </section>
  );
}
