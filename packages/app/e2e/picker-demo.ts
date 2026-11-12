// The page script of e2e/picker.spec.ts: the picker controls of @orc-alchemy/ui alone, with fruit lists.
// The spec bundles this file with Bun; Playwright does not load it.
import { Chips, Fieldset, ListModal, NumberToggle, Picker, Token, Tokens, type ListItem } from "@orc-alchemy/ui";
import { createElement as h, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

const FRUIT = ["Apple", "Banana", "Cherry", "Damson", "Elderberry", "Fig", "Grape", "Kiwi", "Lemon", "Lime", "Mango", "Melon", "Orange", "Peach", "Pear", "Plum", "Quince", "Raspberry", "Strawberry", "Tangerine", "Watermelon"];
const GROUPS: Record<string, string[]> = { Orchard: ["Apple", "Cherry", "Damson", "Peach", "Pear", "Plum", "Quince"], Citrus: ["Lemon", "Lime", "Orange", "Tangerine"] };
const groupOf = (name: string) => Object.keys(GROUPS).find((g) => GROUPS[g]!.includes(name)) ?? "Other fruit";
const OPTIONS: ListItem<string>[] = ["Orchard", "Citrus", "Other fruit"].flatMap((group) =>
  FRUIT.filter((f) => groupOf(f) === group).map((f) => ({ value: f.toLowerCase(), label: f, group })),
);
const BASKETS: ListItem<string>[] = [
  { value: "any-melon", label: "Any melon", example: "The picker chooses 1 to 3 melons" },
  { value: "berries", label: "Berries", example: "Raspberries, strawberries, elderberries …" },
  { value: "any-citrus", label: "Any citrus fruit", example: "The picker chooses 1 to 3 citrus fruits" },
  { value: "stone", label: "Stone fruit", example: "Cherries, damsons, peaches, plums" },
];

const section = (legend: string, ...children: ReactNode[]) => h(Fieldset, { legend, look: "section" }, ...children);

function PickerCase() {
  const [value, setValue] = useState(["fig", "apple", "lime", "pear"]);
  return section(
    "Fruit in the bowl",
    h(Picker<string>, { label: "Add a fruit", title: "Add fruit", options: OPTIONS, value, onValueChange: setValue, search: true, pickedText: (n) => `${n} on the form` }),
  );
}

function ListCase() {
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState<string[]>([]);
  return section(
    "Baskets",
    h("output", { "data-testid": "baskets" }, picks.join(",")),
    h("button", { className: "ui-button", "data-variant": "ghost", "data-size": "normal", onClick: () => setOpen(true) }, "Add a basket"),
    h(ListModal<string>, { open, onOpenChange: setOpen, title: "Add a basket", items: BASKETS.filter((b) => !picks.includes(b.value)), onPick: (v) => setPicks([...picks, v]) }),
  );
}

function TokensCase() {
  const [n, setN] = useState<number | null>(2);
  const [names, setNames] = useState([
    "Apple",
    "A basket of ripe pears from the far orchard, picked at dawn and packed in straw so that not one of them bruises on the road",
    "Kiwi",
    "Watermelon",
    "Fig",
  ]);
  return section(
    "Picks",
    h(
      Tokens,
      null,
      h(Token, { label: "Any melon", onRemove: () => {} }, h(NumberToggle, { "aria-label": "Any melon: how many", size: "small", values: [1, 2, 3], value: n, onValueChange: setN })),
      ...names.map((name) => h(Token, { key: name, label: name, onRemove: () => setNames(names.filter((x) => x !== name)) })),
    ),
  );
}

function ToggleCase() {
  const [value, setValue] = useState<number | null>(1);
  return section(
    "Extra baskets",
    h(
      "div",
      { style: { display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" } },
      h(NumberToggle, { "aria-label": "Extra baskets", values: [null, 1, 2, 3], value, onValueChange: setValue }),
      h("span", null, "baskets of the picker's choice"),
    ),
  );
}

function ChipsCase() {
  const [values, setValues] = useState([4, 8, 12, 16, 19]);
  return section(
    "Rows",
    h("output", { "data-testid": "rows", hidden: true }, values.join(",")),
    h(Chips, { values, options: Array.from({ length: 20 }, (_, i) => i + 1), onValuesChange: setValues, addLabel: "Add a row", name: (n) => `Row ${n}` }),
  );
}

const CASES: Record<string, () => ReactNode> = { picker: PickerCase, list: ListCase, tokens: TokensCase, toggle: ToggleCase, chips: ChipsCase };

declare global {
  interface Window {
    mount: (name: string) => void;
  }
}

window.mount = (name) => {
  createRoot(document.getElementById("root")!).render(h("main", { style: { maxWidth: "720px", padding: "24px 16px" } }, h(CASES[name]!)));
};
