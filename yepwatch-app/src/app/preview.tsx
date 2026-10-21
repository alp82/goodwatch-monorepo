import { useState } from 'react';
import type { RoomPhase } from '@goodwatch/yepwatch-contracts';
import { Button, Heading, Notice, Page, Row, Words } from '../components/ui';
import { fixturesEnabled } from '../core/config';
import { fixtureSnapshot } from '../dev/fixtures';
import { Participants, Setup } from '../features/Lobby';
import { Voting } from '../features/Voting';
import { Shortlist } from '../features/Shortlist';
import { Decision } from '../features/Decision';
export default function Preview() {
  const [phase, setPhase] = useState<RoomPhase>('setup'); const [message, setMessage] = useState('');
  if (!fixturesEnabled) return <Page><Heading>Preview disabled</Heading><Words>Use a real room invitation to participate.</Words></Page>;
  const snapshot = fixtureSnapshot(); snapshot.shared.phase = phase;
  if (phase === 'setup') snapshot.shared.constraints.kinds = ['movie', 'show_start'];
  if (phase !== 'setup') snapshot.shared.round = { version: 1, rosterVersion: 1, contextVersion: 1, candidateCount: 3, completed: phase !== 'voting' };
  if (phase === 'shortlist' || phase === 'decided') snapshot.shared.shortlist = { version: 1, proposalVersion: 1, candidateIds: snapshot.shared.candidates.map(c => c.id), proposedCandidateId: null, consentCount: 0 };
  if (phase === 'decided') snapshot.shared.decision = { candidateId: 'fixture-continue', proposalVersion: 1, decidedAt: 1, availability: snapshot.shared.candidates[2].availability };
  return <Page eyebrow="Isolated fixture preview"><Notice>Fixture data only. No live room, verified offers, actual episode availability or multiplayer behavior is demonstrated.</Notice><Row>{(['setup', 'voting', 'shortlist', 'decided'] as const).map(p => <Button key={p} secondary selected={phase === p} onPress={() => setPhase(p)}>{p === 'setup' ? 'Lobby' : p === 'voting' ? 'Voting' : p === 'shortlist' ? 'Shortlist' : 'Choice'}</Button>)}</Row>
    {message && <Notice>{message}</Notice>}<Participants snapshot={snapshot} live={false} />
    {phase === 'setup' && <Setup snapshot={snapshot} disabled={false} send={async c => { setMessage(`Fixture action: ${c.type}. No API command was submitted.`); return true; }} />}
    {phase === 'voting' && <Voting snapshot={snapshot} disabled={false} send={c => setMessage(`Fixture action: ${c.type}. No vote was submitted.`)} />}
    {phase === 'shortlist' && <Shortlist snapshot={snapshot} disabled={false} send={c => setMessage(`Fixture action: ${c.type}. No agreement was recorded.`)} />}
    {phase === 'decided' && <Decision snapshot={snapshot} />}
  </Page>;
}
