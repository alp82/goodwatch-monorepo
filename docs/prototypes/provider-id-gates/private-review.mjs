// No network. Private data stays outside Git. A one-character review is an owner
// attestation of the independent check described at the top of the packet.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
const [mode, ...args] = process.argv.slice(2);
const read = async p => JSON.parse(await readFile(p, 'utf8'));
const instructions = [
  'PRIVATE: never commit or paste this packet. About 30 minutes for 77 rows.',
  'Check each source work against its displayed historical proposal using independent provider/work evidence; do not use the same stored streaming link as proof.',
  'Change only review: c=correct proposal, w=wrong proposal, a=ambiguous, ?=unknown, -=not reviewed. For either row with no proposal use n=confirmed manual/absent, a or ?. No extra fields are required.',
  'c attests you independently checked the same underlying movie/show. Do not guess c from a similar name. w records a known error. Optional notes/referenceTarget may explain exceptions.',
  'After all 77 rows: node docs/prototypes/provider-id-gates/private-review.mjs aggregate "$HOME/goodwatch-private/709/review.json"',
  'These are historical proposals, not a new reader run. If they differ from the final reader, preserve that distinction.',
];
const wilson = (x,n) => {
  if (!n) return null;
  const z=1.95996398454, d=1+z*z/n, c=(x/n+z*z/(2*n))/d;
  const h=z*Math.sqrt(x/n*(1-x/n)/n+z*z/(4*n*n))/d;
  return [c-h,c+h];
};
async function privatePath(path) {
  const privateRoot = await realpath(resolve(process.env.HOME, 'goodwatch-private'));
  await mkdir(dirname(resolve(path)), {recursive:true,mode:0o700});
  assert.ok((await realpath(dirname(resolve(path)))).startsWith(`${privateRoot}/`), 'Packet must be under ~/goodwatch-private/<ticket>/');
}
const codes = {'-':'unreviewed',c:'correct',w:'wrong',a:'ambiguous',n:'absent','?':'unknown'};
if (mode === 'prepare') {
  const [capturePath, proposalsPath, outputPath] = args;
  assert.ok(capturePath && proposalsPath && outputPath, 'prepare CAPTURE PROPOSALS OUTPUT');
  await privatePath(outputPath);
  const capture = await read(capturePath), proposals = await read(proposalsPath);
  assert.equal(capture.items.length,77); assert.equal(proposals.matches.length,75);
  const matches = new Map(proposals.matches);
  const entries = capture.items.map((item,index) => {
    const identity = matches.get(item.sourceId) ?? null;
    const target = proposals.catalog.find(r => `${r.mediaType}:${r.tmdb_id}` === identity) ?? null;
    assert.ok(!identity || target);
    return { index, source: { title:item.title, sourceId:item.sourceId, year:item.year ?? null },
      historicalProposal: target, review:'-' };
  });
  await writeFile(outputPath, `${JSON.stringify({instructions, entries},null,2)}\n`, {mode:0o600,flag:'wx'});
  console.log('Private review packet prepared: 77 rows, 75 historical proposals, 2 manual. No private values printed.');
} else if (mode === 'upgrade') {
  const [packetPath] = args; assert.ok(packetPath); await privatePath(packetPath);
  const packet = await read(packetPath); assert.equal(packet.entries.length,77);
  // Never discard owner edits. Keep full-word decisions, exceptions and notes.
  for (const entry of packet.entries) if (entry.review === 'unreviewed') {
    entry.review='-';
    if (entry.referenceTarget === null) delete entry.referenceTarget;
    if (entry.independentEvidence === null) delete entry.independentEvidence;
  }
  packet.instructions=instructions;
  await writeFile(packetPath, JSON.stringify(packet,null,2)+'\n', {mode:0o600});
  console.log('Private packet instructions upgraded; existing decisions preserved.');
} else if (mode === 'aggregate') {
  const [packetPath] = args; assert.ok(packetPath);
  const {entries} = await read(packetPath); assert.equal(entries.length,77);
  const normalized = entries.map(e => ({...e,review:codes[e.review] ?? e.review}));
  for (const e of normalized) {
    assert.ok(['unreviewed','correct','wrong','ambiguous','absent','unknown'].includes(e.review));
    if (e.review === 'correct' || e.review === 'wrong') {
      assert.ok(e.historicalProposal, 'Use n/a/? for a manual row');
      if (e.referenceTarget) {
        const proposed = `${e.historicalProposal.mediaType}:${e.historicalProposal.tmdb_id}`;
        assert.equal(proposed === e.referenceTarget, e.review === 'correct');
      }
    }
    if (e.review === 'absent') assert.equal(e.historicalProposal,null,'Use w if a proposed target is wrong, a/? if uncertain');
  }
  const proposed = normalized.filter(e=>e.historicalProposal), reviewed = proposed.filter(e=>['correct','wrong'].includes(e.review));
  const correct = reviewed.filter(e=>e.review==='correct').length;
  const completed = normalized.filter(e=>e.review!=='unreviewed').length;
  console.log(JSON.stringify({allGroups:77, completedRows:completed, historicalProposals:75,
    independentlyReviewedProposals:reviewed.length, correct, wrong:reviewed.length-correct,
    unresolvedProposalReviews:75-reviewed.length, unknownOrAmbiguousRows:normalized.filter(e=>['unknown','ambiguous'].includes(e.review)).length,
    precisionReviewedOnly:{numerator:correct,denominator:reviewed.length,wilson95:wilson(correct,reviewed.length)},
    precisionAllProposalBounds:[correct/75,(correct+75-reviewed.length)/75],
    coverageCorrectBounds:[correct/77,(correct+75-reviewed.length)/77],
    memberReviewedGate:completed===77 && reviewed.length>=75 && correct===reviewed.length && wilson(correct,reviewed.length)[0]>.95 && 2/77<=.10,
    note:'c/w are owner attestations of an independent check; unknown/ambiguous cannot satisfy the 75 reviewed-proposal gate. Historical manual abstention is 2/77; capture completeness and final-reader equivalence remain separate.'},null,2));
} else throw new Error('Use prepare CAPTURE PROPOSALS OUTPUT, upgrade PACKET, or aggregate PACKET');
