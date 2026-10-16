# Anubys

Self-contained static site for Anubys, a CI-native agent regression model harness. The landing page is visual; method, gate, results, performance, integrations, and how it works each have their own `index.html`. Docs are static pages under `docs/` (introduction, quickstart, concepts, guides, reference, changelog, and roadmap). Asset paths stay relative (`./css`, `./js`, `./data`, or `../` from a nested route). Canonical, Open Graph, Twitter, and JSON-LD URLs are absolute `https://anubys.dev/` addresses.

Optional prefix: set `data-base` on `<html>` (`./` on the landing page, `../` on a nested route). That prefix is only for scripts that fetch site files. Canonical and Open Graph URLs stay on `https://anubys.dev/`. In-site links stay relative.

## Go live

GitHub Actions uploads this folder as the Pages artifact. The custom domain is set in the repository Pages settings, so this folder does not include a CNAME file. The public site is https://anubys.dev/.

This folder is not the portfolio site. The portfolio pages were not changed.

## Results file

`data/results.preliminary.json` is the only results file the results panel reads on load, and the only place to drop real harness output (expected around 30 October 2026). The performance page reads example check timings from `data/timing.sample.json`. That file has the shape of a future `timing` field. Measured numbers are not in it yet. A results file with no `timing` field leaves the efficiency panel empty. The shipped sample is harness results schema 2.1.0 (`schema/results.schema.json`): `schema_version` `"2.1.0"`, `run_kind` (`screening`, `baseline`, `aa`, or `gate`), `baseline_pool_model_id`, `min_valid_fraction_per_scenario` (an exact string such as `"0.6"`), and `rollouts_per_scenario.baseline` equal to `rollouts_per_scenario.candidate`. `verdicts.overall` has `delta` (a string such as `"0.05"`), `difference_ci` (`lower`, `upper`, `level` 0.9), required `likely_regression`, and required `model_ids.baseline` and `model_ids.candidate`. `diagnostics` rows carry the scenario id, family id, scheduled rollouts, miss counts, missing cassette keys, pass rates, difference, and difference CI. The bundled diagnostics are `example.clean.v1` and `example.broken.v1`, and each arm records `model_id`. `suite_id` is optional. An optional `run_summary` may include `planned_rollouts`, `completed_rollouts`, `infra_misses`, `stopped` (null or `monthly_cap`), `total_cost_usd`, `total_cached_input_tokens`, `rollout_duration_p50_s`, and `rollout_duration_max_s`. `schema/step.schema.json` keeps `thinking_tokens` and `cached_tokens` optional. Fraction values are strings. Version 1 and 2.0.0 files still parse, including a per-arm `model_id`. Overall model ids are preferred when present. Alpha and the miss cap are not in this file. When delta and the CI level are absent the panel shows δ = 5 pp / 90%.

A `preliminary` status shows the banner. `final` removes it. Labels are Pass (`likely_regression` false), Block (`likely_regression` true), Insufficient evidence (`likely_regression` null and the run is not invalid), and Invalid run (`invalid_run` true). On schema 2.1.0 the boolean comes from `verdicts.overall.likely_regression`. Model ids, `run_kind`, delta, and the CI level are shown from the file. Diagnostic rows stay diagnostics.

## Checks

```bash
npm test
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/`.
