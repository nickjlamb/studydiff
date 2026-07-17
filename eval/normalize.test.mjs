// `npm run eval:normtest` — prove the Phase 2 grounding fixes are LOSSLESS.
//
// Every fix in src/normalize.mjs is meant to make two spellings of the SAME
// characters comparable, never to make a claim easier to assert. This file is the
// evidence for that. It pins, as executable tests:
//
//   - the false positives the fixes MUST recover
//   - the true catches the fixes MUST STILL reject (from the Phase 2 audit)
//   - the guards that stop ellipsis-joining becoming a fabrication licence
//
// If a later change to grounding breaks a true catch, this fails loudly. That is
// the point: the trust layer should be hard to loosen by accident.

import { decodeEntities, normalizeText, spelledNumberVariants, separatorVariants, groundingContext } from '../src/normalize.mjs';
import { groundField, containsAllowingEllipsis } from '../src/grounding.mjs';

let failures = 0;
const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;
const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;

const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ${GREEN('ok')}   ${name}`);
  else { failures++; console.log(`  ${RED('FAIL')} ${name}${detail ? DIM(`  — ${detail}`) : ''}`); }
};
const field = (value, quote) => ({ value, quote });

// --- 1. Entity decoding (10 of 26 measured false positives) ------------------
console.log('\n' + BOLD('  Entity decoding — the largest FP cause'));
check('&#xa0; -> space', decodeEntities('2&#xa0;h') === '2 h');
check('&#x2265; -> >=', decodeEntities('&#x2265;30 days').startsWith('≥'));
check('&gt; -> >', decodeEntities('&gt; or =400') === '> or =400');
check('&#xd7; -> times', decodeEntities('6.5&#xd7;10') === '6.5×10');
check('&#xf2; -> o-grave', decodeEntities('Munaf&#xf2;') === 'Munafò');
check('normalizeText folds nbsp to plain space', normalizeText('2&#xa0;h post infection') === '2 h post infection');
check('unknown entity left alone (no silent corruption)', decodeEntities('&notreal;') === '&notreal;');

// The real ivermectin case: source encoded, model quoted decoded.
{
  const source = 'Ivermectin added 2&#xa0;h post infection with SARS-CoV-2 able to effect ~5000-fold reduction in viral RNA at 48&#xa0;h.';
  const f = field('Added 2h post-infection; measured at 48h', '2 h post infection with SARS-CoV-2 able to effect ~5000-fold reduction in viral RNA at 48 h');
  check('ivermectin quote now grounds (was a FP, killed 5/6 fields)', groundField(f, source).grounded);
}

// --- 2. Spelled-out numbers (6 FPs — including my own published error) -------
console.log('\n' + BOLD('  Spelled-out numbers'));
check('"Ninety-seven percent" yields 97', spelledNumberVariants('Ninety-seven percent of original studies').split(' ').includes('97'));
check('"Thirty-six percent" yields 36', spelledNumberVariants('Thirty-six percent of replications').split(' ').includes('36'));
check('"three psychology journals" yields 3', spelledNumberVariants('published in three psychology journals').split(' ').includes('3'));
check('"Eight randomised controlled trials" yields 8', spelledNumberVariants('Eight randomised controlled trials (n=2426)').split(' ').includes('8'));

// The adjacency guard: bare articles must NOT become the numeral 1.
check('GUARD: "a single addition" does not yield 1',
  !spelledNumberVariants('a single addition to Vero cells').split(' ').includes('1'));
check('GUARD: "one of the reasons" does not yield 1',
  !spelledNumberVariants('one of the reasons for this').split(' ').includes('1'));
check('but "one or two copies of the short allele" does yield 1 (real quantity)',
  spelledNumberVariants('individuals with one or two copies of the short allele').split(' ').includes('1'));

// The OSC case — the false positive I published as a "true catch".
{
  const source = 'We conducted replications of 100 experimental and correlational studies published in three psychology journals. Ninety-seven percent of original studies had statistically significant results. Thirty-six percent of replications had statistically significant results; 47% of original effect sizes were in the 95% confidence interval of the replication effect size.';
  const f = field('36% of replications significant vs 97% of originals; 47% originals within replication CI',
    'Thirty-six percent of replications had statistically significant results; 47% of original effect sizes');
  check('OSC statistic now grounds (was my flagship "true catch" — it was a FP)', groundField(f, source).grounded);
}

// --- 3. Separators -----------------------------------------------------------
console.log('\n' + BOLD('  Thousands separators'));
check('"35,533" yields 35533', separatorVariants('35,533 men').split(' ').includes('35533'));
check('"16608" yields 16,608', separatorVariants('16608 postmenopausal women').split(' ').includes('16,608'));
check('GUARD: decimals untouched — 16.608 must never become 16608',
  !separatorVariants('a value of 16.608 units').split(' ').includes('16608'));

// --- 4. Ellipsis, and its guards (4 FPs) ------------------------------------
console.log('\n' + BOLD('  Ellipsis joining — guarded'));
{
  const src = 'In this study the potent activator resveratrol, a polyphenol found in red wine, lowers the Michaelis constant of SIRT1 for both the acetylated substrate and NAD+.';
  check('honest 2-fragment quote joins',
    containsAllowingEllipsis(src, 'the potent activator resveratrol, a polyphenol ... lowers the Michaelis constant of SIRT1'));
  check('GUARD: out-of-order fragments rejected',
    !containsAllowingEllipsis(src, 'lowers the Michaelis constant of SIRT1 ... the potent activator resveratrol, a polyphenol'));
  check('GUARD: absent fragment rejected',
    !containsAllowingEllipsis(src, 'the potent activator resveratrol, a polyphenol ... cures every disease known to man'));
  check('GUARD: tiny fragments rejected (would match anything)',
    !containsAllowingEllipsis(src, 'the ... of ... and'));
}
{
  // Fragments dredged from opposite ends of a long document must not stitch.
  const far = 'Resveratrol activates SIRT1 in vitro. ' + 'X'.repeat(600) + ' Yeast lifespan was extended by 70%.';
  check('GUARD: distant fragments rejected (maxGap) — the fabrication licence',
    !containsAllowingEllipsis(far, 'Resveratrol activates SIRT1 in vitro ... Yeast lifespan was extended by 70%'));
}

// --- 5. THE TRUE CATCHES MUST STILL FAIL ------------------------------------
// These are the two real fabrications the Phase 2 audit found. If a future change
// makes either of these pass, grounding has been broken and this test says so.
console.log('\n' + BOLD('  True catches must STILL be rejected') + DIM('  (the whole point of the trust layer)'));
{
  // Lippman: the model divided 35,533 by 4 and invented "per group".
  const source = 'A total of 35,533 men from 427 study sites in the United States, Canada, and Puerto Rico were randomized. Participants were assigned to one of four groups.';
  const f = field('35,533 men total, ~8800 per group', 'A total of 35,533 men from 427 study sites');
  check('TRUE CATCH 1: Lippman "~8800 per group" still rejected', !groundField(f, source).grounded,
    'fabricated per-group N would now pass — grounding is broken');
}
{
  // Border: "5-HTTLPR" imported from the eval's own question text.
  const source = 'We failed to identify any associations between 18 candidate genes and depression phenotypes. No clear evidence was found for any candidate gene polymorphism associations with depression phenotypes.';
  const f = field('No evidence 5-HTTLPR moderates stress effect on depression risk', 'No clear evidence was found for any candidate gene polymorphism associations with depression phenotypes');
  check('TRUE CATCH 2: Border imported "5-HTTLPR" still rejected', !groundField(f, source).grounded,
    'an identifier absent from the source would now pass — grounding is broken');
}
{
  // A genuinely fabricated statistic — the demo's canonical case.
  const source = 'Treatment reduced inflammation in the treated group compared with controls.';
  const f = field('Treatment worked with an effect size of 0.85', 'Treatment reduced inflammation in the treated group');
  check('fabricated effect size 0.85 still rejected', !groundField(f, source).grounded);
}
{
  // Numbers must not leak across spellings in the wrong direction: a value may not
  // assert a figure merely because a DIFFERENT number is spelled out nearby.
  const source = 'Ninety-seven percent of original studies had statistically significant results.';
  const f = field('Fifty-two percent replicated, i.e. 52%', 'Ninety-seven percent of original studies');
  check('unrelated number 52 still rejected despite spelled-number expansion', !groundField(f, source).grounded);
}

// --- 6. The known FALSE NEGATIVE is unchanged (not made worse) --------------
console.log('\n' + BOLD('  Known false negative — must not get worse'));
{
  // Berry: "unlikely to affect" -> "does not affect". Grounding CANNOT catch this
  // (no numbers, real quote). It passed before these fixes and it passes after —
  // the fixes neither help nor hurt. Pinned so the FN rate stays honest, and so
  // nobody later claims this class is handled.
  const source = 'Vitamin E intake is unlikely to affect mortality regardless of dose.';
  const f = field('Vitamin E does not affect mortality regardless of dose', 'Vitamin E intake is unlikely to affect mortality regardless of dose.');
  check('Berry hedge-drop STILL passes (documented FN, structurally uncatchable here)', groundField(f, source).grounded);
  console.log(DIM('       ^ needs entailment of value from quote, not substring matching. Out of scope.'));
}

console.log('');
if (failures) { console.log(RED(`  ${failures} check(s) failed.\n`)); process.exit(1); }
console.log(GREEN('  all checks passed') + DIM(' — fixes recover FPs; both true catches still rejected\n'));
