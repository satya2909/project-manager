# Deploy workflow setup

`.github/workflows/deploy.yml` runs tests, then deploys — but only when you
trigger it (Actions tab → "Deploy" → "Run workflow") or push a version tag
(`git tag v1.2.3 && git push origin v1.2.3`). It never fires on a plain push
to `main`.

## One-time setup

1. **Disable auto-deploy on push** in both platforms first — otherwise this
   workflow is redundant with an auto-deploy that still fires on every push:
   - **Render**: Service → Settings → "Auto-Deploy" → set to **No**.
   - **Vercel**: Project → Settings → Git → turn off automatic deployments
     for the branch (or repoint "Production Branch" away from `main`).

2. **Get a deploy hook URL from each platform:**
   - **Render**: Service → Settings → "Deploy Hook" → copy the URL.
   - **Vercel**: Project → Settings → Git → "Deploy Hooks" → create one,
     copy the URL.

3. **Add them as repo secrets** (GitHub repo → Settings → Secrets and
   variables → Actions → "New repository secret"):
   - `RENDER_DEPLOY_HOOK_URL`
   - `VERCEL_DEPLOY_HOOK_URL`

## Using it

- **Ad hoc**: Actions tab → "Deploy" workflow → "Run workflow" button.
- **Tagged release**: `git tag v1.2.3 && git push origin v1.2.3`.

Either way, the `test` job runs `npm test` first — the deploy job only runs
if tests pass (`needs: test`), so a red suite can't reach production.
