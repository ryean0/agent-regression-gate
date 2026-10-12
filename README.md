# Agent Regression Gate

Launch page for the CI Agent Regression Harness. The page is black and white with a `#ff7a1a` accent. It reads a results file and shows one suite status: likely regression, pass, or invalid run.

Live site: https://ryean0.github.io/agent-regression-gate/

The site files live in `agent-regression-gate/`. GitHub Actions uploads that folder as the Pages artifact, so the project site is served at the URL above.

The owner must set **Settings → Pages → Source** to **GitHub Actions**. Until that setting is saved, a green workflow can still leave the live URL as a 404.

## Local preview

```bash
npm test
npm run preview
```

Open http://127.0.0.1:4173/agent-regression-gate/

`npm test` runs the 23 site tests, then checks that the favicon, stylesheet, scripts, results file, and Open Graph image resolve under `/agent-regression-gate/`.

## Swap in a real results file

The page fetches `agent-regression-gate/data/results.preliminary.json` on load. Replace that file in place. Keep the filename: the page requests that path. The shape is results.json v1, described in `agent-regression-gate/schema/results.schema.json`.

The checked-in file is a preliminary example (`"status": "preliminary"`), so the results panel renders before a real run is copied in.

- Preliminary: copy the harness example (`docs/examples/results.preliminary.json` from the CI Agent Regression Harness) over `data/results.preliminary.json`. Leave `"status": "preliminary"`. The page shows the preliminary banner.
- Final: copy the harness final results file over the same path. Set `"status": "final"`. The preliminary banner is replaced by the final banner. The suite field `likely_regression` is still the only regression call.

No HTML, CSS, or script change is required.

## Private Pages

This repository is public, so GitHub Pages serves the site to anyone. On a paid GitHub plan (Pro, Team, or Enterprise), the same Actions deployment can be switched to private Pages from a private repository. Private Pages is visible only to people with read access to the repository.
