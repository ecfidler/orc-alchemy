---
name: "linear-cleanup"
description: "Archive the closed Linear issues, so that the workspace stays under the issue limit of the free plan. Use when asked to clean up Linear, or when Linear refuses a new issue."
disable-model-invocation: false
version: "0.1.0"
---

A **cleanup** archives closed issues with `scripts/linear-archive.ts`. An archived issue does not count in the limit of 250 issues. It keeps its comments and links, its id still opens, and I can restore it from the archive of the team. Thus a cleanup needs no export and no check of the docs.

The script calls the Linear API, because the Linear app and the Linear MCP tools have no archive command. It needs `LINEAR_API_KEY` in `.env.local` at the root of the checkout, and a network that reaches `api.linear.app`. The cloud environment blocks that host: in a cloud session, run the script in the checkout on my machine, through Remote Control. If the key is missing, ask me to add it to that file. The key stays out of the thread.

## 1. Make the dry run

```
bun scripts/linear-archive.ts --project "<upkeep project>"
```

With no flags, the list has each closed issue of each project that is Completed or Canceled. Add `--project` for each upkeep project, to take its closed issues too. Leave out a feature project that is in progress: its closed issues go when the project is Completed.

The script keeps an issue out of the list when its parent is open, or when one of its sub-issues is not in the list. It prints each such issue with the reason.

The script also prints the closed issues that the rules do not select, by project.

Done when the dry run prints the list and the three counts: not archived now, to archive, and then.

## 2. Get my word on the list

Give me the list as a file in the thread, grouped by project, with the three counts. Ask on one decision card. The last line of the dry run has the ids of the list in an `--only` flag. If I take issues out, take their ids out of that flag.

Done when I approve a list.

## 3. Archive

Run the script with the `--only` flag of the approved list and `--apply`. With `--only`, the script archives those ids and no issue that closed after my approval. It prints the new count and the expected count.

Done when the script ends with no error and the two counts are equal. If the script names issues that stayed, tell me their ids.

## Delete

Delete is only for an issue with no value, for example a test issue. Only I can delete, in the Linear app. A deleted issue is gone after 30 days, and its id opens nothing.
