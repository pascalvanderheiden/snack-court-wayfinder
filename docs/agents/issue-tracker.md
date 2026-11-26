# Issue tracker: GitHub

Issues and specs live in `pascalvanderheiden/snack-court-wayfinder` on GitHub. Use the `gh` CLI for tracker operations.

## Conventions

- Confirm the target with `gh repo view --json nameWithOwner` before the first issue creation in a session. File in this repo; confirm any different target with the user.
- Create: `gh issue create --title "..." --body "..."`. Use a heredoc for multiline bodies. Follow a matching repository issue template.
- Read: `gh issue view <number> --json number,title,body,labels,comments`.
- List: `gh issue list --state open --json number,title,body,labels,comments`; apply appropriate label and state filters.
- Comment: `gh issue comment <number> --body "..."`.
- Apply/remove labels: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`.
- Close: post the explanation with `gh issue comment`, then `gh issue close`. Comment separately on already-closed issues.

## Sub-issues and blocking

Use native GitHub sub-issues and issue dependencies. With `gh` 2.94+, use `gh issue create --parent <parent>` or `gh issue edit <parent> --add-sub-issue <child>`; add blockers with `gh issue edit <child> --add-blocked-by <blocker>`.

On older clients, use `gh api --method POST repos/{owner}/{repo}/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>` and `gh api --method POST repos/{owner}/{repo}/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`. Obtain database IDs with `gh api repos/{owner}/{repo}/issues/<number> --jq .id`.

When native relationships are unavailable, add `Part of #<parent>` to the child and a task-list entry to the parent; represent blockers with `Blocked by: #<number>` in the child body. A ticket is unblocked when every blocker is closed.

Count open native blockers with `gh api repos/{owner}/{repo}/issues/<number> --jq .issue_dependencies_summary.blocked_by`.

## Pull requests as a triage surface

**PRs as a request surface: no.** Set to `yes` to include external PRs in triage, using `gh pr` equivalents for reading, commenting, labelling, and closing. GitHub issues and PRs share a number space; resolve ambiguous numbers with `gh pr view`, then `gh issue view`.

## Skill handoffs

When a skill says "publish to the issue tracker", create a GitHub issue. When it says "fetch the relevant ticket", read the issue with its labels and comments.

## Wayfinding operations

- Map: one issue labelled `wayfinder:map`, with Notes / Decisions-so-far / Fog.
- Child: a sub-issue of the map, labelled `wayfinder:<type>` (`research`, `prototype`, `grilling`, or `task`); use the relationship fallback above when needed.
- Frontier: map's open children, excluding assigned tickets and tickets with open blockers; first in map order wins.
- Claim: `gh issue edit <number> --add-assignee @me`, the session's first write.
- Resolve: comment with the answer, close the child, then append a gist and link to the map's Decisions-so-far.
