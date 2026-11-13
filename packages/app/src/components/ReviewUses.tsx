// The Review uses page (ORC-207, docs/design/homebrew-forms.md, "Suggested
// uses", "Review uses page"): the features of one stored pack that have no
// uses and whose text gives suggested uses or a hint, each in a row with
// the uses control of the forms. Save writes the checked rows to the stored
// pack, as the forms write them, and skips the unchecked rows that have a
// suggestion. Nothing is stored before Save. The rows have no preview, so a
// pack with hundreds of rows stays quick.
import { Button, Checkbox } from "@orc-alchemy/ui";
import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { itemAt } from "../engine/content.ts";
import { restorePacks, useHomebrew, type ItemChange } from "../state/homebrew.ts";
import { setSkipped, skippedOf, useSkippedUses } from "../state/skipped-uses.ts";
import { SelectField } from "./builders/fields.tsx";
import { startChoice, usesRows, withChoices, type RowChoice, type UsesRow } from "./builders/review-uses.ts";
import type { Span, TextMatch } from "./builders/suggested-uses.ts";
import { UsesControl } from "./builders/UsesControl.tsx";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The route's page: the rows of the pack :pack, once the stored packs are read. */
export function ReviewUses() {
  const { pack = "" } = useParams();
  const record = useHomebrew((state) => state.packs.find((p) => p.id === pack));
  const [restore, setRestore] = useState<{ done: boolean; error: string | null }>({ done: false, error: null });

  useEffect(() => {
    restorePacks().then(
      () => setRestore({ done: true, error: null }),
      (e) => setRestore({ done: true, error: `The stored homebrew could not be read from this browser: ${message(e)}` }),
    );
  }, []);

  if (restore.error !== null) return <p role="alert">{restore.error}</p>;
  if (!restore.done) return <p role="status">Reading the stored homebrew…</p>;
  if (record === undefined) return <Message title={`There is no pack ${pack}`} />;
  return <Review pack={pack} plugin={record.plugin} />;
}

function BackLink() {
  return (
    <Link to="/content" className="underline">
      Back to My Content
    </Link>
  );
}

function Message({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <>
      <h1 className="text-xl">{title}</h1>
      {children}
      <BackLink />
    </>
  );
}

/** What the user set in a row: checked or not, and the choice of uses and type. */
interface Draft {
  checked: boolean;
  choice: RowChoice;
}

/** A row starts checked when it has a suggestion and is not skipped. */
const startDraft = (row: UsesRow, skipped: boolean): Draft => ({ checked: row.uses.kind === "suggestion" && !skipped, choice: startChoice(row) });

function Review({ pack, plugin }: { pack: string; plugin: object }) {
  const rows = usesRows(plugin);
  const skipped = useSkippedUses((state) => skippedOf(state, pack));
  const [showSkipped, setShowSkipped] = useState(false);
  // A new round of rows after each Save, so the rows that stay start again from the stored pack.
  const [round, setRound] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const skippedCount = rows.filter((row) => skipped.includes(row.id)).length;
  const shown = showSkipped ? rows : rows.filter((row) => !skipped.includes(row.id));

  return (
    <>
      <h1 className="text-xl">Review uses: {pack}</h1>
      <p className="mt-2 max-w-[720px]">
        These features have no uses, and their text may name some. Check the rows to save, and change the uses where the suggestion is not right. Save
        writes the checked rows to the pack. An unchecked row with a suggestion is then skipped in this browser.
      </p>
      {status && (
        <p role="status" className="mt-2">
          {status}
        </p>
      )}
      {shown.length === 0 && skippedCount === 0 ? (
        <p className="mt-4">No features in this pack may have uses.</p>
      ) : (
        <Rows
          key={`${round}/${showSkipped}`}
          pack={pack}
          plugin={plugin}
          rows={shown}
          skipped={skipped}
          showSkipped={showSkipped}
          onShowSkipped={setShowSkipped}
          skippedCount={skippedCount}
          onSaved={(text) => {
            setStatus(text);
            setRound((n) => n + 1);
          }}
        />
      )}
      <p className="mt-4">
        <BackLink />
      </p>
    </>
  );
}

