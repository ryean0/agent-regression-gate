# CI Agent Regression Harness

Self-contained static site. Copy this folder into the public repo `ryean0/agent-regression-gate` unchanged. Every asset path is relative (`./css`, `./js`, `./data`), so the same files work at the project-page URL `https://ryean0.github.io/agent-regression-gate/` and at a domain root.

Optional prefix: set `data-base` on `<html>` (default `./`). Canonical and Open Graph URLs in `index.html` already point at the planned project-page address. Change those three tags if the host changes.

## Go live

1. Create the public repository `ryean0/agent-regression-gate`.
2. Put these files at that repository’s root (`index.html` at `/`, not nested again).
3. Enable GitHub Pages, source **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. The site is then `https://ryean0.github.io/agent-regression-gate/`.

This portfolio repository publishes only the Next.js `out/` directory. This folder is not part of that deploy. The portfolio pages were not changed.

## Results file

`data/results.preliminary.json` is the file the page reads on load. It follows results.json v1 (`schema/results.schema.json`): `version`, `status` (`preliminary` or `final`), `level: 0.9`, `likely_regression`, and per arm `scheduled_rollouts`, `environment_misses`, and `miss_counts`. Rates are strings, `3/5` or `0.6`.

The private harness repository was not readable from the environment that built this page, so this copy is a contract-faithful preliminary example, not a dump of `docs/examples/results.preliminary.json`. Replace the file in place when that example, and later the real run, is available. A `preliminary` status shows the banner. `final` removes it. The suite verdict is `likely_regression` only. Scenario rows stay diagnostics.

## Checks

```bash
npm test
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/`.
