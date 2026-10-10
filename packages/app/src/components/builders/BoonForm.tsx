// The pact boon form of the homebrew builder, with the fields of the old
// app's boon builder (views.cljs boon-builder): a name and a description.
// The old app's new boon is {} (db.cljs default-boon), and its save
// (events.cljs ::classes/save-boon) adds only :key, so an .orcbrew export
// round-trips.
import { NameDescriptionForm, type BuilderType } from "./fields.tsx";

export const boonBuilder: BuilderType = {
  contentType: "orcpub.dnd.e5/boons",
  validator: "boon",
  one: "pact boon",
  empty: {},
  fields: ["name"],
  Form: NameDescriptionForm,
};
