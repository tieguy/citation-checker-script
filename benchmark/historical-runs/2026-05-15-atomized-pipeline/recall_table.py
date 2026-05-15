"""Reproduces the recall + editor-FP table in the design plan's Results section.

Usage: python3 recall_table.py
Inputs read from this directory: results-control-legacy-singlecall.json + results-treatment-atomized.json
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def load(p):
    r = json.load(open(p))
    return r.get('rows', r) if isinstance(r, dict) else r


def norm(v):
    if not v:
        return 'Unknown'
    s = str(v).strip().lower()
    if s == 'supported':
        return 'Supported'
    if s == 'partially supported':
        return 'Partially supported'
    if s == 'not supported':
        return 'Not supported'
    if s == 'source unavailable':
        return 'Source unavailable'
    return 'Unknown'


ctl_rows = load(os.path.join(HERE, 'results-control-legacy-singlecall.json'))
trt_rows = load(os.path.join(HERE, 'results-treatment-atomized.json'))
ctl = {(r['provider'], r['entry_id']): r for r in ctl_rows}
trt = {(r['provider'], r['entry_id']): r for r in trt_rows}

provs = sorted(set(p for p, _ in trt.keys()))
print('| Provider | n | gt_pos | Recall control → treatment | Δ recall | gt_neg | Editor-FP control → treatment | Δ FP |')
print('|---|---:|---:|---:|---:|---:|---:|---:|')
for p in provs:
    cell_ids = [eid for (pr, eid) in trt.keys() if pr == p and (pr, eid) in ctl]
    gt_pos = ctl_caught = trt_caught = gt_neg = ctl_efp = trt_efp = 0
    for eid in cell_ids:
        cr, tr = ctl[(p, eid)], trt[(p, eid)]
        if cr.get('error') or tr.get('error'):
            continue
        gt = norm(cr.get('ground_truth'))
        cv = norm(cr.get('predicted_verdict'))
        tv = norm(tr.get('predicted_verdict'))
        if gt in ('Not supported', 'Partially supported'):
            gt_pos += 1
            if cv in ('Not supported', 'Partially supported'):
                ctl_caught += 1
            if tv in ('Not supported', 'Partially supported'):
                trt_caught += 1
        if gt == 'Not supported':
            gt_neg += 1
            if cv in ('Supported', 'Partially supported'):
                ctl_efp += 1
            if tv in ('Supported', 'Partially supported'):
                trt_efp += 1
    if not gt_pos:
        continue
    cr_pct = ctl_caught / gt_pos * 100
    tr_pct = trt_caught / gt_pos * 100
    ce_pct = ctl_efp / gt_neg * 100 if gt_neg else 0
    te_pct = trt_efp / gt_neg * 100 if gt_neg else 0
    print(f'| `{p}` | {len(cell_ids)} | {gt_pos} | {ctl_caught} ({cr_pct:.1f}%) → {trt_caught} ({tr_pct:.1f}%) | **{tr_pct-cr_pct:+.1f}** | {gt_neg} | {ctl_efp} ({ce_pct:.1f}%) → {trt_efp} ({te_pct:.1f}%) | {te_pct-ce_pct:+.1f} |')
