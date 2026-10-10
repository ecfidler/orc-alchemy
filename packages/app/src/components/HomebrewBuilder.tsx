// The homebrew builder (ORC-74), as the old app's builder pages
// (views.cljs builder-page): one item's form, checked by its type's
// validator at each change, saved into the pack its option source names,
// or, for a type stored outside packs, by the type's own save. Each type
// with a form plugs in a BuilderType (builders/fields.tsx).
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { DEFAULT_PACK, itemAt, tag } from "../engine/content.ts";
import { engine } from "../engine/engine.ts";
import { restorePacks, useHomebrew } from "../state/homebrew.ts";
import { problemText, type BuilderType, type ItemRecord } from "./builders/fields.tsx";
import { magicItemBuilder } from "./builders/MagicItemForm.tsx";
import { monsterBuilder } from "./builders/MonsterForm.tsx";
import { spellBuilder } from "./builders/SpellForm.tsx";

/**
 * The types that have a form, by the name in the routes /content/new/:type
 * and /content/edit/:type/:pack/:key, or /content/edit/:type/:key for a
 * type stored outside packs.
 */
export const BUILDERS: Record<string, BuilderType> = { spell: spellBuilder, monster: monsterBuilder, magicItem: magicItemBuilder };

const OPTION_PACK = tag("option-pack");

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
  if (key === undefined) return <BuilderForm key={type} builder={builder} initial={builder.save ? builder.empty : { ...builder.empty, [OPTION_PACK]: DEFAULT_PACK }} />;
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
        Back to My Content
      </Link>
    </>
  );
}

/** The form of a new item, or, with editing, of the stored item with that key. */
function BuilderForm({ builder, initial, editing }: { builder: BuilderType; initial: ItemRecord; editing?: string }) {
  const { one, validator, fields, Form } = builder;
  const navigate = useNavigate();
  const packNames = useHomebrew((state) => state.packs.map((p) => p.id).join("\n"));
  const [record, setRecord] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A blank option source is the default pack, as the old field's placeholder shows.
  const optionPack = String(record[OPTION_PACK] ?? "").trim() || DEFAULT_PACK;
  // A type stored outside packs has no option source.
  const outside = builder.save !== undefined;
  const { problems, item } = useMemo(() => {
    const { problems, item } = engine().validate[validator](outside ? record : { ...record, [OPTION_PACK]: optionPack });
    return { problems: [...problems, ...(builder.check?.(item, editing) ?? [])], item };
  }, [validator, record, optionPack, outside, builder, editing]);
  const ok = problems.length === 0;
  const others = problems.filter((p) => !fields.includes(String(p.path[0])));

  async function save() {
    setError(null);
    setSaving(true);
    try {
      if (builder.save) await builder.save(item, editing);
      else await useHomebrew.getState().saveItem(optionPack, tag(builder.contentType), item);
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
      <h1 className="text-xl">{`${editing ? "Edit" : "New"} ${one}`}</h1>
      {others.length > 0 && (
        <ul aria-label="Problems" className="text-red-700">
          {others.map((problem, i) => (
            <li key={i}>{problemText(problem.path.join(" "), problem)}</li>
          ))}
        </ul>
      )}
      {!outside && (
        <>
          <label className="block">
            Option source (pack){" "}
            <input
              type="text"
              list="option-sources"
              value={String(record[OPTION_PACK] ?? "")}
              placeholder={DEFAULT_PACK}
              onChange={(e) => setRecord({ ...record, [OPTION_PACK]: e.target.value })}
              className="border border-black px-1"
            />
          </label>
          <p>The pack to save the {one} in. A new pack is created if necessary.</p>
          <datalist id="option-sources">
            {packNames.split("\n").map((name) => name && <option key={name} value={name} />)}
          </datalist>
        </>
      )}
      <Form record={record} onChange={setRecord} problems={problems} />
      {error && <p role="alert">{error}</p>}
      <div className="flex gap-4">
        <button type="submit" disabled={!ok || saving} className="border border-black px-3 py-1 disabled:opacity-50">
          Save
        </button>
        <Link to="/content" className="underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
