# Mullion

Launch page for Mullion, a CI regression gate for agents. The page is black and white with a `#ff7a1a` accent. It reads a results file and shows one suite status: Pass, Block, Insufficient evidence, or Invalid run. Insufficient evidence can carry a Likely regression warning. The repository name and the Pages URL stay `agent-regression-gate`.

Live site: https://ryean0.github.io/agent-regression-gate/

The site files live in `agent-regression-gate/`. GitHub Actions uploads that folder as the Pages artifact, so the project site is served at the URL above.

The owner must set **Settings → Pages → Source** to **GitHub Actions**. The deploy job tries to turn that source on. If the token cannot, the job stays green and prints a reminder, and the live URL stays a 404 until the setting is saved and the workflow is re-run.

## Local preview

```bash
npm test
npm run preview
```

Open http://127.0.0.1:4173/agent-regression-gate/

`npm test` runs the 23 site tests, then checks that the favicon, stylesheet, scripts, results file, and Open Graph image resolve under `/agent-regression-gate/`.

## Swap in a real results file

The page fetches `agent-regression-gate/data/results.preliminary.json` on load. Replace that file in place. Keep the filename: the page requests that path. The shape is results.json version 1, or version 2.0.0 (any `2.x.y` string), described in `agent-regression-gate/schema/results.schema.json`.

The checked-in file is a preliminary example (`"status": "preliminary"`), so the results panel renders before a real run is copied in.

- Preliminary: copy the product example (`docs/examples/results.preliminary.json` from the product repository) over `data/results.preliminary.json`. Leave `"status": "preliminary"`. The page shows the preliminary banner.
- Final: copy the harness final results file over the same path. Set `"status": "final"`. The preliminary banner is replaced by the final banner. The suite field `likely_regression` is still the only regression call.

No HTML, CSS, or script change is required.

## Private Pages

This repository is public, so GitHub Pages serves the site to anyone. On a paid GitHub plan (Pro, Team, or Enterprise), the same Actions deployment can be switched to private Pages from a private repository. Private Pages is visible only to people with read access to the repository.
