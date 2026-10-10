// The eldritch invocation form of the homebrew builder, with the fields of
// the old app's invocation builder (views.cljs invocation-builder): a name
// and a description. The old app's new invocation is {} (db.cljs
// default-invocation), and its save (events.cljs ::classes/save-invocation)
// adds only :key, so an .orcbrew export round-trips.
import { NameDescriptionForm, type BuilderType } from "./fields.tsx";

export const invocationBuilder: BuilderType = {
  contentType: "orcpub.dnd.e5/invocations",
  validator: "invocation",
  one: "eldritch invocation",
  empty: {},
  fields: ["name"],
  Form: NameDescriptionForm,
};
