# Anubys

Launch page for Anubys, a CI-native agent regression model harness. It reads a results file and shows one suite status: Pass, Block, Insufficient evidence, or Invalid run. Insufficient evidence can carry a Likely regression warning. Site paths are relative, so the same files work when this repository is renamed to `anubys`. The Pages artifact is still the `agent-regression-gate` folder.

Live site: https://ryean0.github.io/agent-regression-gate/

The site files live in `agent-regression-gate/`. GitHub Actions uploads that folder as the Pages artifact, so the project site is served at the URL above.

The owner must set **Settings → Pages → Source** to **GitHub Actions**. The deploy job tries to turn that source on. If the token cannot, the job stays green and prints a reminder, and the live URL stays a 404 until the setting is saved and the workflow is re-run.

## Local preview

```bash
npm test
npm run preview
```

Open http://127.0.0.1:4173/agent-regression-gate/

`npm test` runs the 59 site tests, then checks that every route, the favicon, stylesheet, scripts, results file, and Open Graph image resolve with relative paths.

## Swap in a real results file

The page fetches `agent-regression-gate/data/results.preliminary.json` on load. That path is the only place to drop real harness output. Replace the file in place around 30 October 2026, when the harness run is ready. Keep the filename: the page requests that path and no other. The shipped sample is harness results schema 2.0.0. Version 1 files still parse. The shape is described in `agent-regression-gate/schema/results.schema.json`.

The checked-in file is a preliminary example (`"status": "preliminary"`, `"version": "2.0.0"`), so the results panel renders before a real run is copied in. Each arm may record a `model_id`. The page shows those ids when they are present.

- Preliminary: copy the product example (`docs/examples/results.preliminary.json` from the product repository) over `data/results.preliminary.json`. Leave `"status": "preliminary"`. The page shows the preliminary banner.
- Final: copy the harness final results file over the same path. Set `"status": "final"`. The preliminary banner is replaced by the final banner. `likely_regression: false` is Pass. `likely_regression: true` is Block. `likely_regression: null` without `invalid_run` is Insufficient evidence. `invalid_run: true` is Invalid run.

No HTML, CSS, or script change is required.

## Private Pages

This repository is public, so GitHub Pages serves the site to anyone. On a paid GitHub plan (Pro, Team, or Enterprise), the same Actions deployment can be switched to private Pages from a private repository. Private Pages is visible only to people with read access to the repository.
