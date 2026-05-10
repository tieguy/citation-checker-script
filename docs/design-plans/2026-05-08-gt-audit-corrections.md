> **Status (2026-05-08):** Implemented. The seven GT downgrades described below ship in this PR. The two flagged citation-defect categories (structural-fragment / embedded-back-reference, primary-source-carrying-secondary-claim) are filed as separate follow-up issues.

# Live-page audit of suspected GT calibration drift

Background: a recent prompt-refactor experiment surfaced thirteen rows where Claude Sonnet 4.5 lands on a stricter verdict (typically `Partially supported`) than the dataset's `Supported` ground truth, while citing the same body evidence the model cites under the historical baseline prompt. Two reads are possible:

1. **Sonnet over-strictness.** Real Sonnet quality regression on these rows.
2. **GT calibration drift.** The cited live source no longer fully supports the claim's specific assertions; Sonnet is correct under the live-page principle and GT is generous.

This document records a live-page audit that distinguishes the two for each of the thirteen rows. Seven rows are corrected via this PR (GT downgraded from `Supported` to `Partially supported`). The remaining six are catalogued with rationale for why they were not corrected here — three of them surface higher-layer issues that warrant separate follow-up.

## Method

For each row:

1. Fetch the cited live source URL with `curl` (or its Wayback snapshot if the URL is already a Wayback archive).
2. Search the live page for the claim's specific assertions (numeric values, named entities, dates, building lists, etc.) using `grep`.
3. Compare what the live page contains vs what the claim asserts.
4. Where the cited URL points to a content-update-prone page (current-statistics articles), use the Wayback CDX API to bisect *when* the live page diverged from the cited claim — drift mechanism is informative even when the per-row decision is the same.

Per the dataset's ground-truth principle (CCS PR #151): GT reflects what an editor following the citation would find on the live page, not what was captured in `source_text` at extraction time.

## Rows corrected in this PR (GT: `Supported` → `Partially supported`)

### `row_5` — MPI: immigrants and their U.S.-born children, 2024

**Claim:** "In 2024, immigrants and their U.S.-born children number more than 93 million people, or 28% of the total U.S. population."

