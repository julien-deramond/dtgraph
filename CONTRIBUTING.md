# Contributing to dtgraph

Thanks for your interest in dtgraph. This document covers how to report bugs, propose
changes, and get code reviewed — for both human and AI-agent contributors.

## Ways to contribute

- **Report a bug** using the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml).
- **Propose a new capability** using the [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml).
- **Propose improving something that exists** using the [enhancement template](.github/ISSUE_TEMPLATE/enhancement_request.yml).
- **Open a pull request** for a change you've already implemented (see below).

## Development workflow

1. Create a branch off `main` (`feature/...`, `fix/...`, `chore/...`).
2. Make your changes, with tests where applicable. Commit messages must follow
   [Conventional Commits](https://www.conventionalcommits.org/) (`feat: ...`,
   `fix: ...`, `docs: ...`, `chore: ...`, etc.) — this is a hard requirement, not a
   suggestion.
3. Open a pull request against `main` using the PR template. Its title must also
   follow Conventional Commits (e.g. `feat: render composite-token edges`). Fill in
   every section of the description — a reviewer should understand *what* changed and
   *why* without reading the whole diff first.
4. Link the PR to the issue it resolves (`Closes #N`).
5. Label the PR to match the "Type of change" you checked in the template
   (`bug`, `feature`, `enhancement`, or `documentation`), plus `ai-submitted` if it
   was opened by an agent. Labels aren't optional decoration — filtering PRs by label
   is how reviewers and future contributors find related work.

## Release process

Publishable packages (`dtgraph`, `@dtgraph/core`, `@dtgraph/mdx`, `@dtgraph/storybook`,
`@dtgraph/viewer`) are versioned and published with [Changesets](https://github.com/changesets/changesets).

1. Any PR that changes a publishable package's behavior must include a changeset:
   run `pnpm changeset`, pick the affected package(s) and bump type (patch/minor/major),
   and describe the change from a consumer's point of view. Commit the generated file
   under `.changeset/`.
2. Merging PRs with changesets into `main` triggers the `Release` workflow
   ([.github/workflows/release.yml](.github/workflows/release.yml)), which opens or
   updates a `chore: version packages` pull request that bumps versions and updates
   changelogs.
3. Merging that pull request triggers the same workflow again; this time, with no
   changesets left pending, it publishes the updated packages to npm and tags the
   release on GitHub.
4. Publishing authenticates to npm via [trusted publishing](https://docs.npmjs.com/trusted-publishers/)
   (OIDC) — there is no long-lived npm token stored in this repository. Each publishable
   package must have a trusted publisher configured on npmjs.com for this repository and
   the `release.yml` workflow before its first release.

## Labels

Labels apply to **both issues and pull requests** — a PR without a type label is
incomplete, the same as one without a description.

| Label | Meaning | Applies to | Who applies it |
| --- | --- | --- | --- |
| `bug` | Something isn't working | issues, PRs | anyone, at creation time |
| `feature` | New capability that does not exist yet | issues, PRs | anyone, at creation time |
| `enhancement` | Improvement to something that already exists | issues, PRs | anyone, at creation time |
| `documentation` | Docs-only or repo-governance change | PRs | anyone, at creation time |
| `upstream-drift` | dtgraph's behavior has drifted from the DTCG spec or a reference tool it tracks (e.g. `@udt/dtcg-parser`, `tokenc`) | issues, PRs | anyone, at creation time |
| `ai-submitted` | Opened by an AI agent rather than a human | issues, PRs | the agent, at creation time |
| `needs-triage` | No maintainer has read this yet — nobody should start work on it | issues only | applied automatically by every issue template |
| `ready-to-dev` | Triaged and specified well enough to be picked up | issues only | a maintainer, after triage |

Label colors follow the same system as
[julien-deramond/bootstrap-tokens](https://github.com/julien-deramond/bootstrap-tokens/labels)
for consistency across repos.

## Issue lifecycle

```
new issue (needs-triage + type label, + ai-submitted if agent-authored)
        │
        ▼
  maintainer triages: clarifies scope, checks it's specced well enough to build
        │
        ▼
  needs-triage removed, ready-to-dev added
        │
        ▼
     picked up for implementation (branch + PR, see above)
```

Nobody — human or agent — should start implementation work on an issue that's still
labeled `needs-triage`. It hasn't been confirmed as in-scope or specified precisely
enough yet.

## Workflow for AI agents

This project is developed with AI-agent assistance, so the rules above are written
down explicitly rather than assumed:

- **Filing issues.** When an agent identifies a bug, a missing feature, or a possible
  enhancement while working in this repo, it should open an issue in
  **this repository** (`julien-deramond/dtgraph`) using the matching template above —
  not stash it in a local scratch/backlog file. The issue description must be
  detailed enough that the work could be implemented from the issue alone: concrete
  expected behavior, edge cases, and any relevant DTCG spec references — not just a
  one-line note.
- **Labeling.** The agent adds the `ai-submitted` label in addition to whatever the
  template already applies (`needs-triage` + `bug`/`feature`/`enhancement`).
- **Picking up work.** When asked to "take an available issue" (or similar), an agent
  must only pick up issues labeled `ready-to-dev`. Issues still labeled `needs-triage`
  are off-limits until a human maintainer re-labels them — that label change is the
  signal that the issue is scoped and approved for work.
- **Implementing.** Follow the same development workflow as anyone else: a branch per
  issue, a PR that follows the PR template, and a description detailed and
  human-readable enough for a maintainer to review without extra context-gathering.
  Label the PR with its type (`bug`/`feature`/`enhancement`/`documentation`) plus
  `ai-submitted` — the same rule as issues, applied at PR creation, not left for a
  maintainer to add later.
- **Closing stale issues.** `Closes #N` in a PR description only catches the issue
  that PR was written for. After merging a PR (or when a release goes out), check
  whether the change also resolves *other* open issues that a `Closes #N` link
  wouldn't have caught — most commonly:
  - a PR that satisfies an issue's intent without literally implementing it (e.g. a
    process doc landing inside another file instead of the standalone file an issue
    asked for);
  - the changesets "chore: version packages" PR and the publish it triggers, both of
    which are bot-authored and never carry a `Closes #N` line, but which are exactly
    the event that resolves a "publish vX.Y.Z" issue.
  Close (or comment on and re-scope) those issues explicitly, with a comment
  pointing at the PR, commit, or release that resolved them — don't leave them open
  just because nothing auto-linked them.
