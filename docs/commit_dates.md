# Dating commits (work log alignment)

To record a commit as if it were made on a specific calendar day, set author and committer dates before committing:

```bash
chmod +x scripts/commit-with-date.sh
./scripts/commit-with-date.sh "2026-03-30T17:00:00" commit -m "Your message"
```

Or inline:

```bash
GIT_AUTHOR_DATE="2026-03-30T17:00:00" GIT_COMMITTER_DATE="2026-03-30T17:00:00" git commit -m "Your message"
```

`git log --format=fuller` shows both dates.

Rewriting dates on commits already pushed requires a history rewrite (`git rebase` / `filter-branch`) and a force push—only do that if your team agrees.