/** The toolbar, the rows by item, and Save. */
function Rows({
  pack,
  plugin,
  rows,
  skipped,
  showSkipped,
  onShowSkipped,
  skippedCount,
  onSaved,
}: {
  pack: string;
  plugin: object;
  rows: UsesRow[];
  skipped: string[];
  showSkipped: boolean;
  onShowSkipped: (show: boolean) => void;
  skippedCount: number;
  onSaved: (status: string) => void;
}) {
  const starts = useMemo(() => new Map(rows.map((row) => [row.id, startDraft(row, skipped.includes(row.id))])), [rows, skipped]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draftOf = (row: UsesRow) => drafts[row.id] ?? starts.get(row.id)!;
  const checkedRows = rows.filter((row) => draftOf(row).checked);
  const allChecked = rows.length > 0 && checkedRows.length === rows.length;

  const change = useCallback(
    (id: string, next: (draft: Draft) => Draft) => setDrafts((all) => ({ ...all, [id]: next(all[id] ?? starts.get(id)!) })),
    [starts],
  );
  const checkAll = (checked: boolean) => setDrafts((all) => Object.fromEntries(rows.map((row) => [row.id, { ...(all[row.id] ?? starts.get(row.id)!), checked }])));

  async function save() {
    setError(null);
    setSaving(true);
    try {
      // The items as stored now, each with the choices of its checked rows.
      const stored = useHomebrew.getState().packs.find((p) => p.id === pack)?.plugin ?? plugin;
      const byItem = new Map<string, { row: UsesRow; choice: RowChoice }[]>();
      for (const row of checkedRows) {
        const id = JSON.stringify([row.contentType, row.key]);
        byItem.set(id, [...(byItem.get(id) ?? []), { row, choice: draftOf(row).choice }]);
      }
      const changes: ItemChange[] = [...byItem.values()].map((choices) => {
        const { contentType, key } = choices[0].row;
        const item = itemAt(stored, contentType, key);
        if (item === undefined) throw new Error(`${choices[0].row.itemName} is no longer in the pack`);
        return { contentType, key, item: withChoices(item, choices) };
      });
      if (changes.length > 0) await useHomebrew.getState().saveItems(pack, changes);
      const skip = rows.filter((row) => row.uses.kind === "suggestion" && !draftOf(row).checked).map((row) => row.id);
      setSkipped(
        pack,
        skip,
        checkedRows.map((row) => row.id),
      );
      onSaved(`Saved ${checkedRows.length} ${checkedRows.length === 1 ? "feature" : "features"}. Skipped ${skip.length}.`);
    } catch (e) {
      setError(message(e));
      setSaving(false);
    }
  }

  // The rows of one item go together, under its name.
  const items: UsesRow[][] = [];
  for (const row of rows) {
    const last = items.at(-1);
    if (last && last[0].contentType === row.contentType && last[0].key === row.key) last.push(row);
    else items.push([row]);
  }

  return (
    <>
      <div className="sticky top-0 z-10 mt-4 flex max-w-[720px] flex-wrap items-center gap-x-6 gap-y-2 border-b border-rule-strong bg-paper py-2">
        <Checkbox label="All rows" checked={allChecked} onCheckedChange={checkAll} disabled={rows.length === 0} />
        <Checkbox label={`Show skipped (${skippedCount})`} name="Show skipped" checked={showSkipped} onCheckedChange={onShowSkipped} />
        <span className="text-sm text-ink-muted" aria-live="polite">
          {checkedRows.length} of {rows.length} checked
        </span>
        <Button variant="solid" className="ml-auto" onClick={() => void save()} disabled={saving}>
          Save
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
      {rows.length === 0 && <p className="mt-4">Every row is skipped. Turn on Show skipped to see them.</p>}
      <div className="mt-4 max-w-[720px] space-y-6">
        {items.map((itemRows) => {
          const { one, itemName, contentType, key } = itemRows[0];
          return (
            <section key={`${contentType}/${key}`} aria-label={`${itemName} (${one})`} className="space-y-[10px]">
              <h2 className="text-lg font-bold">
                {itemName} <span className="font-sans text-sm font-normal text-ink-muted">{one}</span>
              </h2>
              {itemRows.map((row) => (
                <Row key={row.id} row={row} draft={draftOf(row)} skipped={skipped.includes(row.id)} onChange={change} />
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}

/** One feature: its checkbox, the text that it matched with the phrases marked, the type and the uses control. */
const Row = memo(function Row({ row, draft, skipped, onChange }: { row: UsesRow; draft: Draft; skipped: boolean; onChange: (id: string, next: (draft: Draft) => Draft) => void }) {
  const { id, name, uses, type } = row;
  const feature = { ...row.feature, "~:frequency": draft.choice.frequency };
  const setChoice = (choice: Partial<RowChoice>, fill = false) =>
    onChange(id, (d) => ({ checked: d.checked || (fill && choice.frequency !== undefined), choice: { ...d.choice, ...choice } }));
  return (
    <div className="grid gap-2 border border-rule-strong bg-paper-raised px-3 py-[10px]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Checkbox label={<span className="font-bold">{row.featureName}</span>} name={name} checked={draft.checked} onCheckedChange={(checked) => onChange(id, (d) => ({ ...d, checked }))} />
        {skipped && <span className="font-sans text-xs uppercase tracking-wide text-ink-muted">Skipped</span>}
        {uses.kind === "hint" && <span className="font-sans text-sm text-ink-muted">No suggestion</span>}
      </div>
      <Quotes text={String(row.feature["~:description"])} matches={type ? [uses.match, type.suggestion.match] : [uses.match]} />
      {uses.kind === "hint" && <p className="text-[14.5px] text-ink-muted">The text may name uses, but gives no clear amount. Set the uses by hand.</p>}
      {type && (
        <div className="flex">
          <SelectField label="Type" name={`${name} type`} value={draft.choice.type ?? ""} options={row.types} onSelect={(value) => setChoice({ type: value })} />
        </div>
      )}
      <UsesControl name={name} feature={feature} onChange={(frequency) => setChoice({ frequency }, true)} levelName={row.levelName} preview={false} />
    </div>
  );
});

/** The sentences of the matches, each once, with the phrases in it marked. */
function Quotes({ text, matches }: { text: string; matches: TextMatch[] }) {
  const sentences: { sentence: Span; phrases: Span[] }[] = [];
  for (const { sentence, phrase } of [...matches].sort((a, b) => a.sentence.start - b.sentence.start)) {
    const same = sentences.find((s) => s.sentence.start === sentence.start && s.sentence.end === sentence.end);
    if (same) same.phrases.push(phrase);
    else sentences.push({ sentence, phrases: [phrase] });
  }
  return (
    <>
      {sentences.map(({ sentence, phrases }) => {
        const parts: ReactNode[] = [];
        let at = sentence.start;
        for (const phrase of [...phrases].sort((a, b) => a.start - b.start)) {
          if (phrase.start < at) continue; // a phrase inside one already marked
          parts.push(text.slice(at, phrase.start));
          parts.push(
            <mark key={phrase.start} className="bg-note px-[2px] text-note-ink">
              {text.slice(phrase.start, phrase.end)}
            </mark>,
          );
          at = phrase.end;
        }
        parts.push(text.slice(at, sentence.end));
        return (
          <blockquote key={sentence.start} className="border-l-4 border-rule-strong pl-2 text-[14.5px]">
            {"“"}
            {parts}
            {"”"}
          </blockquote>
        );
      })}
    </>
  );
}