**Source:** [migrationpolicy.org/article/frequently-requested-statistics-immigrants-and-immigration-united-states](https://www.migrationpolicy.org/article/frequently-requested-statistics-immigrants-and-immigration-united-states)

**Live page (2026-05-08):** "Immigrants and their U.S.-born children numbered more than **97.2 million** people, or **29 percent** of the total noninstitutionalized U.S. population in 2024."

**Drift bisection (Wayback CDX):**

| Snapshot | Children figure |
|---|---|
| 2025-02 / 2025-03 | "approximately 90.8 million people, or 27 percent ... in 2023" |
| 2025-06 → 2026-03 | "more than 93 million people, or 28 percent ... in 2024" *(matches the claim)* |
| 2026-04 onward | "more than 97.2 million people, or 29 percent ... in 2024" |

The article tracks current Census/ACS data and updates as new figures release. The Wikipedia claim matched MPI from approximately June 2025 to March 2026; MPI revised its 2024 estimate in April 2026 and the claim no longer matches. Classic citation-drift case.

### `row_11` — Pew: 2017 immigrant breakdown

**Claim:** "In 2017, out of the U.S. foreign-born population, some 45% (20.7 million) were naturalized citizens, 27% (12.3 million) were lawful permanent residents, **6%** (2.2 million) were temporary lawful residents, and 23% (10.5 million) were unauthorized immigrants."

**Source:** [Wayback Pew article](https://web.archive.org/web/20200227051906/https://www.pewresearch.org/fact-tank/2019/06/17/key-findings-about-u-s-immigrants/) (fixed snapshot)

**Live page:** "Some 27% of immigrants were permanent residents and **5%** were temporary residents in 2017."

The article body says **5%**; the claim says **6%**. The chart image embedded in the article (Wayback-archived alongside) also reads 5%. Numeric mismatch in claim is real, not a chart-vs-text rounding issue.

The article also does not give the absolute population numbers (20.7M, 12.3M, 2.2M) for three of the four categories; only "10.5 million unauthorized immigrants" is in the body text.

### `row_42` — MEE: specific buildings overtaken in Sanaa

**Claim:** "having taken over the offices of the prime minister, the state television building, and military headquarters. Al-Ahmar's forces reportedly surrendered to the Houthis after fighting,"

**Source:** [middleeasteye.net/fr/in-depth/features/yemenis-are-shocked-houthi-s-quick-capture-sanaa-690971750](http://www.middleeasteye.net/fr/in-depth/features/yemenis-are-shocked-houthi-s-quick-capture-sanaa-690971750)

**Live page:** "It took northern Yemen Shiite rebels a couple of days to take over key government buildings and military buildings" — generalization; specific buildings (PM offices, state TV, military HQ) are not enumerated. Al-Ahmar's surrender after fighting is confirmed.

Source supports the surrender and the general "key buildings overtaken" framing; does not support the specific three-building enumeration.

### `row_49` — BBC: Hadi resignation date specificity

**Claim:** "They stepped up their efforts by shelling Hadi's residence and capturing the presidential palace **on 20 January**, actions from which they had refrained in September 2014. These attacks prompted Hadi, Bahah, and the entire cabinet to resign."

**Source:** [bbc.com/news/world-middle-east-30936940](https://www.bbc.com/news/world-middle-east-30936940) (published 2015-01-22, Thursday)

**Live page body uses temporal language only:** "Earlier this week, Houthi gunmen ... laid siege to the presidential palace" + "Then on Wednesday the home of President Hadi was shelled."

Calendar inference: Wednesday before pub-Thursday-Jan-22 = **Jan 21** for the shelling; "earlier this week" = Mon-Tue range (Jan 19-20) for the palace events. The claim's "20 January" matches the palace siege within a day but doesn't match the body's "Wednesday" reference for the shelling. The literal "20 January" does not appear in the article body; the "January 20" hits in the page HTML are all in image captions and metadata strips.

Substantive events (shelling, palace siege, resignations) all supported. Specific "20 January" date does not align with body's temporal markers.

### `row_52` — Sunday Times feature: Maskhadov power concentration

**Claim:** "Aslan Maskhadov **tried to concentrate power in his hands to establish authority**, but **had trouble creating an effective state or a functioning economy**. He attempted to attract foreign investment in Chechnya's oil industry and reconstruction of Grozny."

**Source:** [mashar.free.fr/visit_lon.htm](http://mashar.free.fr/visit_lon.htm) (1997-era London Sunday Times feature on Maskhadov's UK state visit)

**Live page:** confirms "we must rebuild and we must attract investment" + "to clinch deals to reconstruct Grozny, to invest in Chechen oil." Does not contain anything about power concentration or governance failures — the article is a state-visit reaction feature, not domestic-governance analysis.

Three claim assertions; source covers one (oil/Grozny investment); two are absent (power concentration, "trouble creating an effective state / functioning economy").

### `row_65` — Al Jazeera "decade of growth": three of five specifics

**Claim:** "Al Jazeera's first day on air was **1 November 1996**. It offered **six hours of programming per day**, which would **increase to 12 hours by the end of 1997**. It was broadcast to the immediate area as a **terrestrial signal, and on cable, as well as through satellites (which was also free to users in the Arab world)**. **1 January 1999** was Al Jazeera's first day of 24-hour broadcasting."

**Source:** [Wayback Al Jazeera archive](https://web.archive.org/web/20150321050314/http://www.aljazeera.com/archive/2006/11/2008410115625813175.html) (fixed snapshot of a 10-year-anniversary timeline article)

**Live page:** "November 1, 1996: Al Jazeera channel is launched, transmitting six hours a day" + "January 1, 1999: Al Jazeera expands its schedule to 24 hours a day."

Three of five specific assertions confirmed (1996 launch, 6 hours initial, 1999 24-hour switchover). The 1997 12-hour expansion and the distribution-mode breakdown (terrestrial / cable / satellite + free in Arab world) are not in the source body.

### `row_68` — ConnecticutHistory.org: Charter Oak specifics

**Claim:** "The original settlement area contained the site of the Charter Oak, an **old white oak tree** in which colonists hid Connecticut's **Royal Charter of 1662** to protect it from confiscation by an **English governor-general**. The state adopted the oak tree as the emblem on the Connecticut state quarter. The Charter Oak Monument is located at the corner of Charter Oak Place, a historic street, and Charter Oak Avenue."

**Source:** [Wayback ConnecticutHistory.org "Charter Oak Fell"](https://web.archive.org/web/20140728110520/http://connecticuthistory.org/the-charter-oak-fell/) (fixed snapshot)

**Live page:** confirms the charter-hiding story (general), the state quarter emblem, and the monument location at Charter Oak Avenue + Place. Live page contains zero hits for "white oak", "1662", "James II", "Edmund Andros", "Andros", or "governor-general" — the species, year, and official title in the claim are not in the cited source.

These specifics belong in a colonial-history reference, not this short historical-blog piece.

## Rows audited but NOT corrected here

### `row_8` — DHS Table 7: scraper-completeness gap, GT correct

The cited DHS Yearbook Table 7 (Wayback) does contain all three claim categories (NACARA, "Children born subsequent to issuance of parent's visa", Soviet/Indochinese parolees). However, the dataset's `source_text` for this row was almost entirely Wayback Machine boilerplate; the actual table content was past the 12k extraction cap. GT is correct against the live source. Re-extracting `source_text` (or extending the extraction cap / stripping Wayback boilerplate before counting) would resolve this row without a GT change. Not in scope for this PR.

### `row_33` — MEE Yemen "high treason on 7 January": GT correct, real over-strictness

The MEE article body says "On Wednesday" with publication date 9 January 2026 (Friday); Wednesday before Friday Jan 9 = Jan 7 by trivial calendar inference, matching the claim's "7 January". GT is correct under the live-page principle. The Sonnet stricter call here ("body lacks specific date 'January 7'") is genuine over-strictness on inference an editor would routinely make. No fixture change.

### `row_69` — Britannica Hartford Convention: parenthetical aside

Source confirms the substantive Hartford Convention claim (date, five New England states, secession discussion). The claim's parenthetical "(Maine was still part of Massachusetts at that time)" is well-known historical context — Maine became a state via the 1820 Missouri Compromise. The parenthetical is not in the cited Britannica source (zero hits for "Maine" anywhere on the page), but downgrading GT for an explanatory parenthetical would generalize too aggressively (Wikipedia editors regularly add parentheticals to substantive claims). The cited source does its substantive job. No fixture change.

### `row_9`, `row_45`, `row_64` — flagged for higher-layer follow-up

These three rows surface citation-defect categories that aren't well captured by the existing GT enum (`Supported` / `Partially supported` / `Not supported` / `Source unavailable`). Mechanical GT-downgrading on them would lose signal. They're skipped here and described under "Follow-up issues" below.

## Follow-up issues (separate filings)

### Structural leading-fragment / embedded-back-reference claims

`row_9`, `row_45`. The benchmark's `extract_dataset.js` extracts a fragment of Wikipedia text whose specific claim_text begins with a prepositional phrase ("of these...") OR contains an embedded clause ("to replace Basindawa") that back-references prior content sourced via *different* Wikipedia footnotes in the same paragraph. Per-source benchmark scoring then asks the cited source to support the entire extracted fragment — including the back-referencing portion that is out of scope for that citation.

Candidate fixes: (a) expose `claim_container` to the evaluator alongside `claim_text` so the model can disambiguate structural scaffolding; (b) detect leading-prepositional-fragment / embedded-named-entity-back-reference patterns and either expand the extracted span or skip such rows; (c) per-citation segmentation when multiple footnotes appear in a paragraph, scoping each citation's burden to the immediately-preceding text segment.

### Primary-source-carrying-secondary-claim

`row_64`. The cited source is a primary legal document (Qatar Law No. 1 of 1996); the claim asserts historical/biographical facts (launch date, founder name) that primary legal documents do not carry by genre. Wikipedia editorial practice flags this independently as inappropriate citation use. The dataset's GT enum has no slot for "wrong source type."

Candidate fix: add a `source_type` annotation (`primary` / `secondary` / `tertiary`) to `Benchmarking_data_Citations.csv` and surface "primary source carrying historical claim" as a distinct verdict or warning class.

## Reproducibility

The `curl` evidence above is reproducible without API keys. For Wayback CDX bisection (used on `row_5`):

```sh
curl -sSL "https://web.archive.org/cdx/search/cdx?url=<source-url>&output=json&from=20250101&to=20260601&collapse=timestamp:6&filter=statuscode:200"
```

Then fetch individual snapshots via `https://web.archive.org/web/<timestamp>/<url>` and grep for the claim's specific values. Pattern can be applied to any current-statistics-tracking source where claim drift is suspected.

## Out of scope (downstream regeneration not in this PR)

`benchmark/results.json` denormalizes `ground_truth` (and a derived `correct` field) into each row at benchmark time, and `analyze_results.js` reads GT from `results.json`, not from `dataset.json`. That means a GT change in CSV / `dataset.json` does NOT propagate to `results.json` or `analysis.json` automatically — those are LLM-output artifacts frozen at the time the benchmark was run.

To fully reflect the corrected GT in metrics, a subsequent step needs one of:

- **Re-run `npm run benchmark`** — produces fresh `results.json` with current GT denormalized in. Side effect: LLM verdicts are non-deterministic and change on every run; cost in API calls.
- **Patch `results.json` in place** — update `ground_truth` and recompute `correct` for the affected rows × providers (28 rows in current state: 7 entry_ids × 4 providers with results). Preserves existing LLM verdicts; loses no fidelity to the original benchmark run; deterministic.

Then `npm run analyze` against the updated `results.json` refreshes `analysis.json`.

Either path is intentionally **not bundled into this PR** so the source-of-truth correction is reviewable on its own. The patch-results-in-place path is the surgical follow-up; the LLM re-run is a larger workstream.

## Frozen snapshots

Frozen v1 / v3 snapshots (`dataset_v1.json`, `dataset_v3.json`, `analysis_v1.json`, `analysis_v3.json`, `results_v1.json`, `results_v3.json`) are intentionally untouched. Per the dataset versioning architecture, those snapshots preserve the original published-pipeline state for reproducibility; corrections to v1 rows in the CSV propagate to the current `dataset.json` going forward but do not retroactively edit frozen snapshots.
