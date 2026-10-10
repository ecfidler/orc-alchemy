// The language form of the homebrew builder, with the fields of the old
// app's language builder (views.cljs language-builder): a name and a
// description. The old app's new language is {} (db.cljs default-language),
// and its save (events.cljs ::langs/save-language) adds only :key, so an
// .orcbrew export round-trips. The invocation and boon forms have the same
// fields, so they use the same form, NameDescriptionForm in fields.tsx.
import { NameDescriptionForm, type BuilderType } from "./fields.tsx";

export const languageBuilder: BuilderType = {
  contentType: "orcpub.dnd.e5/languages",
  validator: "language",
  one: "language",
  empty: {},
  fields: ["name"],
  Form: NameDescriptionForm,
};
