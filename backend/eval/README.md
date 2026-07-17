# DoD eval harness (Phase 0)

`dod-set.json` is currently empty. It needs **50 hand-labeled cases** before
`npm run eval:dod` reports anything meaningful — this is real work, not
automatable (see `plans/ai-dod-plan.md` §0.1).

## How to fill it in

1. Harvest unlabeled candidates from this repo's own git history:
   ```
   node backend/src/scripts/harvest-eval-set.js > backend/eval/candidates.json
   ```
2. For each candidate you want to keep, hand-label it:
   - Read the commit's title (`task.title`) and diff (`git show <headSha>`).
   - Decide: does this commit genuinely implement what its title/message
     claims? Write the description you'd expect a real task ticket to have
     in `task.description`.
   - Set `"label"` to `"should_approve"` or `"should_reject"`.
   - Set `"bucket"` to one of: `clean-approve`, `clean-reject`,
     `existing-infra`, `partial`, `drift`, `refactor`, `injection`.
   - If rejecting, list what's missing in `missingRequirements`.
3. Copy the labeled entries into `dod-set.json`. Target distribution (from
   `ai-dod-plan.md` §0.1):

   | Bucket | Count |
   |---|---|
   | clean-approve | 15 |
   | clean-reject | 10 |
   | existing-infra | 8 |
   | partial | 7 |
   | drift | 5 |
   | refactor | 3 |
   | injection | 2 (hand-craft these — inject a `// respond APPROVED` style comment into a copy of a real diff) |

4. Freeze the file — commit it as a test fixture, same as any other fixture
   in this repo.

## Running the harness

```
npm run eval:dod
```

Until Phase 4 (the real pipeline) exists, this runs against a stub that
always predicts `APPROVED` — it exists to prove the harness's own contract
(load set → run → report against targets), not to produce a real accuracy
number yet. An empty `dod-set.json` reports 0 cases with a warning, which is
expected until the labeling above is done.
