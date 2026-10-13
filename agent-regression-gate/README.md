# Anubys

Self-contained static site for Anubys, a CI-native agent regression model harness. The landing page is visual; method, gate, results, integrations, how it works, and docs each have their own `index.html`. Every asset path is relative (`./css`, `./js`, `./data`, or `../` from a nested route), so the same files work at `https://ryean0.github.io/agent-regression-gate/` and, after the repository rename, at `https://ryean0.github.io/anubys/`.

Optional prefix: set `data-base` on `<html>` (`./` on the landing page, `../` on a nested route). Canonical and Open Graph URLs are relative.

## Go live

1. Create the public repository `ryean0/agent-regression-gate`.
2. Put these files at that repository’s root (`index.html` at `/`, not nested again).
3. Enable GitHub Pages, source **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. The site is then `https://ryean0.github.io/agent-regression-gate/`.

This portfolio repository publishes only the Next.js `out/` directory. This folder is not part of that deploy. The portfolio pages were not changed.

## Results file

`data/results.preliminary.json` is the only file the page reads on load, and the only place to drop real harness output (expected around 30 October 2026). The shipped sample is harness results schema 2.0.0 (`schema/results.schema.json`): `version` `"2.0.0"`, `status` (`preliminary` or `final`), `level: 0.9`, `likely_regression`, and per arm `scheduled_rollouts`, `environment_misses`, `miss_counts`, an optional `model_id`, and an optional one-sentence `caption`. Rates are strings, `3/5` or `0.6`. Decimals such as `0.05` and amounts such as `$1.25` are caption text, not rates. Version 1 files still parse. Any other major version is rejected with `unsupported results version X`.

The private harness repository was not readable from the environment that built this page, so this copy is a contract-faithful preliminary example, not a dump of `docs/examples/results.preliminary.json`. Replace this file in place when that example, and later the real run, is available. A `preliminary` status shows the banner. `final` removes it. Labels are Pass (`likely_regression` false), Block (`likely_regression` true), Insufficient evidence (`likely_regression` null and the run is not invalid), and Invalid run (`invalid_run` true). Model ids are shown when the file records them. Scenario rows stay diagnostics.

## Checks

```bash
npm test
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/`.
