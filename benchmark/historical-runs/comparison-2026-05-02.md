# January (2026-01-20) vs April (2026-04-19) userscript prompt — same dataset, same models

- Generated: 2026-05-02T19:42:30.575Z; rescored: 2026-05-09 against ground-truth corrections shipped in `docs/design-plans/2026-05-08-gt-audit-corrections.md` (7 v1 rows downgraded Supported → Partially supported)
- Dataset: v1+v2+v3, 187 rows, ground truth distribution 46.0% Supported / 29.4% Partially / 24.6% Not supported
- 5-model panel: openrouter-mistral-small-3.2, openrouter-olmo-3.1-32b, openrouter-deepseek-v3.2, claude-sonnet-4-5, gemini-2.5-flash; 0 errors on either run
- Plus two synthetic ensembles derived from the 3 OpenRouter panel members (`openrouter-vote-3` for 4-class majority, `openrouter-vote-3-binary` for binary collapse)

## Side-by-side accuracy

All values are %. Δ = April − January (positive = the April prompt helped this provider).

| Provider | Jan Exact | Apr Exact | Δ Exact | Jan Lenient | Apr Lenient | Δ Lenient | Jan Binary | Apr Binary | Δ Binary |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| openrouter-vote-3-binary | 61.5 | 62.6 | +1.1 | 85.0 | 86.6 | +1.6 | 85.0 | 86.6 | +1.6 |
| gemini-2.5-flash | 65.2 | 62.6 | -2.7 | 78.1 | 80.2 | +2.1 | 78.6 | 80.2 | +1.6 |
| claude-sonnet-4-5 | 48.1 | 47.6 | -0.5 | 64.7 | 66.3 | +1.6 | 82.4 | 82.9 | +0.5 |
| openrouter-deepseek-v3.2 | 41.2 | 48.7 | +7.5 | 58.3 | 67.4 | +9.1 | 79.1 | 85.6 | +6.4 |
| openrouter-mistral-small-3.2 | 42.8 | 47.6 | +4.8 | 68.4 | 72.2 | +3.7 | 84.0 | 84.0 | +0.0 |
| openrouter-vote-3 | 43.9 | 46.5 | +2.7 | 66.8 | 69.0 | +2.1 | 85.0 | 85.6 | +0.5 |
| openrouter-olmo-3.1-32b | 42.8 | 37.4 | -5.3 | 59.4 | 57.8 | -1.6 | 74.9 | 73.8 | -1.1 |
