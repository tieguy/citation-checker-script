# Historical-prompt replay runs

Worked example of the historical-replay capability added in PR #165
(`BENCHMARK_PROMPT_OVERRIDE_FILE` env var in `run_benchmark.js`). These
files were generated on 2026-05-02 by running each historical userscript
prompt against the v1+v2+v3 dataset (187 entries) with the 5-model panel
used in the OpenRouter overnight experiment:

- `openrouter-mistral-small-3.2`
- `openrouter-olmo-3.1-32b`
- `openrouter-deepseek-v3.2`
- `claude-sonnet-4-5`
- `gemini-2.5-flash`

Each results file also contains synthetic ensemble rows
(`openrouter-vote-3` and `openrouter-vote-3-binary`, computed via
`compute_ensemble.js`) over the three OpenRouter panel members.

## What's here

| File | Contents |
|---|---|
| `2026-01-20-prompt.txt` | The system prompt as it lived in `main.js` at commit `16f365a` (the original `main.js`, day 1 of the project) — `generateSystemPrompt`'s template-literal body, verbatim. |
| `2026-01-20-results.json` | Result rows from running the 2026-01-20 prompt: 5 providers × 187 entries + 374 synthetic ensemble rows = 1309 rows total. Zero errors. |
| `2026-04-19-prompt.txt` | The system prompt at commit `00a87d4` — the last `main.js` commit before the project's external contributor (`luis@lu.is`) made his first push. Three additions Alex made between January and that date: transliteration handling, IA-snapshot recognition, and the "if article content is present, the source IS usable" clause. This text is byte-equivalent to today's `core/prompts.js` (modulo whitespace). |
| `2026-04-19-results.json` | Result rows from running the 2026-04-19 prompt; same shape as above. Zero errors. |
| `comparison-2026-05-02.md` | Side-by-side delta report (Jan→Apr per provider, on Exact / Lenient / Binary). |

## How they were generated

Each results file's `metadata` header records the run-time attribution
(date, prompt source, dataset extraction date). For the January run the
end-to-end command was approximately:

```bash
# 1. Recover the prompt
git show 16f365a:main.js | <extraction script> > /tmp/january-prompt.txt

# 2. Run with override
. <(grep '^OPENROUTER_API_KEY=\|^ANTHROPIC_API_KEY=\|^GEMINI_API_KEY=' /path/to/.env)
export OPENROUTER_API_KEY ANTHROPIC_API_KEY GEMINI_API_KEY
BENCHMARK_PROMPT_OVERRIDE_FILE=/tmp/january-prompt.txt \
BENCHMARK_PROMPT_DATE=2026-01-20 \
  node run_benchmark.js \
  --providers=openrouter-mistral-small-3.2,openrouter-olmo-3.1-32b,openrouter-deepseek-v3.2,claude-sonnet-4-5,gemini-2.5-flash \
  --version all
mv results.json benchmark/historical-runs/2026-01-20-results.json

# 3. Compute ensembles
node compute_ensemble.js --results=benchmark/historical-runs/2026-01-20-results.json --write
```

(In practice the experiment ran in two phases — OpenRouter providers first
overnight, then Claude+Gemini added via `--resume` once those keys arrived
the next morning.)

The 5-model panel is documented above; the 3-model voting panel
(Mistral+OLMo+DeepSeek through OpenRouter) follows the wikidata-SIFT
"Cheap-3" cohort. See the PR description for context.

## Caveats — what these data accurately reflect

- **The prompt at the historical date.** The text in each `*-prompt.txt`
  is verbatim from the cited git commit. Source of truth.
- **Today's models scoring against that prompt.** We use current model
  versions (`claude-sonnet-4-5-20250929`, `gemini-2.5-flash`,
  Mistral/OLMo/DeepSeek as deployed on OpenRouter at run time). This
  answers "what would today's models do with January's prompt," **not**
  "what did the userscript actually produce in January 2026 at the time."
  Older model snapshots are not always available.
- **Source text from a frozen extraction.** `dataset.json` rows reference
  `source_text` as fetched at extraction time through whichever proxy
  version was deployed then; we replay against that frozen text rather
  than re-fetching. For "what would a January user have seen" this is
  closer to right than re-fetching today; for "what would the *current*
  proxy give a January user" you'd need to re-extract.
- **Stochastic noise.** Temperature 0.1, not 0. Run-to-run variance is
  small but real.

## Headline finding

Alex's three prompt additions between January and pre-active April were
net-positive at the ensemble level (`openrouter-vote-3-binary` +1.1 pp
Exact, +1.6 pp Binary), with substantial individual-model gains for
DeepSeek (+6.4 pp Exact, +9.1 pp Lenient) and Mistral (+3.7 pp Exact),
roughly flat for Claude / Gemini, and a notable regression for OLMo
(-6.4 pp Exact). See `comparison-2026-05-02.md` for the full table.

## How to add a new historical-replay run

1. Pick the SHA whose prompt you want to score.
2. Recover the prompt text into a file (`git show <sha>:core/prompts.js`
   for post-#118 dates, `git show <sha>:main.js` for pre-#118).
3. Run `BENCHMARK_PROMPT_OVERRIDE_FILE=<path> BENCHMARK_PROMPT_DATE=<YYYY-MM-DD>
   node run_benchmark.js ...`.
4. Drop the resulting `results.json` here as `<YYYY-MM-DD>-results.json`,
   and the prompt as `<YYYY-MM-DD>-prompt.txt`.
5. Update this README's table and (if useful) the comparison report.
