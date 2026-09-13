#!/usr/bin/env node
// One-shot patcher: runs core/body-classifier.js against each row's existing
// source_text and marks rows as extraction_status='body_unusable' (with
// body_unusable_reason) where the classifier rejects them. Local-only
// experimental fixture for cell C of the PR 203 follow-up A-vs-C comparison.
//
// Idempotent: rows already marked body_unusable are skipped; rows whose
// classifier verdict is "usable" are left at extraction_status='complete'.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyBody } from '../core/body-classifier.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASET_PATH = path.join(__dirname, 'dataset.json');

const ds = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));
const rows = ds.rows || ds;

let flagged = 0;
const byReason = {};
for (const r of rows) {
  if (r.extraction_status === 'body_unusable') continue;
  if (r.extraction_status !== 'complete' || !r.source_text) continue;
  const c = classifyBody(r.source_text);
  if (!c.usable) {
    r.extraction_status = 'body_unusable';
    r.body_unusable_reason = c.reason;
    flagged++;
    byReason[c.reason] = (byReason[c.reason] || 0) + 1;
    console.log(`  flagged ${r.id} → ${c.reason}`);
  }
}

fs.writeFileSync(DATASET_PATH, JSON.stringify(ds, null, 2) + '\n');
console.log(`\nPatched ${flagged} rows in dataset.json:`, byReason);
