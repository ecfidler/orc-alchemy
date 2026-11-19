---
name: "decision-rounds"
description: "Put a round of questions to me on the round page or on thread cards, then read my answers back. Use when a grilling round, an interview, or a wayfinder ticket has questions for me to answer."
disable-model-invocation: false
version: "0.3.0"
---

A **round** is one batch of questions that I can answer now, each with your recommended answer. This skill owns how a round reaches me and how my answers come back. The skill that produced the questions (`grilling`, `wayfinder`, an interview) still owns which questions to ask.

## 1. Pick the form

- **Thread cards**: the round has one to three questions, each with two to four short options and no need for a note. Post one decision card for each question. Each answer comes back to you as its own message. Then go to step 5.
- **Round page**: all other rounds. The page is the Artifact *Decision Rounds*: https://claude.ai/artifact/Eq8BZASrg8dKSy3iLPoQ6H
- A question about how a control looks gets a prototype first (`prototype` skill). After I see the prototype, put the question on the round.

Done when each question has a form. Steps 2 to 4 are for the round page.

## 2. Write the round

Write each question so that I can answer it without the other questions and without the thread:

- `title` names the decision in my words. `body` gives the facts that I need, with counts and names.
- `options` are the real choices, two to four, each with a `label` and a `detail` that says what happens. The page adds "Something else" itself.
- `recommended` is the `key` of one option, and `why` is one or two sentences.
- An open question with no fixed choices has an empty `options` list and no `recommended`. I answer it in the note, and the page does not let me send the round without that note.

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

`order` is the date as a number, and the page shows the round with the largest `order` first. For a second round on one day, add a digit: `202611092`. An optional `example` sentence shows as a notice at the top of a round that is not a real one. The page shows all text as plain text, so write plain sentences.

Done when the `set` call returns and a `get` of the document shows every question.

## 3. Ask

1. Watch the page: `ArtifactComments`, action `watch`, with the URL of the page. The watch is how my Send reaches you.
2. Post one message in the thread. I read messages fast, so the message must show at one look that a round is open. The message has two lines and a link card:
   - The first line is bold and says that a round is ready, with the number of questions: `**Decision round ready: 5 questions**`. For a round of one question, write "1 question".
   - The second line is the link to the round, with the title of the round as the link text. The link is the URL of the page plus `#` and the document id, for example `https://claude.ai/artifact/Eq8BZASrg8dKSy3iLPoQ6H#orc-189-round-1`. The page opens that round.
   - The link card is the same link, attached to the message as a link with a title. Do not attach the page as an Artifact (kind `frame`): that attachment shows the name of the page and not the name of the round. In a project thread, the link card is an entry in `attached_outputs` of kind `link`, with `ref` and `title`. The title is "Decision round: ", the title of the round, and the number of questions: `Decision round: The control for each group of checkboxes (5 questions)`.
   - If your reply tool cannot attach a link, post the two lines with no link card.
3. End the turn.

When I send the round, the page posts a comment that starts with "Round `<document id>` is answered" and sends it to Claude. Each thread that watches the page gets a wake for it.

- The comment names your round: go to step 4.
- The comment names a different round: it is for a different thread. End the turn with no reply and no change to the comment.
- I say "answered" in the thread: the page could not send the comment. Go to step 4.

Done when the watch is on and the message is posted with the first line, the link, and the link card if your reply tool can attach one.

## 4. Read the answers

`get` the document with the same id in collection `answers`. The comment also holds a summary of the answers, but the document is the record:

```json
{
  "submitted": true,
  "submittedAt": "2026-11-18T04:10:00.000Z",
  "notifiedAt": "2026-11-18T04:10:01.000Z",
  "answers": {
    "q1": { "choice": "a", "note": "", "byDefault": true },
    "q2": { "choice": "other", "note": "Only for lists of more than 20 items." }
  }
}
```

- `choice` is the `key` of an option, or `other`. With `other` or with no `choice`, the note is the answer.
- `byDefault: true` means that I sent the round without an answer to that question, so it took the recommendation. Record it as the recommendation.
- A note beside a choice changes or limits that choice. Read each note.
- `submitted: false` means that I have not sent the round. Tell me, and wait.

If a note is not clear, ask about that one question on a thread card or in one message. State your reading and ask me to confirm it.

Done when each question has an answer that you can state in one sentence.

## 5. Record the decisions

1. For a round on the page, write your reading on the page. `update` the round document with the full `questions` list, and add an `outcome` sentence to each question. Pass the `version` from your last read as `if_version`.
2. Record each decision where the calling skill puts it: a comment on the Linear issue, the map, or the spec.
3. Post the decisions in the thread as one numbered list, with the answers that differ from your recommendation first.
4. For a round on the page, close the loop on the page. Reply to the comment with one sentence that says the answers are recorded, and resolve it (`ArtifactComments`, actions `reply` and `resolve`). Then stop the watch (`watch` with `on: false`) if you have no other round open.

Done when the tracker and the thread show the same decisions, and the page does too for a round on the page.

## The page

`round-page.html` in this folder is the source of the page. To change the page, edit the file and publish it to the URL above with the capabilities `db` and `comments`. The rounds and answers are in the database and stay through a publish. The page opens in light mode and changes to dark only with its own toggle.

Without a round id in the link, the page opens the newest round that I have not sent. Rounds that I sent are in a closed "Earlier rounds" list.
