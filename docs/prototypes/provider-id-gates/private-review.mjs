// No network. Private data stays outside every Git worktree. Do not commit outputs.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
const [mode, ...args] = process.argv.slice(2);
const read = async p => JSON.parse(await readFile(p, 'utf8'));
const wilson = (x,n) => {
  if (!n) return null;
  const z=1.95996398454, d=1+z*z/n, c=(x/n+z*z/(2*n))/d;
  const h=z*Math.sqrt(x/n*(1-x/n)/n+z*z/(4*n*n))/d;
  return [c-h,c+h];
};
if (mode === 'prepare') {
  const [capturePath, proposalsPath, outputPath] = args;
  assert.ok(capturePath && proposalsPath && outputPath, 'prepare CAPTURE PROPOSALS OUTPUT');
  const privateRoot = await realpath(resolve(process.env.HOME, 'goodwatch-private'));
  await mkdir(dirname(resolve(outputPath)), { recursive:true, mode:0o700 });
  assert.ok((await realpath(dirname(resolve(outputPath)))).startsWith(`${privateRoot}/`), 'Output must be under ~/goodwatch-private/<ticket>/');
  const capture = await read(capturePath), proposals = await read(proposalsPath);
  assert.equal(capture.items.length,77); assert.equal(proposals.matches.length,75);
  const matches = new Map(proposals.matches);
  const entries = capture.items.map((item,index) => {
    const identity = matches.get(item.sourceId) ?? null;
    const target = proposals.catalog.find(r => `${r.mediaType}:${r.tmdb_id}` === identity) ?? null;
    assert.ok(!identity || target);
    return { index, source: { title:item.title, sourceId:item.sourceId, year:item.year ?? null },
      historicalProposal: target, review: 'unreviewed', referenceTarget: null, independentEvidence: null };
  });
  await writeFile(outputPath, `${JSON.stringify({ warning:'PRIVATE historical proposal review, not a new reader run; never commit', entries },null,2)}\n`, {mode:0o600, flag:'wx'});
  console.log('Private review packet prepared: 77 rows, 75 historical proposals, 2 manual. No private values printed.');
} else if (mode === 'aggregate') {
  const [packetPath] = args; assert.ok(packetPath);
  const {entries} = await read(packetPath); assert.equal(entries.length,77);
  for (const e of entries) {
    assert.ok(['unreviewed','correct','wrong','ambiguous','absent','unknown'].includes(e.review));
    if (e.review === 'correct' || e.review === 'wrong') {
      assert.ok(e.referenceTarget && e.independentEvidence, 'Correct/wrong needs independent evidence and a typed reference target');
      const target = e.historicalProposal;
      const proposed = target ? `${target.mediaType}:${target.tmdb_id}` : null;
      assert.equal(proposed === e.referenceTarget, e.review === 'correct');
    }
  }
  const proposed = entries.filter(e => e.historicalProposal), reviewed = proposed.filter(e => ['correct','wrong'].includes(e.review));
  const correct = reviewed.filter(e => e.review === 'correct').length;
  console.log(JSON.stringify({ allGroups:entries.length, historicalProposals:proposed.length, independentlyReviewedProposals:reviewed.length,
    correct, wrong:reviewed.length-correct, unresolvedProposalReviews:proposed.length-reviewed.length,
    precisionReviewedOnly: { numerator:correct, denominator:reviewed.length, wilson95:wilson(correct,reviewed.length) },
    precisionAllProposalBounds:[correct/proposed.length,(correct+proposed.length-reviewed.length)/proposed.length],
    coverageCorrectBounds:[correct/entries.length,(correct+proposed.length-reviewed.length)/entries.length],
    note:'Partial reviewed subsets can be biased. These bounds are bookkeeping, not population confidence intervals. Manual cases need independent references too.' },null,2));
} else throw new Error('Use prepare CAPTURE PROPOSALS OUTPUT or aggregate PACKET');
