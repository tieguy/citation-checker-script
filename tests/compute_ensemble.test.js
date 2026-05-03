import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVoteRows, PANEL } from '../benchmark/compute_ensemble.js';

// Helper: build a row matching the shape produced by run_benchmark.js.
function row(entry_id, provider, predicted_verdict, ground_truth, opts = {}) {
    return {
        entry_id,
        provider,
        model: provider.replace('openrouter-', ''),
        ground_truth,
        predicted_verdict,
        confidence: 90,
        comments: '',
        latency_ms: opts.latency_ms ?? 1000,
        cost_usd: opts.cost_usd ?? 0.0001,
        prompt_tokens: 100,
        completion_tokens: 50,
        error: null,
        correct: predicted_verdict === ground_truth ? 'exact' : 'wrong',
        timestamp: '2026-05-02T00:00:00Z'
    };
}

// Build a complete 5-voter input for one entry.
function panelRows(entry_id, ground_truth, verdicts, costs = []) {
    return PANEL.map((p, i) => row(entry_id, p, verdicts[i], ground_truth, {
        cost_usd: costs[i] ?? 0.0001
    }));
}

test('buildVoteRows synthesizes one vote-5 and one vote-5-binary row per complete entry', () => {
    const input = panelRows('row_1', 'Supported',
        ['Supported', 'Supported', 'Supported', 'Supported', 'Not supported']);
    const synth = buildVoteRows(input, PANEL);
    assert.equal(synth.length, 2);
    const providers = synth.map(r => r.provider).sort();
    assert.deepEqual(providers, ['openrouter-vote-5', 'openrouter-vote-5-binary']);
});

test('buildVoteRows skips entries where a panel member is missing', () => {
    const input = panelRows('row_1', 'Supported',
        ['Supported', 'Supported', 'Supported', 'Supported', 'Not supported'])
        .slice(0, 4); // drop the qwen-3-32b row
    const synth = buildVoteRows(input, PANEL);
    assert.equal(synth.length, 0);
});

test('buildVoteRows vote-5 4-class picks plurality verdict', () => {
    const input = panelRows('row_1', 'Supported',
        ['Supported', 'Supported', 'Supported', 'Partially supported', 'Not supported']);
    const synth = buildVoteRows(input, PANEL);
    const vote5 = synth.find(r => r.provider === 'openrouter-vote-5');
    assert.equal(vote5.predicted_verdict, 'Supported');
    assert.equal(vote5.correct, 'exact');
});

test('buildVoteRows vote-5 4-class applies tiebreaker on 2-2-1 ties', () => {
    // 2 Supported, 2 Partially, 1 Not — tie between Supported and Partially at count=2.
    // Skeptical rank: Partially > Supported, so Partially wins.
    const input = panelRows('row_1', 'Partially supported',
        ['Supported', 'Supported', 'Partially supported', 'Partially supported', 'Not supported']);
    const synth = buildVoteRows(input, PANEL);
    const vote5 = synth.find(r => r.provider === 'openrouter-vote-5');
    assert.equal(vote5.predicted_verdict, 'Partially supported');
});

test('buildVoteRows vote-5-binary collapses Partially supported into support class', () => {
    // 2 Supported + 1 Partially = 3 in support class; 2 Not supported.
    // 3-of-5 majority → support class wins, surfaced as "Supported".
    const input = panelRows('row_1', 'Supported',
        ['Supported', 'Supported', 'Partially supported', 'Not supported', 'Not supported']);
    const synth = buildVoteRows(input, PANEL);
    const binary = synth.find(r => r.provider === 'openrouter-vote-5-binary');
    assert.equal(binary.predicted_verdict, 'Supported');
});

test('buildVoteRows vote-5-binary returns Not supported when sub-majority in support class', () => {
    // 2 in support class, 3 in not-support class.
    const input = panelRows('row_1', 'Not supported',
        ['Supported', 'Partially supported', 'Not supported', 'Not supported', 'Source unavailable']);
    const synth = buildVoteRows(input, PANEL);
    const binary = synth.find(r => r.provider === 'openrouter-vote-5-binary');
    assert.equal(binary.predicted_verdict, 'Not supported');
});

test('buildVoteRows synthetic row carries ground_truth from input rows', () => {
    const input = panelRows('row_1', 'Partially supported',
        ['Supported', 'Supported', 'Partially supported', 'Partially supported', 'Not supported']);
    const synth = buildVoteRows(input, PANEL);
    for (const r of synth) {
        assert.equal(r.ground_truth, 'Partially supported');
        assert.equal(r.entry_id, 'row_1');
    }
});

test('buildVoteRows synthetic row cost_usd equals sum of panel costs', () => {
    const input = panelRows('row_1', 'Supported',
        ['Supported', 'Supported', 'Supported', 'Supported', 'Supported'],
        [0.0001, 0.0002, 0.0003, 0.0004, 0.0005]);
    const synth = buildVoteRows(input, PANEL);
    const vote5 = synth.find(r => r.provider === 'openrouter-vote-5');
    assert.equal(vote5.cost_usd, 0.0015);
});

test('buildVoteRows correct field is computed against the synthesized verdict', () => {
    // Vote-5 picks Supported (4 votes); ground truth Not supported → wrong.
    const input = panelRows('row_1', 'Not supported',
        ['Supported', 'Supported', 'Supported', 'Supported', 'Not supported']);
    const synth = buildVoteRows(input, PANEL);
    const vote5 = synth.find(r => r.provider === 'openrouter-vote-5');
    assert.equal(vote5.predicted_verdict, 'Supported');
    assert.equal(vote5.correct, 'wrong');
});

test('buildVoteRows ignores prior synthesized rows in its input', () => {
    const realRows = panelRows('row_1', 'Supported',
        ['Supported', 'Supported', 'Supported', 'Supported', 'Supported']);
    const priorVote = row('row_1', 'openrouter-vote-5', 'Not supported', 'Supported');
    const priorBinary = row('row_1', 'openrouter-vote-5-binary', 'Not supported', 'Supported');
    const input = [...realRows, priorVote, priorBinary];
    const synth = buildVoteRows(input, PANEL);
    // Should produce exactly one vote-5 + one vote-5-binary, both reflecting the real-rows consensus.
    assert.equal(synth.length, 2);
    const vote5 = synth.find(r => r.provider === 'openrouter-vote-5');
    assert.equal(vote5.predicted_verdict, 'Supported');
});

test('buildVoteRows handles multiple entries independently', () => {
    const input = [
        ...panelRows('row_1', 'Supported',
            ['Supported', 'Supported', 'Supported', 'Supported', 'Supported']),
        ...panelRows('row_2', 'Not supported',
            ['Not supported', 'Not supported', 'Not supported', 'Not supported', 'Not supported'])
    ];
    const synth = buildVoteRows(input, PANEL);
    assert.equal(synth.length, 4); // 2 vote-5 + 2 vote-5-binary
    const row1Vote = synth.find(r => r.entry_id === 'row_1' && r.provider === 'openrouter-vote-5');
    const row2Vote = synth.find(r => r.entry_id === 'row_2' && r.provider === 'openrouter-vote-5');
    assert.equal(row1Vote.predicted_verdict, 'Supported');
    assert.equal(row2Vote.predicted_verdict, 'Not supported');
});

test('PANEL constant matches the chosen 5-model panel', () => {
    assert.deepEqual(PANEL.sort(), [
        'openrouter-gemma-4-26b-a4b',
        'openrouter-granite-4.1-8b',
        'openrouter-mistral-small-3.2',
        'openrouter-olmo-3.1-32b',
        'openrouter-qwen-3-32b'
    ]);
});
