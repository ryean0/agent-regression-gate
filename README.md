# Agent Regression Gate

Launch page for the CI agent regression harness. It publishes a pinned-suite gate result: black and white, with a `#ff7a1a` accent, and a console that reads `results.json`.

Live site: https://ryean0.github.io/agent-regression-gate/

## Local preview

```bash
npm test
npm run preview
```

Open http://127.0.0.1:4173/agent-regression-gate/

## Swap in a real results file

The page loads `results.json` from the site root. The badge follows the `status` field: `preliminary` or `final`.

Replace `results.json` with a file from `rphua-dev/ci-agent-regression-harness`:

- Preliminary: `docs/examples/results.preliminary.json` (`"status": "preliminary"`)
- Final: the harness final results file, same shape, with `"status": "final"`

No other change is required. Rebuild with `npm run build` before publish. The checked-in file is a sample fixture so the console renders before a real run is copied in.

## Private Pages

This repository is public, so GitHub Pages serves the site to anyone. On a paid GitHub plan (Pro, Team, or Enterprise), a private repository can switch the same Actions deployment to private Pages, visible only to people with read access.
