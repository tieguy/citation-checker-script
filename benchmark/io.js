// Shared I/O helpers for benchmark artifacts.
//
// `dataset.json` and `results.json` (and their frozen vN snapshots) are stored
// as either:
//   - Legacy:  a bare JSON array of row objects.
//   - Current: { metadata: {...}, rows: [...] }
//
// The metadata block lets each artifact carry its own date provenance so a
// run's results stay attributable to a prompt-and-dataset version. See
// benchmark/README.md "Reproducibility metadata" for the schema.
//
// loadRows + loadMetadata transparently handle both shapes; writeWithMetadata
// always emits the current shape.

import fs from 'fs';

export function loadRows(filePath) {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(parsed) ? parsed : (parsed.rows || []);
}

export function loadMetadata(filePath) {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(parsed) ? {} : (parsed.metadata || {});
}

export function writeWithMetadata(filePath, metadata, rows) {
    fs.writeFileSync(
        filePath,
        JSON.stringify({ metadata, rows }, null, 2)
    );
}

export function todayIso() {
    return new Date().toISOString().slice(0, 10);
}
