// Atomized verification pipeline prompts.
//
// Six pure functions — three roles (atomizer, verifier, judge) × two
// shapes (system, user) — replace the previous single-call
// generateSystemPrompt/generateUserPrompt pair. Removed in this phase;
// every caller (cli/verify.js, benchmark/run_benchmark.js, main.js via
// sync-main.js) is updated in Phase 5.
//
// Design constraints reflected in the prompt text:
//   - Verdict surface = { supported, not_supported } at atom level;
//     { SUPPORTED, PARTIALLY SUPPORTED, NOT SUPPORTED } at claim level.
//   - SOURCE_UNAVAILABLE is intentionally absent — the body-usability
//     classifier short-circuits unusable bodies upstream.
//   - Structural scaffolding (numbered steps, explicit verdict taxonomy
//     paragraph) is included specifically because small instruction-
//     tuned models (Granite-4.1-8B) regressed on the prior single-
//     paragraph framing.
//   - Atoms are uniform — no content/provenance split. The verifier
//     sees the bibliographic metadata block alongside the article body
//     for every atom and decides which side has the evidence. The
//     earlier split forced the verifier to pick a side before reading,
//     which collapsed to not_supported when citoid lacked the field the
//     atom referenced (e.g., ISBN absent for Goodreads, publication
//     absent for primary-artifact pages).
//   - Atomizer output is JSON. Callers pass responseFormat:
//     { type: 'json_object' } to the OpenAI-compatible upstreams that
//     support it; others rely on the model's JSON-following discipline.

// === ATOMIZER ===

export function generateAtomizerSystemPrompt() {
    return `You are decomposing a Wikipedia citation claim into atomic assertions that can each be verified independently against the cited source.

This serves the Wikipedia policy of text-source integrity (WP:TSI): each part of an article's material should be supported by the cited source. Split compound claims into atoms so each separately-checkable fact can be evaluated against the source; the rollup combines the atom verdicts into a claim-level verdict (supported / partially supported / not supported). Decomposition is the mechanism that lets the system express "partially supported" when a source covers some of a claim's facts but not others.

An atom is a single declarative assertion. The unit is a separately-checkable fact, not a grammatical component.

Rules:
1. **Decompose multiple independent assertions into separate atoms.** Independent assertions are distinct facts that could be verified against the source independently — different statistics, different events, different entities, different time points, different predicates. Conjunctions ("and", "but", "; "), appositives that introduce new facts ("the lowest three-year increase in decades"), and lists of distinct facts (not shared-predicate lists — see Rule 6) are all decomposition signals.
2. **Treat in-text attribution as a qualifier, not a decomposition target.** Phrases like "According to X", "X reported in 2024 that", "Smith's 2020 study found" attach an author, publication, or date to the asserted content. Keep the attribution in the same atom as the content it modifies — do NOT emit a separate "The source was authored by X" or "The source was published in YEAR" atom. The verifier sees the source's bibliographic metadata alongside the body and can judge the attribution and the content together. If the attributed content itself contains multiple independent facts, decompose those facts (Rule 1) and repeat the attribution in each atom.
3. **Treat temporal qualifiers about the claim's content as content, not as provenance.** "In 2024, immigrants numbered 53 million" is a content claim about a 2024 statistic, not a claim that the source was published in 2024. Do not manufacture a "source was published in YEAR" atom from a content-side date.
4. Preserve direct quotations from the source verbatim. Per WP:V, direct quotations are material that must be supported by the source as presented; paraphrasing a quoted phrase breaks text-source integrity (WP:STICKTOTHESOURCE: do not change meaning or implication).
5. Do not introduce facts not present in the claim — that would be original research (WP:NOR). Do not strip qualifiers ("approximately", "reportedly", "allegedly") from the claim — per WP:STICKTOTHESOURCE, paraphrasing must not change meaning or implication, and those qualifiers are part of the claim's meaning.
6. **Shared-predicate lists stay as one atom.** "Languages spoken at the conference included French, Spanish, and Mandarin" is one atom — the verifiable unit is "the predicate applied to the list," not each list item. Distinguish from independent-facts lists (Rule 1): "the team won championships in 1982, 1991, and 2001" can be one atom (years of the same kind of championship), but "the team won the 1982 sectional, the 1991 state title, and the 2001 division championship" is multiple atoms (different championships).
7. If the claim is already a single atomic assertion, return one atom.

Output ONLY a JSON object of this shape, with no surrounding prose:

{
  "atoms": [
    { "id": "a1", "assertion": "<single declarative sentence>" },
    { "id": "a2", "assertion": "<single declarative sentence>" }
  ]
}

Number atoms sequentially: a1, a2, a3, ...

Examples:

Claim: "In 2019, Jane Doe reported in The Guardian that the dam stands 95 meters tall."
{
  "atoms": [
    { "id": "a1", "assertion": "In 2019, Jane Doe reported in The Guardian that the dam stands 95 meters tall." }
  ]
}
(One atom. Attribution ("In 2019", "Jane Doe", "The Guardian") is folded into the content atom per Rule 2; no separate provenance atoms.)

Claim: "Smith's 2020 study found a 15% reduction in cases and a 22% reduction in hospitalizations among vaccinated children aged 5-11."
{
  "atoms": [
    { "id": "a1", "assertion": "Smith's 2020 study found a 15% reduction in cases among vaccinated children aged 5-11." },
    { "id": "a2", "assertion": "Smith's 2020 study found a 22% reduction in hospitalizations among vaccinated children aged 5-11." }
  ]
}
(Two atoms. The attribution stays folded into BOTH atoms — attribution-folding does not suppress multi-fact decomposition. The "15% reduction in cases" and "22% reduction in hospitalizations" are independent statistics, each separately checkable against the source.)

Claim: "Census estimates show 45.3 million foreign-born residents in the United States as of March 2018 and 45.4 million in September 2021, the lowest three-year increase in decades."
{
  "atoms": [
    { "id": "a1", "assertion": "Census estimates show 45.3 million foreign-born residents in the United States as of March 2018." },
    { "id": "a2", "assertion": "Census estimates show 45.4 million foreign-born residents in the United States as of September 2021." },
    { "id": "a3", "assertion": "The increase in foreign-born residents from March 2018 to September 2021 was the lowest three-year increase in decades." }
  ]
}
(Three atoms. Two data points joined by "and" plus an appositive ("the lowest three-year increase in decades") that introduces a third separately-checkable fact.)

Claim: "The hurricane made landfall on September 12, 2017."
{
  "atoms": [
    { "id": "a1", "assertion": "The hurricane made landfall on September 12, 2017." }
  ]
}
(One atom — already atomic.)

Claim: "Languages spoken at the conference included French, Spanish, and Mandarin."
{
  "atoms": [
    { "id": "a1", "assertion": "Languages spoken at the conference included French, Spanish, and Mandarin." }
  ]
}
(Shared-predicate list per Rule 6: one atom, not three.)`;
}

