/**
 * Matches, the proposal and its agreement. Privacy: nobody sees who proposed or who agreed; the
 * proposal reads "Someone proposes" (or "Your proposal") and "2 of 3 agree".
 */
import { useCallback, useEffect } from 'react';
import { BackHandler, Image, Platform, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { Candidate } from '@goodwatch/yepwatch-contracts/proposal';
import { GText, Icon, Press, glow } from '../glow/theme';
import { showsProposal } from './model';
import { leavePage, toRooms } from './nav';
import { RoomBar } from './parts';
import { useRoom } from './RoomProvider';
import { RoomNotes, RoomStatus } from './RoomStatus';
import { servicesIn } from './services';
import { Button, Logos, ScoreBadge, Screen, Small, T, TextLink, card, useServices } from './ui';
import { offeredOn } from './Voting';

const thumb = (url: string | null, w: 185 | 500) => (url ? url.replace('/w500/', `/w${w}/`) : null);
export const meta = (c: Candidate) => [c.year, c.identity.kind === 'movie' ? 'Movie' : 'Show', c.viewingDuration ? `${c.viewingDuration.minutes} min` : null].filter(Boolean).join(' · ');

function TitleFacts({ c }: { c: Candidate }) {
  const { view } = useRoom();
  const { all } = useServices(view?.country);
  const on = servicesIn(all, offeredOn(c, view?.enabledServiceIds ?? []));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Small>{meta(c)}</Small>
      <Logos services={on} size={20} />
      {c.goodwatchScore != null ? <ScoreBadge score={c.goodwatchScore} /> : null}
    </View>
  );
}

/** Agreement checking or failed (offers re-checked before Tonight). */
function AgreementState() {
  const { snapshot, cmd, disabled } = useRoom();
  const a = snapshot?.shared.agreement;
  if (!a || a.state === 'none') return null;
  return a.state === 'checking'
    ? <Small color={glow.soft}>Checking where to watch…</Small>
    : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Small>Couldn’t confirm where to watch</Small><TextLink label="Try again" disabled={disabled} onPress={() => void cmd.retryAgreement()} /></View>;
}

/** Shown to everyone in the round until it's decided or set aside on this device with Keep swiping. */
export function Proposal() {
  const { view, cmd, disabled, dismissProposal, setActivityView } = useRoom();
  useFocusEffect(useCallback(() => {
    setActivityView('matches');
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { toRooms(); return true; });
    return () => sub.remove();
  }, [setActivityView]));
  const pr = view?.proposal;
  if (!view || !pr) return null;
  const c = pr.candidate;
  const keep = () => dismissProposal(pr.version);
  return (
    <Screen testID="proposal" back={toRooms} right={<RoomBar />}
      footer={pr.agreed ? <>
        <View style={{ height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#fbbf2414', borderWidth: 1, borderColor: '#fbbf2455', flexDirection: 'row', gap: 8 }}>
          <Icon name="check" size={18} color={glow.amber} /><GText bold color={glow.amber}>{pr.mine ? 'You proposed this' : 'You agree'}</GText>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <TextLink label="Take back" color={glow.muted} disabled={disabled} onPress={() => void cmd.agree(false)} />
          <TextLink label="Keep swiping" color={glow.soft} onPress={keep} />
        </View>
      </> : <>
        <Button label="Agree" disabled={disabled} onPress={() => void cmd.agree(true)} />
        <Button secondary label="Keep swiping" onPress={keep} />
      </>}>
      <RoomNotes />
      <View style={{ alignItems: 'center', gap: 12 }}>
        <Small bold color={glow.amber}>{pr.mine ? 'YOUR PROPOSAL' : 'SOMEONE PROPOSES'}</Small>
        {c?.posterUrl ? <Image source={{ uri: c.posterUrl }} accessibilityLabel={`${c.title} poster`} style={{ width: 190, height: 285, borderRadius: 10 }} /> : <View style={{ width: 190, height: 285, borderRadius: 10, backgroundColor: '#ffffff0d', alignItems: 'center', justifyContent: 'center' }}><Icon name="tickets" size={40} color={glow.amber} /></View>}
        <GText bold size={28} style={{ textAlign: 'center', letterSpacing: -0.7 }}>{c?.title ?? 'A match'}</GText>
        {c ? <TitleFacts c={c} /> : null}
        <GText size={T.small} color={glow.soft}>{`${pr.agreeCount} of ${pr.requiredCount} agree`}</GText>
        <AgreementState />
      </View>
    </Screen>
  );
}

/** Every match, with Propose this (or Propose this instead). */
export function MatchesPage() {
  const { id, view, cmd, disabled, reopenProposal, dismissedProposal, setActivityView } = useRoom();
  useFocusEffect(useCallback(() => { setActivityView('matches'); }, [setActivityView]));
  // Nobody stays on Matches once the round is decided or restarted: the room shows what's next.
  // A proposal takes over on the room page underneath, so Back from it leaves the room.
  const phase = view?.phase;
  const proposed = Boolean(view && showsProposal(view, dismissedProposal));
  useEffect(() => { if ((phase && phase !== 'choosing') || proposed) leavePage(id); }, [phase, proposed, id]);
  if (!view) return <RoomStatus />;
  const proposal = view.proposal;
  return (
    <Screen testID="matches" back={() => leavePage(id)} right={<RoomBar />} footer={<Button secondary label="Keep swiping" onPress={() => leavePage(id)} />}>
      <RoomNotes />
      <GText bold size={T.title} style={{ letterSpacing: -0.8 }}>Matches</GText>
      {!view.matches.length && <Small>No matches yet</Small>}
      {view.matches.map((c) => {
        const proposed = proposal?.candidateId === c.id;
        const poster = thumb(c.posterUrl, 185);
        return (
          <View key={c.id} style={{ ...card, padding: 12, gap: 12, borderColor: proposed ? '#fbbf2499' : '#ffffff12', backgroundColor: proposed ? '#fbbf2410' : '#ffffff08' }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {poster ? <Image source={{ uri: poster }} accessible={false} style={{ width: 64, height: 96, borderRadius: 10 }} /> : <View style={{ width: 64, height: 96, borderRadius: 10, backgroundColor: '#ffffff0d' }} />}
              <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
                {proposed ? <Small bold color={glow.amber}>{proposal?.mine ? 'YOUR PROPOSAL' : 'PROPOSED'}</Small> : null}
                <GText bold size={18} lines={2}>{c.title}</GText>
                <TitleFacts c={c} />
              </View>
            </View>
            {proposed && proposal ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Small color={glow.soft}>{`${proposal.agreeCount} of ${proposal.requiredCount} agree`}</Small>
                <View style={{ flex: 1 }} />
                {proposal.agreed
                  ? <TextLink label="Take back" color={glow.muted} disabled={disabled} onPress={() => void cmd.agree(false)} />
                  : <Press label="Agree" disabled={disabled} onPress={() => void cmd.agree(true)} style={{ height: 40, paddingHorizontal: 18, borderRadius: 8, backgroundColor: glow.amber }}><GText bold color="#201400">Agree</GText></Press>}
              </View>
            ) : (
              <Press label={proposal ? 'Propose this instead' : 'Propose this'} disabled={disabled} onPress={() => { reopenProposal(); void cmd.propose(c.id); }}
                style={{ alignSelf: 'flex-start', height: 38, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#ffffff26' }}>
                <GText bold size={14}>{proposal ? 'Propose this instead' : 'Propose this'}</GText>
              </Press>
            )}
          </View>
        );
      })}
    </Screen>
  );
}
