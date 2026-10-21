import { useState } from 'react';
import { Linking } from 'react-native';
import type { RoomSnapshot } from '@goodwatch/yepwatch-contracts';
import { Button, Heading, Notice, Panel, Words } from '../components/ui';
import { TitleCard } from './Voting';

export function Decision({ snapshot }: { snapshot: RoomSnapshot }) {
  const [error, setError] = useState(''); const { shared, own } = snapshot;
  const candidate = shared.candidates.find(c => c.id === shared.decision?.candidateId);
  const myScreen = shared.participants.find(p => p.participantId === own.participantId)?.screenId;
  async function open(url: string) { try { const parsed = new URL(url); if (parsed.protocol !== 'https:') throw new Error('This destination is not a secure web link.'); await Linking.openURL(parsed.href); } catch (e) { setError(e instanceof Error ? e.message : 'Could not open this provider.'); } }
  return <><Heading>You chose something good.</Heading>{candidate && <TitleCard candidate={candidate} />}
    <Words muted>This is your confirmed group choice. Opening a provider does not start playback for everyone or record a watch.</Words>{error && <Notice error>{error}</Notice>}
    {shared.decision?.availability.filter(a => a.screenId === myScreen).map(a => <Panel key={a.screenId}><Words style={{ fontFamily: 'GabaritoBold' }}>{shared.screens.find(s => s.id === a.screenId)?.label ?? 'Your screen'}</Words><Words muted>{a.state === 'watchable' ? 'Offers found' : a.state === 'unknown' ? 'Availability is unknown' : 'No matching offer'} · {a.checkedAt ? `Checked ${new Date(a.checkedAt).toLocaleDateString()}` : 'Check date unknown'}</Words>
      {a.scope === 'title' && candidate?.identity.kind !== 'movie' && <Notice>These offers cover the show. Check that your chosen episode is included before starting.</Notice>}
      {a.offers.map((offer, index) => <Button key={`${offer.serviceId}-${index}`} secondary disabled={!offer.url} onPress={() => offer.url && void open(offer.url)}>{offer.kind === 'provider' ? `Open ${offer.name}` : offer.kind === 'where_to_watch' ? 'Find where to watch' : `Search on ${offer.name}`} · {offer.offerType === 'flatrate' ? 'Subscription' : offer.offerType === 'ads' ? 'Free with ads' : 'Free'}</Button>)}
      {!a.offers.length && <Words muted>No verified destination is available. Check your service for {candidate?.title}.</Words>}
    </Panel>)}
    <Words muted>Movie and show metadata: TMDB. Availability: JustWatch via TMDB. YepWatch is not endorsed or certified by TMDB. Provider access and episode inclusion must be checked on each screen.</Words>
  </>;
}
