---
inclusion: manual
---
# Spec drift check

Compare the files changed since the last commit with the design.md and tasks.md of the spec they belong to, and report every mismatch. Read-only.

Run a spec drift check. This is a read-only task: do not edit, create, move or delete any file, and do not run git commands that change state (no add, commit, stash, checkout, reset). Report only.

1. Collect the changed files from the workspace root: `git diff HEAD --name-status` plus untracked files under src/ and tests/ (`git ls-files --others --exclude-standard src tests`). Include deleted and renamed files. If there are none, say so and stop.

2. Map each changed file to a spec in `.kiro/specs/` (list the folders first). Use the spec's design.md file lists, module names, task references and the structure steering (`.kiro/steering/structure.md`) to decide. A file that belongs to no spec goes in an 'Unmapped files' list. A file that maps to several specs is checked against each.

3. For each spec with changed files, read its design.md and tasks.md (and requirements.md only to resolve ambiguity). Read the changed files and compare:
   - File names and paths: files the design lists that are missing, renamed or moved; new files the design does not mention.
   - Function and type signatures: names, parameters, return types, exports (named vs default), type vs interface.
   - Constants: names and values (for example thresholds, weights, durations, limits) against the design and the config files it names.
   - Behavior: algorithms, formulas, ordering, edge cases, error handling, data-layer rules, and numbered correctness properties versus the code and its tests.
   - Task checkboxes in tasks.md: a task marked [x] whose code or tests are missing or incomplete; a task marked [ ] whose work is already present in the changed files; sub-task and file references that no longer match.
   - Direction of the drift: when code and design disagree, say which one looks outdated if the evidence shows it (for example, git log or a newer steering file), otherwise say it is undetermined.

4. Report in Spanish (this is chat with the project owner). Group by spec. For each mismatch give: the code file (with line when useful), the design.md or tasks.md section (heading or task id), what the spec says, what the code does, and the suggested fix target ('update design.md' or 'update code'). Do not skip minor mismatches. Finish with a short list of unmapped files and a count line only if there are mismatches. If a spec has no mismatches, state that in one line. Do not propose or apply edits beyond that suggested fix target.
