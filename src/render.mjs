// Terminal rendering. Kept dependency-free; the web UI will consume the same
// pipeline result object, this is just the day-one surface.

import { DIMENSION_LABELS, NOT_REPORTED } from './types.mjs';

const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;
const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`;

const wrap = (s, w) => {
  const words = String(s).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > w) {
      lines.push(line.trim());
      line = word;
    } else line += ' ' + word;
  }
  if (line.trim()) lines.push(line.trim());
  return lines.length ? lines : [''];
};

const badge = (grounded) => (grounded ? GREEN('✓ grounded') : RED('✗ unverified'));

export function renderResult(result) {
  const { question, cards, comparison, gaps, grounding, synthesis } = result;
  const [a, b] = cards;
  const out = [];

  out.push('');
  out.push(BOLD('  StudyDiff — why these papers disagree'));
  out.push(DIM(`  Question: ${question}`));
  out.push('');
  out.push(`  A  ${BOLD(a.citation)}  ${DIM('[' + a.sourceDepth + ']')}`);
  out.push(`  B  ${BOLD(b.citation)}  ${DIM('[' + b.sourceDepth + ']')}`);
  out.push('');

  // Comparison matrix
  out.push(BOLD('  Comparison'));
  const W = 34;
  for (const row of comparison.rows) {
    const mark = row.diverges ? YELLOW('▲') : row.comparable ? DIM('=') : DIM(' ');
    const la = wrap(row.a, W);
    const lb = wrap(row.b, W);
    const n = Math.max(la.length, lb.length);
    for (let i = 0; i < n; i++) {
      const label = i === 0 ? row.label.padEnd(16) : ''.padEnd(16);
      const m = i === 0 ? mark : ' ';
      const ca = (la[i] || '').padEnd(W);
      const cb = lb[i] || '';
      const color = row.diverges ? YELLOW : (s) => s;
      out.push(`  ${m} ${DIM(label)} ${color(ca)}  ${color(cb)}`);
    }
  }
  out.push('');

  // Why they disagree
  out.push(BOLD('  Likely reason for disagreement'));
  for (const line of wrap(synthesis.text, 88)) out.push('  ' + line);
  out.push('');
  if (comparison.candidateReasons.length) {
    out.push(DIM('  Ranked candidate drivers (differing design dimensions):'));
    comparison.candidateReasons.forEach((r, i) => {
      out.push(`    ${i + 1}. ${BOLD(r.label)} — A: ${r.a}  |  B: ${r.b}`);
    });
    out.push('');
  }

  // Grounding
  out.push(BOLD('  Grounding (OpenGATE, deterministic — no LLM judge)'));
  out.push(`  Synthesis: ${badge(synthesis.grounded)}${synthesis.grounded ? '' : '  ' + DIM(synthesis.issues.join('; '))}`);
  for (const [key, g] of [['A', grounding.a], ['B', grounding.b]]) {
    const bad = g.downgraded.filter((d) => d !== 'finding');
    if (bad.length === 0) out.push(`  Card ${key}: ${GREEN('all reported fields grounded')}`);
    else out.push(`  Card ${key}: ${RED('downgraded to “not reported”: ' + bad.map((d) => DIMENSION_LABELS[d]).join(', '))}`);
  }
  out.push('');

  // Bounded gaps
  if (gaps.sharedConstraints.length || gaps.unreported.length) {
    out.push(BOLD('  Observed across these papers') + DIM('  (bounded — not a claim about all literature)'));
    for (const s of gaps.sharedConstraints) for (const l of wrap('• ' + s, 88)) out.push('  ' + l);
    for (const s of gaps.unreported) for (const l of wrap('• ' + s, 88)) out.push('  ' + l);
    out.push('');
  }
  return out.join('\n');
}