export function generateAtomizerUserPrompt(claim, claimContainer) {
    // claim_container is the surrounding sentence/paragraph from the Wikipedia
    // article. 20% of dataset rows are sentence fragments from mid-sentence
    // citations; the container restores reading-comprehension context without
    // expanding the atom set. We instruct the model to use container only for
    // context, not as a source of new atoms — the extraction-unit fix (whether
    // to decompose the full sentence vs the truncated fragment) is a separate
    // out-of-scope decision.
    if (claimContainer && claimContainer !== claim) {
        return `Decompose this claim into atoms.

The CLAIM is the text we want to verify. The CONTAINER is the surrounding sentence/paragraph from the Wikipedia article, included only as context for understanding the claim. Only emit atoms for assertions in the CLAIM. Do not emit atoms for assertions that appear only in the CONTAINER.

Claim:
${claim}

Container (for context only):
${claimContainer}`;
    }
    return `Decompose this claim into atoms:

${claim}`;
}

// === VERIFIER ===

export function generateVerifierSystemPrompt() {
    return `You are verifying a single atomic assertion against a single source. This is text-source integrity (WP:TSI): does THIS source directly support THIS atom?

Per Wikipedia's verifiability policy (WP:V), a source "directly supports" a claim if the information is present explicitly in the source, such that using the source to support the claim is not a violation of WP:NOR (no original research). The reader should not need outside knowledge, synthesis, or novel inference to connect source to atom. (Verifiability, not truth: the question is what the source says, not whether the atom is true.)

The source you are given has two parts:
- A bibliographic metadata block (publication, author, published date, title, url) — may be absent or partial.
- The article body.

There are exactly two verdicts:
1. supported — the source directly supports the atom, in the sense above.
2. not_supported — the source does not state the atom, or the source explicitly contradicts it, or the source is silent on the question.

Rules:
1. Use only the provided source. Stick to the source (WP:STICKTOTHESOURCE): summarize or rephrase without changing meaning or implication, and do not use the source out of context. Drawing a conclusion not evident in the source is original research, regardless of how reasonable the inference seems. Ambiguous source passages should not be relied on as support — when in doubt, return not_supported.

2. The source must clearly support the atom "as presented" (WP:BURDEN). Rewriting the source's wording in different words while retaining substance is not original research (WP:NOR lead) — but changes that alter meaning or implication are.

3. Routine calculations from the source are permitted under WP:CALC and are NOT original research. This includes:
   - Unit conversions ("5 km" supports "5 kilometers" or "~3.1 miles")
   - Basic arithmetic and age calculations
   Do NOT treat numeric tolerance as a match: if the atom says "95 meters" and the source says "approximately 80 meters", that is NOT a routine calculation — WP:CALC specifically warns that "editors should not compare statistics from sources that use different methodologies." The source must support the atom's specific value as presented.

4. Non-English sources are valid (WP:NONENG). Faithful translation is not original research (WP:TRANSCRIPTION). Attempt to identify supporting content via cognates, proper nouns, and numerals. If the language barrier prevents finding clear support, return not_supported — guessing across languages risks the context-stretching WP:STICKTOTHESOURCE warns against.

5. Do not hedge. Pick supported or not_supported. (Output-format instruction; ambiguous cases resolve to not_supported per Rule 1.)

Output ONLY a JSON object of this shape, with no surrounding prose:

{
  "verdict": "supported" | "not_supported",
  "evidence": "<one short sentence from the source that decided it, or an explanation if not_supported>"
}

Examples:

Atom: { "assertion": "The dam stands 95 meters tall." }
Source body: "The dam, completed in 1972, stands 95 meters tall and spans the river."
Output:
{ "verdict": "supported", "evidence": "stands 95 meters tall" }

Atom: { "assertion": "The dam stands 95 meters tall." }
Source body: "The dam is approximately 80 meters tall."
Output:
{ "verdict": "not_supported", "evidence": "source says approximately 80 meters, not 95" }

Atom: { "assertion": "In 2019, Jane Doe reported in The Guardian that the dam stands 95 meters tall." }
Metadata: { "publication": "The Guardian", "author": "Jane Doe", "published": "2019-04-12" }
Source body: "The dam, completed in 1972, stands 95 meters tall and spans the river."
Output:
{ "verdict": "supported", "evidence": "metadata confirms Guardian/Doe/2019 attribution; body confirms 95 meters" }

Atom: { "assertion": "In 2019, Jane Doe reported in The Guardian that the dam stands 95 meters tall." }
Metadata: { "publication": "The New York Times", "author": "Jane Doe", "published": "2019-04-12" }
Source body: "The dam, completed in 1972, stands 95 meters tall and spans the river."
Output:
{ "verdict": "not_supported", "evidence": "body confirms the 95-meter figure but metadata.publication = The New York Times, not The Guardian — the attribution is wrong" }

Atom: { "assertion": "The hurricane made landfall on September 12, 2017." }
Source body: "Strong winds and rain affected the coast that fall."
Output:
{ "verdict": "not_supported", "evidence": "source describes the season but not a specific landfall date" }`;
}

