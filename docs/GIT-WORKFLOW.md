# Git workflow for VGZT

This repository is shared by volunteer organisers, Pages CMS editors, and technical contributors. The goal is to keep the default branch deployable while making it difficult for two editors to overwrite one another.

## One-time local setup

Clone the repository once:

```sh
git clone https://github.com/ShenKeyuBio/vgzt.org.git
cd vgzt.org
corepack enable
pnpm install --frozen-lockfile
```

These repository-local Git settings make future updates predictable without changing a contributor's global Git configuration:

```sh
git config pull.rebase true
git config fetch.prune true
git config rerere.enabled true
git config push.autoSetupRemote true
```

`rerere` remembers a conflict resolution locally; it does not silently resolve a new conflict or change files on GitHub.

## Choose the editing lane

Use Pages CMS for routine content: events, people, opportunities, seasons, social links, the abstract call, and pending-content records. Save one focused editorial change at a time.

Use a feature branch and pull request for code, schemas, styles, tests, workflows, dependencies, documentation about implementation, or `worker/`.

Do not edit the same file in Pages CMS and a code branch at the same time. If a Pages CMS commit lands while a branch is in progress, sync the branch before continuing.

## Start every change from the latest `main`

Never develop directly on `main`:

```sh
git status --short
git fetch origin --prune
git switch main
git pull --ff-only origin main
git switch -c feature/short-description
```

Use a unique, focused branch name such as `content/season-08-programme` or `fix/mobile-nav`. If the work is already on a feature branch, do not create a second branch; run the sync step below.

## Keep a branch current before commit and push

Before committing, and again immediately before pushing:

```sh
git status --short
git fetch origin --prune
git rebase origin/main
```

Only rebase a clean working tree. Review the changed paths before staging and use explicit paths:

```sh
git diff --check
git diff
git add -- path/to/file another/file
git commit -m "Describe one focused change"
git push --set-upstream origin HEAD
```

Do not use `git add .`, `git add -A`, force-push a shared branch, or push a feature branch's history over another contributor's branch.

## If a rebase reports a conflict

Stop and preserve both editors' intent. Do not choose `ours` or `theirs` blindly, especially in YAML content files:

```sh
git status
# edit only the conflicted files after comparing both versions
git add -- path/to/resolved-file
git rebase --continue
```

If the intent is unclear or the conflict is in a shared record, return to the safe state and ask the other editor or a maintainer:

```sh
git rebase --abort
```

After resolving a conflict, rerun the relevant validation before pushing. A conflict is a coordination signal, not a reason to discard someone else's edit.

## Pull requests and deployment

Technical branches go through a pull request targeting `main`. The CI workflow must pass before merge:

- Static site checks and build;
- Isolated Worker checks;
- relevant visual, content, and test checks described in `CONTRIBUTING.md`.

Merge only after review. The merge to `main` triggers GitHub Pages deployment. Delete the feature branch after merge; never rewrite `main` history.

For a normal Pages CMS edit, inspect the resulting commit and Actions run. If the edit fails validation, correct or revert the content; do not weaken the validator.

## After another editor merges

Update an existing branch before starting the next piece of work:

```sh
git fetch origin --prune
git rebase origin/main
```

For a finished branch:

```sh
git switch main
git pull --ff-only origin main
git branch -d feature/short-description
```

The local checkout is disposable; published commits on `main` are the shared source of truth.

## Recommended repository settings

A repository administrator should protect `main` in GitHub settings with:

1. Require a pull request before merging.
2. Require the `Static site checks and build` and `Isolated Worker checks` status checks.
3. Require the branch to be up to date before merging.
4. Disable force pushes and branch deletion.
5. Require at least one review for code changes when the team can support it.

Before enabling a rule that blocks direct pushes, confirm that the Pages CMS workflow is configured to open a pull request or has an intentional, documented exception. The technical workflow itself never needs a direct push to `main`.
