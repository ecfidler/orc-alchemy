# Review of the `linear-issue-workflow` skill: M2 sessions, 2026-10-02

This report looks at how `.claude/skills/linear-issue-workflow/SKILL.md`
(v1.0.0) behaved when it ran the M2 issues on 2026-10-02 (evening, US
Eastern). It lists what worked, what did not work as intended, what needs
clarification, what does not help, and what wasted effort. The last section
gives proposed changes to the skill.

## Scope and method

Three sessions used the skill. A fourth transcript (`39240702`) is an early
copy of session A, so it is not counted separately.

| Session | Issues | Notes |
| --- | --- | --- |
| A `1e9446a3` | ORC-45, then ORC-103 | Per-issue branch and PR to `main`, as the skill says. The user asked for ORC-103 to be fixed and merged directly. |
| B `27d6e2f1` | ORC-46, ORC-48 | The user said: one shared branch `m2-local-first-viewer`, no more branches or PRs. |
| C `42c4041d` | ORC-47, 49, 50, 51, then 108 and 104 in parallel | Per-issue branches cut from `m2-local-first-viewer`, PRs into it, then one M2 PR to `main`. The user ran `/compact` after ORC-50. |

I read the condensed transcripts (user and assistant text, tool calls, and
truncated results), the subagent metadata, the git log and the Linear state
of the issues. The model's thinking was not recorded in the transcripts, so
the reasons for some choices are only known when the agent said them aloud.

### Per-issue summary

| Issue | Who implemented | Review rounds | Round-2 result | Stops for the user | Active time |
| --- | --- | --- | --- | --- | --- |
| ORC-45 | Orchestrator | 1 | — | 0 | ~5 min |
| ORC-46 | Orchestrator | 2 (same reviewers resumed) | Nothing real | 0 (one decision raised in the report) | ~4 min |
| ORC-48 | Explore agent, then 2 parallel workers | 2 (resumed) | 3 real findings, fixed without a third round | 0 | ~16 min |
| ORC-47 | Orchestrator | 2 | 1 nit | 1 scope stop (R8). Waited 39 min for the answer | ~11 min |
| ORC-49 | Orchestrator | 2 | 2 small real bugs | 1 round-limit stop. User: "accept it and finish" | ~14 min |
| ORC-50 | Orchestrator | 2 | Nothing blocking | 0 | ~8 min |
| ORC-51 | Orchestrator | 2 (round 2: one combined agent) | 1 test that could never fail | 1 round-limit stop. User: "accept it and finish" | ~10 min |
| ORC-108 | 1 worker in a worktree | 2 (round 2: one combined agent) | Nothing | 0 | ~8 min |
| ORC-104 | 1 worker in a worktree | 2 (round 2: one combined agent) | Nothing | 1 design question (answered in 4 min) | ~11 min |

Subagent runs in total: 31 review runs, 4 worker runs and 1 Explore run.
Every subagent ran Opus.

## What worked

- **The two-axis review is the most valuable part of the skill.** It found
  real defects in almost every issue, and the two axes often found different
  ones:
  - ORC-47: one bad character failed a whole `dmv-export` bundle.
  - ORC-48: the AC rule, feature and attack text did not match the old app;
    attack text could print `undefined`.
  - ORC-49: one failed IndexedDB request moved the whole session to an empty
    in-memory store; a failed autosave was silent; the sheet page had a
    stale-result race; the `beforeunload` guard could be dropped.
  - ORC-50: export could download stale data while an autosave was running.
  - ORC-51: row buttons had no accessible names; an e2e assertion could hang.
  - ORC-108: a regression where a failed autosave read was no longer
    reported.
  - When both reviewers flagged the same problem (ORC-49), the orchestrator
    treated it as the top fix. That is good triage.
- **The scope stop works.** In ORC-47 the done-when needed engine features
  that 0.1.0 does not have. The agent wrote a Linear comment with options
  A/B/C, asked the user, amended the done-when after the answer, and updated
  the comment to "Resolved". ORC-104 did the same for a design choice.
- **Briefs to subagents were good.** Worker briefs named the goal, the files
  each worker owns, what not to touch, and the shape of the report. Workers
  returned changed files, test results and open questions, as the skill asks.
- **The parallel-worker pattern in ORC-48 is worth copying.** The
  orchestrator first wrote the shared `Sheet` type as a fixed contract, then
  ran an adapter worker and a UI worker on disjoint files. The workers met at
  the contract without conflicts.
- **Parallel issues in worktrees worked** (ORC-104 and ORC-108). The
  orchestrator also did a trial merge of both branches and ran the tests on
  the result before asking to merge. The skill does not ask for this check,
  but it should.
- **Follow-ups were found and filed.** ORC-103, 104, 105, 106, 107, 108 and
  109 came from these sessions. The agent also chose, on its own, to comment
  on an existing issue (ORC-50, ORC-51, ORC-62) when the follow-up already
  had a home. That avoided duplicate tickets.

