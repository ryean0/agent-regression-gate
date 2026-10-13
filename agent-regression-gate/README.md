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

`data/results.preliminary.json` is the only file the page reads on load, and the only place to drop real harness output (expected around 30 October 2026). The shipped sample is harness results schema 2.1.0 (`schema/results.schema.json`): `schema_version` `"2.1.0"`, `run_kind` (`screening`, `baseline`, `aa`, or `gate`), `baseline_pool_model_id`, `min_valid_fraction_per_scenario` (an exact string such as `"0.6"`), and `rollouts_per_scenario.baseline` equal to `rollouts_per_scenario.candidate`. `verdicts.overall` has `delta` (a string such as `"0.05"`), `difference_ci` (`lower`, `upper`, `level` 0.9), required `likely_regression`, and required `model_ids.baseline` and `model_ids.candidate`. `diagnostics` rows carry the scenario id, family id, scheduled rollouts, miss counts, missing cassette keys, pass rates, difference, and difference CI. Fraction values are strings. Version 1 and 2.0.0 files still parse, including a per-arm `model_id`. Overall model ids are preferred when present. Alpha and the miss cap are not in this file. When delta and the CI level are absent the panel shows δ = 5 pp / 90%.

A `preliminary` status shows the banner. `final` removes it. Labels are Pass (`likely_regression` false), Block (`likely_regression` true), Insufficient evidence (`likely_regression` null and the run is not invalid), and Invalid run (`invalid_run` true). On schema 2.1.0 the boolean comes from `verdicts.overall.likely_regression`. Model ids, `run_kind`, delta, and the CI level are shown from the file. Diagnostic rows stay diagnostics.

## Checks

```bash
npm test
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/`.
