---
name: "decision-rounds"
description: "Put a round of questions to me on the round page or on thread cards, then read my answers back. Use when a grilling round, an interview, or a wayfinder ticket has questions for me to answer."
disable-model-invocation: false
version: "0.1.0"
---

A **round** is one batch of questions that I can answer now, each with your recommended answer. This skill owns how a round reaches me and how my answers come back. The skill that produced the questions (`grilling`, `wayfinder`, an interview) still owns which questions to ask.

## 1. Pick the form

- **Thread cards**: the round has one to three questions, each with two to four short options and no need for a note. Post one decision card for each question.
- **Round page**: all other rounds. The page is the Artifact *Decision Rounds*: https://claude.ai/artifact/Eq8BZASrg8dKSy3iLPoQ6H
- A question about how a control looks gets a prototype first (`prototype` skill). Put the question on the round after I see the prototype.

The steps below are for the round page.

## 2. Write the round

Write each question so that I can answer it without the other questions and without the thread:

- `title` names the decision in my words. `body` gives the facts that I need, with counts and names.
- `options` are the real choices, two to four, each with a `label` and a `detail` that says what happens. The page adds "Something else" itself.
- `recommended` is the `key` of one option, and `why` is one or two sentences.
- An open question with no fixed choices has an empty `options` list. I answer it in the note.

Put facts that more than one question needs in `background`, as short paragraphs.

Add the round to the page with `ArtifactData`, action `set`, collection `rounds`. The document id is a slug such as `orc-189-round-1`:

```json
{
  "title": "The control for each group of checkboxes",
  "ticket": "ORC-189",
  "date": "2026-11-09",
  "order": 20261109,
  "background": ["One paragraph for each item."],
  "questions": [
    {
      "id": "q1",
      "title": "Small fixed sets",
      "body": "Six items or fewer, and the items do not change.",
      "options": [
        { "key": "a", "label": "Keep checkboxes", "detail": "One row, with the new styling." },
        { "key": "b", "label": "Toggle chips", "detail": "Buttons that stay pressed." }
      ],
      "recommended": "a",
      "why": "The user sees all the options at one time."
    }
  ]
}
```

`order` is the date as a number. The page shows the round with the largest `order` first. The page shows all text as plain text, so write no Markdown and no HTML in a round.

Done when the `set` call returns and a `get` of the document shows every question.

## 3. Ask

Post one message in the thread with the link to the page, the title of the round and the number of questions. Ask me to say "answered" after I send, because the page cannot wake you. Then end the turn.

## 4. Read the answers

When I say that I answered, `get` the document with the same id in collection `answers`:

```json
{
  "submitted": true,
  "submittedAt": "2026-11-18T04:10:00.000Z",
  "answers": {
    "q1": { "choice": "a", "note": "", "byDefault": true },
    "q2": { "choice": "other", "note": "Only for lists of more than 20 items." }
  }
}
```

- `choice` is the `key` of an option, or `other`. With `other`, the note is the answer.
- `byDefault: true` means that I sent the round without an answer to that question, so it took the recommendation. Record it as the recommendation.
- A note beside a choice changes or limits that choice. Read each note.
- `submitted: false` means that I have not sent the round. Tell me, and wait.

If a note is not clear, ask about that one question on a thread card or in one message. State your reading and ask me to confirm it.

Done when each question has an answer that you can state in one sentence.

## 5. Record the decisions

1. Write your reading on the page: `update` the round document with the full `questions` list, each question with an `outcome` sentence added. Pass the `version` from your last read as `if_version`.
2. Record each decision where the calling skill puts it: a comment on the Linear issue, the map, or the spec.
3. Post the decisions in the thread as one numbered list, with the answers that differ from your recommendation first.

Done when the page, the tracker and the thread show the same decisions.

## The page

`round-page.html` in this folder is the source of the page. To change the page, edit the file and publish it to the URL above with the capability `db`. The rounds and answers are in the database and stay through a publish. The page opens in light mode and changes to dark only with its own toggle.
