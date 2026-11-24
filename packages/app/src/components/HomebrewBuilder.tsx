// The homebrew builder (ORC-74), as the old app's builder pages
// (views.cljs builder-page): one item's form, checked by its type's
// validator at each change, saved into the pack its option source names,
// or, for a type stored outside packs, by the type's own save. Each type
// with a form plugs in a BuilderType (builders/fields.tsx).
import { Autocomplete, Button, FieldLabel, PixelIcon } from "@orc-alchemy/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { DEFAULT_PACK, itemAt, OPTION_PACK, tag } from "../engine/content.ts";
import { restorePacks, useHomebrew } from "../state/homebrew.ts";
import { backgroundBuilder } from "./builders/BackgroundForm.tsx";
import { boonBuilder } from "./builders/BoonForm.tsx";
import { classBuilder } from "./builders/ClassForm.tsx";
import { FormProblems, useCheckedRecord } from "./builders/checked-form.tsx";
import { featBuilder } from "./builders/FeatForm.tsx";
import type { BuilderType, ItemRecord } from "./builders/fields.tsx";
import { invocationBuilder } from "./builders/InvocationForm.tsx";
import { languageBuilder } from "./builders/LanguageForm.tsx";
import { magicItemBuilder } from "./builders/MagicItemForm.tsx";
import { monsterBuilder } from "./builders/MonsterForm.tsx";
import { raceBuilder } from "./builders/RaceForm.tsx";
import { selectionBuilder } from "./builders/SelectionForm.tsx";
import { spellBuilder } from "./builders/SpellForm.tsx";
import { subclassBuilder } from "./builders/SubclassForm.tsx";
import { subraceBuilder } from "./builders/SubraceForm.tsx";
import { useLeaveGuard } from "./leave-guard.tsx";

/**
 * The types that have a form, by the name in the routes /content/new/:type
 * and /content/edit/:type/:pack/:key, or /content/edit/:type/:key for a
 * type stored outside packs.
 */
export const BUILDERS: Record<string, BuilderType> = {
  spell: spellBuilder,
  monster: monsterBuilder,
  race: raceBuilder,
  subrace: subraceBuilder,
  class: classBuilder,
  subclass: subclassBuilder,
  magicItem: magicItemBuilder,
  background: backgroundBuilder,
  feat: featBuilder,
  language: languageBuilder,
  invocation: invocationBuilder,
  boon: boonBuilder,
  selection: selectionBuilder,
};

/** The page: a new item of the route's type, or the stored item at its pack and key. */
export function HomebrewBuilder() {
  const { type = "", pack, key } = useParams();
  const builder = BUILDERS[type];
  const packs = useHomebrew((state) => state.packs);
  const [restore, setRestore] = useState<{ done: boolean; error: string | null }>({ done: false, error: null });

  useEffect(() => {
    restorePacks().then(
      () => setRestore({ done: true, error: null }),
      (e) => setRestore({ done: true, error: `The stored homebrew could not be read from this browser: ${e instanceof Error ? e.message : String(e)}` }),
    );
  }, []);

  if (builder === undefined) return <NotFound text="There is no form for this content type" />;
  if (restore.error !== null) return <p role="alert">{restore.error}</p>;
  if (!restore.done) return <p role="status">Reading the stored homebrew…</p>;
  if (key === undefined)
    return <BuilderForm key={type} builder={builder} initial={builder.save ? builder.empty : { ...builder.empty, [OPTION_PACK]: DEFAULT_PACK }} />;
  if (builder.save) {
    const item = builder.load(key);
    if (item === undefined) return <NotFound text={`There is no ${builder.one} ${key}`} />;
    return <BuilderForm key={`${type}/${key}`} builder={builder} initial={item} editing={key} />;
  }
  if (pack === undefined) return <NotFound text={`There is no ${builder.one} ${key}`} />;
  const stored = packs.find((p) => p.id === pack);
  const item = stored && itemAt(stored.plugin, tag(builder.contentType), tag(key));
  if (item === undefined) return <NotFound text={`There is no ${builder.one} ${key} in the pack ${pack}`} />;
  // The item saves back into its pack, unless the option source changes.
  return <BuilderForm key={`${type}/${pack}/${key}`} builder={builder} initial={{ ...item, [OPTION_PACK]: pack }} editing={key} />;
}

function NotFound({ text }: { text: string }) {
  return (
    <>
      <h1 className="text-xl">{text}</h1>
      <Link to="/content" className="underline">
        <PixelIcon name="left" />
        Back to My Content
      </Link>
    </>
  );
}

/** The form of a new item, or, with editing, of the stored item with that key. */
function BuilderForm({ builder, initial, editing }: { builder: BuilderType; initial: ItemRecord; editing?: string }) {
  const { one, fields, Form } = builder;
  const navigate = useNavigate();
  const packIds = useHomebrew((state) => state.packs.map((p) => p.id).join("\n"));
  const packNames = useMemo(() => packIds.split("\n").filter(Boolean), [packIds]);
  const [record, setRecord] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A blank option source is the default pack, as the old field's placeholder shows.
  const optionPack = String(record[OPTION_PACK] ?? "").trim() || DEFAULT_PACK;
  // A type stored outside packs has no option source.
  const outside = builder.save !== undefined;
  const check = useCallback((item: ItemRecord) => builder.check?.(item, editing) ?? [], [builder, editing]);
  // Leaving a changed form asks first (ORC-211). The form has no draft, so the changes would be lost.
  const { problems, item, ok, changed } = useCheckedRecord(builder, record, initial, { optionPack: outside ? undefined : optionPack, check });
  const guard = useLeaveGuard(changed, `This ${one} has changes that are not saved. Leave anyway?`);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      if (builder.save) await builder.save(item, editing);
      else await useHomebrew.getState().saveItem(optionPack, tag(builder.contentType), item);
      guard.pass();
      navigate("/content");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <form
      aria-label={`${editing ? "Edit" : "New"} ${one}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) save();
      }}
      className="space-y-3"
    >
      {guard.dialog}
      <h1 className="text-xl">{`${editing ? "Edit" : "New"} ${one}`}</h1>
      <FormProblems problems={problems} fields={fields} />
      {!outside && (
        <>
          <FieldLabel label="Option source (pack)">
            <Autocomplete
              value={String(record[OPTION_PACK] ?? "")}
              onValueChange={(pack) => setRecord({ ...record, [OPTION_PACK]: pack })}
              suggestions={packNames}
              placeholder={DEFAULT_PACK}
            />
          </FieldLabel>
          <p>The pack to save the {one} in. A new pack is created if necessary.</p>
        </>
      )}
      <Form record={record} onChange={setRecord} problems={problems} />
      {error && <p role="alert">{error}</p>}
      <div className="flex gap-4">
        <Button type="submit" icon="check" disabled={!ok || saving}>
          Save
        </Button>
        <Link to="/content" className="underline">
          <PixelIcon name="x" />
          Cancel
        </Link>
      </div>
    </form>
  );
}