Not tested: no issue was picked up mid-way, so these sessions say nothing
about the skill's "already In Progress or In Review" resume path.

## What did not work as intended

1. **Delegation mostly did not happen.** The skill says to skip workers only
   when "all changes are in a single small file or single function". The
   orchestrator implemented 7 of the 9 issues itself. ORC-49 changed 13
   files. Only ORC-48 used workers by the orchestrator's own choice. ORC-104
   and ORC-108 used workers because the user asked.
   - The direct work was fast (4–16 min per issue), and review caught the
     same kinds of bugs either way. So quality did not obviously suffer.
   - The cost was context. Session C reached `/compact` after four issues,
     because the orchestrator held every file read, edit, test log and
     review report.
   - The rule is either wrong or not followed. See "Proposed changes".
2. **The "write the plan" step was skipped.** No issue had a written plan in
   Linear or in chat, except the short worker split in ORC-48. Because of
   this, there is no record of why the orchestrator chose to delegate or
   not. The only stated reason was in ORC-47: "The remaining work is small
   enough to do directly."
3. **The model and effort rule cannot be followed.** The skill says
   subagents run "Opus on medium effort", with high effort for reviewers.
   The Agent tool takes a `model` but no effort setting, so every subagent
   ran with only `model: "opus"`. Effort comes from an agent definition
   (`.claude/agents/*.md` frontmatter), and this repo has none.
4. **The two-round stop fires on small findings.** Round 2 found small real
   problems in ORC-48, ORC-49 and ORC-51. The agents handled this three
   different ways:
   - ORC-48: fixed them, reported, and asked whether a third round was
     wanted. It did not write a stop comment.
   - ORC-49 and ORC-51: fixed them, wrote a stop comment, and waited. Both
     times the user replied "accept it and finish" within a few minutes.
   - The stop added a round trip without adding information. In all three
     cases the fix was small and tested.
