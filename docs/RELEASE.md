# Review, deployment and rollback

## Review now

Use the isolated 2.0 review branch or its self-contained HTML. The production GitHub Pages branch is main. The review workflow has read-only repository access and performs validation only. It has no deployment step.

## After owner approval

1. Recheck current Georgia Commission notices, the effective statutory version and the documented source checks. Address remaining official-worksheet reconciliation notes with counsel or the appropriate reviewer.
2. On `review/calculator-2-0`, run `npm run build`, `npm run check`, `npm test` and the browser suite. Confirm the generated index is committed. Preserve a reference to the exact current production commit in the release record. The production baseline inspected for this release was `f7567493808f02f1128b29a63af0a380af7cd5a9`.
3. Approve and merge the reviewed PR into main with your usual GitHub merge policy. Keep the existing Pages publishing settings. There is no server, account or database migration.
4. After the Pages build completes, open the site in a clean browser profile. Verify $414/month and $414.11 line 10 on the opening example. Exercise Save, reopen Saved, compare a scenario and print from desktop and a phone.
5. Keep the approved commit and PR linked to the validation record for later review.

## Roll back

Use GitHub’s **Revert** on the merged PR and review the resulting revert PR. For a merge commit, a maintainer can equivalently run `git revert -m 1 <merge-commit>` on a fresh branch based on current main. For a single squash commit, use `git revert <squash-commit>`. Merge the reviewed revert and verify the Pages deployment. This preserves later unrelated changes and Git history.

The original version used no local scenario store. Reverting the page does not delete exported files or the new version’s saved browser records. Reapplying 2.0 on the same origin restores access to those records.
