#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { loadRows } from './io.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// loadRows handles both legacy [...rows] and new {metadata, rows} shapes.
const results = loadRows(path.join(__dirname, 'results.json'));

// Group by entry_id
const byEntry = {};
results.forEach(r => {
    if (!byEntry[r.entry_id]) {
        byEntry[r.entry_id] = { ground_truth: r.ground_truth };
    }
    byEntry[r.entry_id][r.provider] = r.predicted_verdict;
});

// Get all providers from results
const allProviders = [...new Set(results.map(r => r.provider))].sort();

// Create CSV
const headers = ['entry_id', 'ground_truth', ...allProviders];
const rows = [headers.join(',')];

Object.keys(byEntry).sort().forEach(id => {
    const entry = byEntry[id];
    const row = [
        id,
        entry.ground_truth,
        ...allProviders.map(p => entry[p] || '')
    ];
    rows.push(row.map(v => '"' + v + '"').join(','));
});

const outputPath = path.join(__dirname, 'results_comparison.csv');
fs.writeFileSync(outputPath, rows.join('\n'));
console.log(`Saved to ${outputPath}`);