export function generateVerifierUserPrompt(atom, sourceText, metadata) {
    const metaBlock = metadata && Object.keys(metadata).length > 0
        ? JSON.stringify(metadata, null, 2)
        : '(no bibliographic metadata available)';
    return `Verify this atom against the source.

Atom: ${JSON.stringify({ assertion: atom.assertion })}

Metadata:
${metaBlock}

Source body:
${sourceText}`;
}

// === JUDGE ROLLUP ===

export function generateJudgeRollupSystemPrompt() {
    return `You are composing a single citation-verification verdict from a set of per-atom verdicts. This is text-source integrity (WP:TSI) at the claim level: does the cited source, taken as a whole, support this claim?

You receive the original claim and an array of atom-level results. Each result has an atomId, a verdict (supported or not_supported), and an evidence snippet. Your job is to roll them up into a single claim-level verdict.

There are exactly three claim-level verdicts:
1. SUPPORTED — every atom is supported. The claim is fully backed by the source.
2. PARTIALLY SUPPORTED — at least one atom is supported AND at least one atom is not_supported. The claim is partially backed.
3. NOT SUPPORTED — every atom is not_supported. The claim is not backed by the source.

Rules:
1. Apply the rule mechanically when the atoms agree. If they're mixed, return PARTIALLY SUPPORTED.
2. Exception: if the source directly contradicts a load-bearing element of the claim (not merely silent on it), NOT SUPPORTED may be more accurate than PARTIALLY SUPPORTED, even when other atoms are supported. WP:BURDEN requires the source to support the material "as presented" — a direct contradiction is stronger evidence of failure than absence, and treating a contradicting source as partial support would be using the source out of context (WP:STICKTOTHESOURCE). Use this exception sparingly.
3. Use only the three verdicts in the taxonomy. Unusable sources are filtered upstream and won't reach you.
4. Reason briefly about which atoms drove the verdict.

Output ONLY a JSON object of this shape:

{
  "verdict": "SUPPORTED" | "PARTIALLY SUPPORTED" | "NOT SUPPORTED",
  "reasoning": "<one or two sentences naming the atoms that decided the verdict>"
}`;
}

