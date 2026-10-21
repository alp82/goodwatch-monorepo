import type { RoomCommand, RoomSnapshot } from '@goodwatch/yepwatch-contracts';
import { Button, Heading, Notice, Panel, Row, Words } from '../components/ui';
import { TitleCard } from './Voting';

export function Shortlist({ snapshot, disabled, send }: { snapshot: RoomSnapshot; disabled: boolean; send: (c: RoomCommand) => void }) {
  const { shared, own } = snapshot; const shortlist = shared.shortlist!;
  const proposal = shared.candidates.find(c => c.id === shortlist.proposedCandidateId);
  return <><Heading>{proposal ? 'One last check' : 'Your shared shortlist'}</Heading><Words muted>Voting is finished. Individual choices stay private; shared results may still allow inference.</Words>
    {!shortlist.candidateIds.length && <Notice>No choice everyone accepted yet. Start a new round or revisit your evening together. No one’s vote or screen will be dropped.</Notice>}
    {proposal ? <><TitleCard candidate={proposal} /><Words>{shortlist.consentCount} confirmed for this proposal.</Words><Row><Button disabled={disabled} onPress={() => send({ type: 'consent', proposalVersion: shortlist.proposalVersion, accepted: true })}>{own.consent?.proposalVersion === shortlist.proposalVersion && own.consent.accepted ? 'You confirmed — confirm again' : 'Yes, let’s watch this'}</Button><Button secondary disabled={disabled} onPress={() => send({ type: 'consent', proposalVersion: shortlist.proposalVersion, accepted: false })}>Not this one</Button></Row>
      {own.canHost && <Button disabled={disabled || shortlist.consentCount !== shared.participants.filter(p => p.participation === 'included').length} onPress={() => send({ type: 'decide', proposalVersion: shortlist.proposalVersion })}>Confirm the group’s choice</Button>}
    </> : shortlist.candidateIds.map(id => { const candidate = shared.candidates.find(c => c.id === id); if (!candidate) return null; return <Panel key={id}><Words style={{ fontFamily: 'GabaritoBold', fontSize: 23 }}>{candidate.title}</Words><Row><Button secondary disabled={disabled} selected={own.shortlistPreference === id} onPress={() => send({ type: 'shortlist_preference', shortlistVersion: shortlist.version, candidateId: id })}>{own.shortlistPreference === id ? 'Your preference' : 'My preference'}</Button>{own.canHost && <Button disabled={disabled} onPress={() => send({ type: 'propose', shortlistVersion: shortlist.version, candidateId: id })}>Propose this</Button>}</Row></Panel>; })}
    {own.canHost && proposal && <Panel><Words>Propose another shortlisted title</Words>{shortlist.candidateIds.filter(id => id !== proposal.id).map(id => <Button key={id} secondary disabled={disabled} onPress={() => send({ type: 'propose', shortlistVersion: shortlist.version, candidateId: id })}>{shared.candidates.find(c => c.id === id)?.title ?? 'Another shortlisted title'}</Button>)}</Panel>}
    {own.canHost && <Button secondary disabled={disabled} onPress={() => send({ type: 'new_round', expectedRevision: shared.revision })}>Start another round</Button>}
  </>;
}
