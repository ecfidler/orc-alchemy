---
type: Convention
title: Writing standard
description: "The project writing standard: ASD-STE100 Simplified Technical English at about 80 percent, with the rules we keep and the rules we relax."
tags: [docs, writing, ste, conventions]
status: stable
generated: { by: claude-code/agent, at: 2026-10-05T22:20:14Z }
sources:
  - id: ste100
    resource: https://www.asd-ste100.org/
    title: ASD-STE100 Simplified Technical English, Issue 9
  - id: technical-writing-skill
    resource: https://github.com/ecfidler/orcpub/blob/pubdoor/.claude/skills/technical-writing/SKILL.md
    title: technical-writing skill
    author: human:ecfidler
---

# Summary

Write project documents in ASD-STE100 Simplified Technical English
(STE).[^ste100] Apply it at about 80 percent, not strictly. STE makes text
easy to read for people, for translators, and for agents. The full
standard also limits each word to an approved dictionary. That limit makes
software text stiff, so this project does not apply it.

The `technical-writing` skill is the tool for this standard.[^technical-writing-skill]
It adds Diátaxis document modes, Google developer style, and Global English
rules. When this document and the skill disagree, this document wins.

# Scope

- Apply this standard to new documents in a bundle, to PR descriptions, to
  commit messages, and to Linear issues.
- Apply it to an existing document when you change the meaning of a
  section. Rewrite only that section. Do not rewrite text that you did not
  change.
- Do not apply it to the upstream OrcPub documents in the fork. Do not edit
  those documents.
- Do not apply it to quoted text, code, logs, or game text from the SRD.

# Rules we keep

Always apply these rules.

1. **Write one instruction in each sentence.** Two actions in one sentence
   are permitted only when the reader does them at the same time.
2. **Write instructions as commands.** Write "Run the check", not "The
   check should be run".
3. **Put the condition before the command.** Write "If the check fails,
   read the log", not "Read the log if the check fails".
4. **Keep sentences short.** An instruction has 20 words or fewer. A
   description has 25 words or fewer. A code name or a file path counts as
   one word.
5. **Write one topic in each paragraph.** Start with the topic sentence. Use
   six sentences or fewer.
6. **Keep the articles.** Write "Remove the backup file", not "Remove backup
   file".
7. **Use one word for one meaning.** If "pack" means a homebrew pack, do not
   also call it a "bundle" or a "source".
8. **Use the real name.** Write the real symbol, file, command, or Linear
   issue. Do not write a description of it.
9. **Keep noun clusters to three words or fewer.** Write "the script that
   checks the docs", not "the docs bundle conformance check script".
10. **Use simple tenses.** Use the present tense for facts. Use the past
    tense for history. Use the future tense only for a thing that occurs
    later.
11. **Use vertical lists.** Use a numbered list for steps and a bulleted list
    for other items.
12. **Put a warning before the step that it guards.** Start the warning with
    the command, for example "Do not commit the private export."

# Rules we relax

Follow these rules when you can. If a rule makes a sentence less clear,
break the rule.

| STE rule | What this project permits |
|---|---|
| Use only words from the STE dictionary. | Use any common English word. Use technical names, project terms, and D&D terms without limit. |
| Use a word only in its approved part of speech. | A word can have its normal part of speech, for example "build" as a noun. Keep one meaning for it in one document. |
| Do not use "-ing" forms. | Use "-ing" in technical names and in fixed terms, for example "golden testing". Avoid other "-ing" forms. |
| Use the active voice in descriptions. | Use the passive voice when the actor is not known or is not important. Procedures stay active. |
| Keep each sentence to the length limit. | An Explanation or Report can have a sentence of up to 30 words if it has only one thought. |
| Give no opinion. | Plans, reports, and decision records can give a view and a reason. |

# How to measure 80 percent

The target is that at least four sentences in five obey all the STE rules,
the relaxed rules included. Read the document and count.

1. If a sentence breaks a rule that we keep, fix it.
2. If more than one sentence in five breaks a relaxed rule, rewrite the
   longest of those sentences first.
3. If a fix makes a sentence less clear, keep the original sentence.

The STE dictionary is not part of the count.

The CI check does not measure STE. The reviewer measures it.

# Example

Before:

> In order to ensure that the bundle remains conformant, it is important
> that index files are kept up to date whenever documents are being added
> or moved, since otherwise the check will fail.

After:

> When you add or move a document, update the `index.md` file in its
> directory. If you do not, the check fails.

[^ste100]: ASD-STE100 Simplified Technical English, Issue 9
[^technical-writing-skill]: technical-writing skill
