---
inclusion: manual
---
# Journal draft

Draft a new dated entry at the end of docs/kiro-journal.md from the commits made since the last entry. Does not commit.

Draft a new entry for docs/kiro-journal.md. Do not commit, stage or run any git command that changes state. The only file you may edit is docs/kiro-journal.md.

1. Read docs/kiro-journal.md. Find the last `## YYYY-MM-DD — title` heading and its date. Read the last two or three entries to copy their format: heading, a `**Kiro feature:**` line, bullets with bold lead-ins, a `**What it changed:**` bullet, and `Related:` links to earlier entries when relevant.

2. Collect the commits since that date, from the workspace root: `git log --since=<last entry date> --name-status --format='%h %ad %s%n%b' --date=short`. Also check `git status --short` for uncommitted work and mention it only if it is relevant. If there are no commits since that date, say so and stop without editing the file. Commits made on the last entry's own date may already be covered by it; compare against the entry's text and skip what it already describes.

3. Append a new dated entry at the end of the file, in English, using today's date (`date +%F`). Cover three things:
   - What was built: group by feature or spec, based on the commit messages and changed files.
   - Bugs or gaps found, and how they were found (tests, mutation checks, manual review). Say which method found each one.
   - Anything Kiro did that was unexpected (for example, work outside the requested scope, a changed approach, a fix made in a different layer than planned).

4. Facts only. No praise, no speculation, no marketing words. Use exact numbers (test counts, file counts) only when you read them from the code, the tests or command output; run the relevant command if you need a count. When you are unsure about a claim, open the code or the test to check it. Mark anything you could not verify with `(not verified)` and say what is missing. Commit messages are evidence of intent, not proof that the code does it: confirm in the diff or the tests before stating it as fact. Do not invent mutation checks or manual reviews that no commit, test or file records.

5. Follow the journal's existing style and the conventions steering: sentence case, plain language, no em-dash chains. Keep the entry about as long as the existing ones.

6. Reply in Spanish with a short note of what you added and the list of items marked (not verified). Leave the change uncommitted.