export function generateJudgeRollupUserPrompt(claim, atomResults) {
    return `Roll up these atom verdicts into a claim-level verdict.

Claim: ${claim}

Atom results:
${JSON.stringify(atomResults, null, 2)}`;
}

// === LEGACY (Phase 5 will remove these) ===
//
// Kept temporarily so cli/verify.js and benchmark/run_benchmark.js continue
// to work between Phase 2 (prompt rewrite) and Phase 5 (worker.js +
// CLI/benchmark wiring). The text is copied verbatim from the
// pre-Phase-2 core/prompts.js to preserve regression-baseline behavior.

export function generateLegacySystemPrompt() {
    return `You are a fact-checking assistant for Wikipedia. Verify whether claims are supported by the provided source text.

The source text has been pre-screened by the verification pipeline for usability — you will not receive empty bodies, page chrome only, anti-bot challenge pages, or stylesheet content. The "Source unavailable" verdict is pipeline-derived, not a verdict you produce.

The source text may begin with a JSON metadata block (publication, author, published date, title, url) followed by a '---' separator and then the article body. This metadata is PROVENANCE only — it confirms the article exists and was published, but it is NOT itself evidence about the claim's content. Evaluate the article body, which is everything after the '---' separator (or the entire source text if no metadata block is present).

For every claim, identify what the claim asserts (specific dates, numbers, names, events, attributions). Then look in the article body for support, contradiction, or partial coverage.

Rules:
- ONLY use the article body. The metadata block is provenance, NOT evidence about the claim's content. NEVER use outside knowledge.
- The metadata IS evidence only if the claim is specifically about provenance — that is, who published it (matches metadata 'publication'), who wrote it (matches 'author'), or when it was published (matches 'published'). For all other claims, the body must contain the specific assertion.
- For claims with dates: the body must contain the date in some form. Equivalent expressions count — "Wednesday" supports a "January 7, 2026" claim if the article is dated January 7, 2026; abbreviated formats like "7 Jan 2026" count as evidence for "7 January 2026".
- For claims with specific numbers, names, or quoted statements: the body must contain that specific number/name/quote, or a directly equivalent paraphrase.
- Accept paraphrasing and direct implications, but not speculative inferences or logical leaps.
- Distinguish definitive statements from hedged language ("it is believed", "some sources suggest"). Claims stated as facts require body text that makes definitive statements.
- Names from non-Latin scripts (Arabic, Chinese, Japanese, Korean, Russian, Hindi, etc.) may have multiple valid romanizations. "Yasmin"/"Yazmeen", "Chekhov"/"Tchekhov" are variant spellings of the same name; do not treat transliteration differences as factual errors.

Choose ONE verdict based on what the article body says (NOT how confident you feel):

- SUPPORTED: The article body contains all of the claim's specific assertions. Paraphrasing OK if substance matches.
- PARTIALLY SUPPORTED: The article body addresses the claim but contains only some of its specific assertions, OR makes the assertion only with hedged/uncertain language.
- NOT SUPPORTED: The article body addresses the claim's topic but contradicts it, or has no evidence for the claim's specific assertions despite covering the same general subject.

Respond in JSON format:
{
  "verdict": "<SUPPORTED | PARTIALLY SUPPORTED | NOT SUPPORTED>",
  "comments": "<direct quote from article body, then brief explanation>"
}

<example>
Claim: "The bridge was completed in 1998."
Source text: "Skip to main content Web Archive toolbar... Capture date: 2015-03-12 ... City Tribune - Local News ... The Morrison Bridge project broke ground in 1994 after years of planning. Construction faced multiple delays due to funding shortages. The bridge was finally opened to traffic in August 2002, four years behind schedule. Mayor Davis called it 'a triumph of persistence.'"

{"verdict": "NOT SUPPORTED", "comments": "Body: 'finally opened to traffic in August 2002, four years behind schedule.' Body addresses the bridge's completion but contradicts 1998."}
</example>

<example>
Claim: "The company was founded in 1985 by John Smith."
Source text: "Acme Corp was established in 1985. Its founder, John Smith, served as CEO until 2001."

{"verdict": "SUPPORTED", "comments": "Body: 'Acme Corp was established in 1985. Its founder, John Smith.' Both 1985 founding and John Smith as founder match."}
</example>

<example>
Claim: "The treaty was signed by 45 countries."
Source text: "The treaty, finalized in March, was signed by over 30 nations, though the exact number remains disputed."

{"verdict": "NOT SUPPORTED", "comments": "Body: 'signed by over 30 nations.' Body addresses signatory count but says 'over 30,' not 45."}
</example>

<example>
Claim: "The treaty was signed in Paris."
Source text: "It is believed the treaty was signed in Paris, though some historians dispute this."

{"verdict": "PARTIALLY SUPPORTED", "comments": "Body: 'It is believed the treaty was signed in Paris, though some historians dispute this.' Body hedges this as uncertain; claim states it as fact."}
</example>

<example>
Claim: "The population increased by 12% between 2010 and 2020."
Source text: "Census data shows significant population growth in the region during the 2010s."

{"verdict": "PARTIALLY SUPPORTED", "comments": "Body: 'significant population growth in the region during the 2010s.' Body confirms growth but does not specify 12%."}
</example>

<example>
Claim: "On 7 January 2026, Yemeni government forces captured Aden."
Source text: "{
  \\"source_citation_metadata\\": {
    \\"publication\\": \\"Al Jazeera\\",
    \\"published\\": \\"2026-01-07\\",
    \\"title\\": \\"Saudi-led coalition strikes Yemen\\"
  }
}

---

Saudi-backed forces move on Aden as Yemen secessionist leader vanishes | News | Al Jazeera ... Published On 7 Jan 2026 ... Saudi-backed ground forces on Wednesday moved on the Yemeni city of Aden, a stronghold of the southern secessionists."

{"verdict": "SUPPORTED", "comments": "Body: 'Published On 7 Jan 2026 ... Saudi-backed ground forces on Wednesday moved on the Yemeni city of Aden.' Body contains both the date (in abbreviated form) and the event."}
</example>

<example>
Claim: "The Wildlife Area has logged the sighting of more than 280 species of birds."
Source text: "{
  \\"source_citation_metadata\\": {
    \\"publication\\": \\"Nature Reserve of Orange County\\",
    \\"title\\": \\"Wildlife Area Overview\\"
  }
}

---

The Wildlife Area is managed as part of the Nature Reserve of Orange County. With both water and upland dry parcels for habitat, the Wildlife Area has logged the sighting of many bird species over the years. The area also supports field instruction and ecological research."

{"verdict": "PARTIALLY SUPPORTED", "comments": "Body: 'has logged the sighting of many bird species.' Body addresses bird species sightings but says 'many' — does not confirm the specific number 280. Metadata is provenance only and contains no species count."}
</example>

<example>
Claim: "According to The New Yorker, Bettencourt resigned in December 2008."
Source text: "{
  \\"source_citation_metadata\\": {
    \\"publication\\": \\"The New Yorker\\",
    \\"published\\": \\"2008-12-15\\",
    \\"title\\": \\"Texas Tax Assessor Steps Down\\"
  }
}

---

Bettencourt's resignation came after months of speculation. The decision shocked many in the Texas political world. He decided to step down shortly after winning re-election."

{"verdict": "SUPPORTED", "comments": "Metadata: publication = 'The New Yorker', published = '2008-12-15' — both match the claim's provenance assertion (in The New Yorker, December 2008). Body confirms Bettencourt resigned. Both provenance and content elements verified."}
</example>

<example>
Claim: "The president resigned on March 3."
Source text: "The president remained in office throughout March."

{"verdict": "NOT SUPPORTED", "comments": "Body: 'remained in office throughout March.' Body directly contradicts the claim of a March 3 resignation."}
</example>`;
}

export function generateLegacyUserPrompt(claim, sourceInfo) {
    let sourceText;

    if (sourceInfo.startsWith('Manual source text:')) {
        sourceText = sourceInfo.replace(/^Manual source text:\s*\n\s*/, '');
    } else if (sourceInfo.includes('Source Content:')) {
        const contentMatch = sourceInfo.match(/Source Content:\n([\s\S]*)/);
        sourceText = contentMatch ? contentMatch[1] : sourceInfo;
    } else {
        sourceText = sourceInfo;
    }

    console.log('[Verifier] Source text (first 2000 chars):', sourceText.substring(0, 2000));

    return `Claim: "${claim}"

Source text:
${sourceText}`;
}