5. **The review step drifted after the first issue in each session.** The
   skill says to run `/mattpocock-skills:code-review`. The agent invoked it
   only for the first issue of each session (ORC-45, 46, 47). After that it
   wrote the reviewer prompts itself, copying the skill's text. Round 2 was
   done three different ways:
   - Session B resumed the same two reviewers with `SendMessage` ("report
     only new or unresolved findings, under 250 words"). These rounds took
     11–31 s.
   - ORC-47, 49 and 50 started two fresh reviewers with a "don't re-raise"
     list.
   - ORC-51, 108 and 104 used one combined Standards + Spec reviewer.
6. **The skill's branch model did not match how M2 was run.** The skill
   assumes one branch per issue from `main` and a PR to `main`. In practice:
   - Session B used one shared branch with no PRs, because the user said so.
   - Session C cut each issue branch from the milestone branch, merged PRs
     into it, and merged the milestone branch to `main` at the end.
   - The skill has no milestone-branch mode, so each session had to work
     this out. The compact summary had to record it as a "convention in
     practice".
7. **Linear status and the milestone branch disagreed.** Linear's GitHub
   integration marked an issue Done when its PR merged into
   `m2-local-first-viewer`, even without a "Closes" line. This happened to
   ORC-47, 49 and 50 (and later 51, 104 and 108). ORC-48 stayed In Review
   because it had no PR. The agent explained the mismatch and offered to fix
   it in four separate reports. Then it moved ORC-48 to Done by hand at the
   final merge. The skill does not say what "Done" means when there is a
   milestone branch.

## What needs clarification

- **"Small enough to implement yourself."** Give a measurable threshold,
  such as files touched, lines changed, or "you already have the full
  context". Or state that the orchestrator should implement directly by
  default and delegate only for parallel work or large reading.
- **"Real" findings and the round limit.** Say whether a small, tested fix
  in round 2 needs a stop. Suggested rule: stop only if round 2 finds a
  correctness or spec bug whose fix is not trivial. Otherwise fix it, run
  the suite, and note "round-2 fixes not re-reviewed" in the PR.
- **How to stop.** The skill says "report back to me and end". The agent
  used `AskUserQuestion` instead, which kept the session open (ORC-47 waited
  39 minutes for an answer). Both are reasonable. Pick one.
- **Base branch and PR target.** Say "the base branch the user names, or
  `main`". Also say what happens to Linear status when a PR merges into a
  non-`main` branch.
- **Follow-up tickets.** Give the fields to set. The follow-ups from these
  sessions are not consistent:
  - ORC-104 and ORC-105 got `needs-triage`; ORC-106, 107, 108 and 109 did
    not.
  - ORC-105 and ORC-109 have no milestone.
  - The skill should also allow "comment on an existing issue" when one
    already covers the follow-up.
- **Lint.** Step 3 says "test, lint, and typecheck". The repo has no lint
  script, so every brief had to say "There is no lint". Point at the
  package's scripts instead of naming tools.
- **"Mark the PR as ready for merge" and "send the PR to me".** The user
  then typed "merge into the m2 branch" seven times. If merging into a
  milestone branch is routine, the skill can take a merge policy as an
  argument.

## What is not helping

- **The fallback branch in Review step 3** ("if that skill is not available,
  spawn 2 review agents…") was never used. In practice the orchestrator
  followed the code-review skill's text from memory after the first issue.
  The fallback is not needed, but the skill does need one stable reviewer
  brief.
- **The model and effort line** has no effect, as described above.
- **"Subagents should run their own tests … and verification with
  playwright"** made reviewers repeat the full suite that the orchestrator
  had just run. Many reviewers re-ran typecheck, vitest and sometimes e2e.
  The ORC-104 spec reviewer ran for 9.8 minutes and was still running after
  its report had been used and the PR merged. This rule makes sense for
  workers, not for reviewers.
- **The three copies of each summary.** Each issue got the same summary in a
  Linear comment, in the PR body and in the chat report, plus a "merged"
  comment in Linear. The Linear comment could link the PR and list only the
  decisions and follow-ups.

## Wasted effort

| Item | Where | Cost |
| --- | --- | --- |
| `gh pr edit` fails (GitHub Projects classic deprecation); the agent falls back to `gh api -X PATCH …/pulls/N -F body=@file` | ORC-45, ORC-47 | One failed call and a workaround per session |
| Reviewers re-running suites the orchestrator already ran | Most reviews | 1–10 min of agent time each |
| A reviewer still running after its report was used | ORC-104 spec review | ~6 min |
| Explaining the Linear Done/In Review mismatch | Session C, four reports | Report length and user attention |
| Long reviewer prompts rebuilt by hand for every round (standards sources, smell list, triage notes) | 31 review runs | Prompt tokens, and drift between rounds |
| Round-limit stops for small, already-fixed findings | ORC-49, ORC-51 | Two user round trips |
| `echo waiting` no-op tool call while waiting for a reviewer | ORC-104 | Trivial |
| Orchestrator context full of implementation detail | Session C | Needed `/compact` after four issues |

## On the human-notes questions

The notes ask why the agent did or did not spawn subagents, and suggest a
session review of the agent's step-by-step workflow. The transcripts cannot
fully answer the first question, because the agent stated a reason only in
ORC-47 and ORC-48. A cheap fix is to make the reason part of the plan: a
short Linear comment at the start of each issue that gives the approach, the
delegation choice and why. That comment also becomes the raw material for
the session review the notes describe.

## Proposed changes to the skill

In priority order.

1. **Define reviewer and worker agents.** Add `.claude/agents/reviewer.md`
   and `.claude/agents/worker.md` with model and effort in the frontmatter.
   Put the static reviewer brief there: the standards sources, the smell
   list, the report format, and "read-only, do not run e2e unless asked".
   This fixes the effort rule, removes the hand-built prompts, and stops the
   drift between rounds.
2. **Fix how round 2 works.** Round 2 resumes the same two reviewers with
   `SendMessage`. The message gives the fix commit and the triage decisions,
   and asks for new or unresolved findings only. Session B shows this is
   fast and cheap.
3. **Relax the stop rule.** After round 2, stop only for a correctness or
   spec finding whose fix is not trivial. Otherwise fix it, run the suite,
   and say in the PR that the round-2 fixes were not re-reviewed.
4. **Require a short plan comment.** At the start of each issue, post a
   Linear comment with the approach, the files, and the delegation choice
   with its reason.
5. **Settle the delegation rule.** Choose one:
   - (a) The orchestrator implements by default. It delegates when it can
     split the work into disjoint parallel parts, or when the work needs
     reading that the orchestrator does not need to keep.
   - (b) Keep "delegate by default" and enforce it.

   The evidence favours (a), with one condition: run one issue per
   orchestrator context, or compact between issues.
6. **Add a milestone-branch mode.** Take an optional base branch, for
   example `/linear-issue-workflow ORC-49 base=m2-local-first-viewer`.
   Branch from it, open the PR into it, and say what Linear status to expect
   when the PR merges into it.
7. **Add a parallel-issues mode.** Run each issue's worker in its own
   worktree. Before asking to merge, trial-merge the branches and run the
   suite on the result. This is what ORC-104 and ORC-108 did.
8. **Add the environment gotchas.** Update PR bodies with `gh api -X PATCH
   repos/<owner>/<repo>/pulls/N -F body=@file`, not `gh pr edit`. Take the
   check commands from the package's scripts: `bun run typecheck`,
   `bun run test` (never `bun test`), `bun run e2e`. There is no lint.
9. **Give reviewers the test results.** Put the orchestrator's test results
   in the review brief. Reviewers then run only targeted checks.
10. **Set rules for follow-ups.** Use the `needs-triage` label, the project,
    the milestone if known, and `relatedTo` the source issue. Comment on an
    existing issue instead when one already covers the follow-up.
11. **Shorten the Linear completion comment.** Link the PR, and list only
    the decisions and follow-ups.
