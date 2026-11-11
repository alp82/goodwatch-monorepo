/**
 * Matches, the proposal and its agreement (direction D). Privacy: nobody sees who proposed or who
 * agreed; the proposal reads "Someone proposes" (or "Your proposal"), agreement dots and "2 of 3 agree".
 */
import { useCallback, useEffect } from 'react';
import { Image, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { Candidate } from '@goodwatch/yepwatch-contracts/proposal';
import { useLayout } from '../shell/layout';
import { useBackAction } from '../shell/sheet-back';
import { R, warm } from '../shell/tokens';
import { GText, Icon, Press, glow, grow } from '../glow/theme';
import { ScorePill } from '../glow/scores';
import { showsProposal, type ProposalView } from './model';
import { leavePage, toRooms } from './nav';
import { useRoom } from './RoomProvider';
import { RoomNotes, RoomStatus } from './RoomStatus';
import { servicesIn } from './services';
import { Actions, Button, Dots, Label, Logos, Screen, Small, T, TextLink, usePinnedActions, useServices } from './ui';
import { offeredOn } from './Voting';

const sized = (url: string | null, w: 185 | 342 | 500) => (url ? url.replace('/w500/', `/w${w}/`) : null);
export const meta = (c: Candidate) => [c.year, c.identity.kind === 'movie' ? 'Movie' : 'Show', c.viewingDuration ? `${c.viewingDuration.minutes} min` : null].filter(Boolean).join(' · ');

/** A poster at a width (2:3), a ticket where there's no image. */
export function Poster({ c, width, radius = 10, label = true }: { c: Candidate | null; width: number; radius?: number; /** Announce it (off where a button around it already names the title). */ label?: boolean }) {
  const uri = c ? sized(c.posterUrl, width > 260 ? 500 : width > 130 ? 342 : 185) : null;
  return (
    <View style={{ width, height: width * 1.5, borderRadius: radius, overflow: 'hidden', backgroundColor: warm.well, alignItems: 'center', justifyContent: 'center' }}>
      {uri && c ? <Image source={{ uri }} accessible={label} accessibilityLabel={label ? `${c.title} poster` : undefined} style={{ width: '100%', height: '100%' }} /> : <Icon name="tickets" size={Math.max(24, width * 0.22)} color={glow.amber} />}
    </View>
  );
}

/** Where it streams for this room. */
function useOffered(c: Candidate | null) {
  const { view } = useRoom();
  const { all } = useServices(view?.country);
  return c ? servicesIn(all, offeredOn(c, view?.enabledServiceIds ?? [])) : [];
}

/**
 * "2 of 3 agree", and in its place while the offers are re-checked before Tonight: "Checking where to
 * watch…" or "Couldn't confirm where to watch" with Try again. One line of one height, so the buttons
 * under it never move.
 */
function AgreementLine({ pr, size, align }: { pr: ProposalView; size: number; align: 'flex-start' | 'center' }) {
  const { snapshot, cmd, disabled } = useRoom();
  const a = snapshot?.shared.agreement;
  const line = Math.round(size * 1.4);
  // Each wording is its own node in a row as wide as the column: a new wording replaces the old one
  // instead of moving it.
  const text = (t: string, color: string = glow.soft, small = false) => <GText key={t} size={small ? T.small : size} color={color}>{t}</GText>;
  return (
    <View style={{ height: line, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: align, gap: 10 }}>
      {a?.state === 'checking' ? text('Checking where to watch…', glow.soft, true)
        : a?.state === 'unavailable' ? <>{text('Couldn’t confirm where to watch', glow.muted, true)}
          <Press label="Try again" disabled={disabled} onPress={() => void cmd.retryAgreement()} style={{ minHeight: 48, minWidth: 48, marginVertical: -(48 - line) / 2 }}>
            <GText size={T.small} bold color={glow.amber}>Try again</GText>
          </Press></>
        : text(`${pr.agreeCount} of ${pr.requiredCount} agree`)}
    </View>
  );
}

/** "You agree" or "You proposed this", where Agree was. */
function Agreed({ pr, grow = true }: { pr: ProposalView; grow?: boolean }) {
  const { z } = useLayout();
  return (
    <View style={{ ...(grow ? { flexGrow: 1, flexShrink: 1, flexBasis: 0 } : null), minHeight: z(54), paddingHorizontal: 18, borderRadius: 12, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fbbf2414', borderWidth: 1, borderColor: warm.amberLine }}>
      <Icon name="check" size={18} color={glow.amber} /><GText bold size={z(17)} color={glow.amber}>{pr.mine ? 'You proposed this' : 'You agree'}</GText>
    </View>
  );
}

const proposalLabel = (pr: ProposalView) => (pr.mine ? 'Your proposal' : 'Someone proposes');

/** Shown to everyone in the round until it's decided or set aside on this device with Keep swiping. */
export function Proposal() {
  const { view, cmd, disabled, dismissProposal, setActivityView } = useRoom();
  const { phone, wide, height, header, max, z } = useLayout();
  const pinned = usePinnedActions();
  useFocusEffect(useCallback(() => { setActivityView('matches'); }, [setActivityView]));
  useBackAction(toRooms);
  const pr = view?.proposal;
  const offered = useOffered(pr?.candidate ?? null);
  if (!view || !pr) return null;
  const c = pr.candidate;
  const keep = () => dismissProposal(pr.version);
  const agree = <Button label="Agree" icon={<Icon name="check" size={18} color={warm.ink} />} disabled={disabled} onPress={() => void cmd.agree(true)} />;
  const keepButton = <Button secondary label="Keep swiping" onPress={keep} />;
  const takeBack = <TextLink label="Take back" color={glow.muted} disabled={disabled} onPress={() => void cmd.agree(false)} />;
  const titleSize = wide ? z(56) : 30;
  const info = (
    <View style={{ gap: z(14), alignItems: wide ? 'flex-start' : 'center' }}>
      <Label color={glow.amber}>{proposalLabel(pr)}</Label>
      <GText bold size={titleSize} style={{ letterSpacing: -1.2, lineHeight: titleSize * 1.05, textAlign: wide ? 'left' : 'center' }}>{c?.title ?? 'A match'}</GText>
      {c ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: wide ? 'flex-start' : 'center' }}><ScorePill score={c.goodwatchScore} size={wide ? 'L' : 'M'} /><GText size={z(15)} color={glow.soft}>{meta(c)}</GText></View> : null}
      {offered.length ? <Logos services={offered} size={z(28)} /> : null}
      <View style={{ gap: 8, alignSelf: 'stretch', alignItems: wide ? 'flex-start' : 'center', paddingTop: 6 }}>
        <Dots n={pr.agreeCount} of={pr.requiredCount} />
        <AgreementLine pr={pr} size={z(15)} align={wide ? 'flex-start' : 'center'} />
      </View>
    </View>
  );
  if (wide) {
    const pw = Math.min(z(380), (height - header - z(96)) / 1.5, max * 0.4);
    return (
      <Screen testID="proposal" back={toRooms} width="page">
        <RoomNotes />
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: z(64) }}>
          <Poster c={c} width={pw} radius={R.card} />
          <View style={{ flex: 1, maxWidth: z(560), gap: z(32), paddingTop: z(12) }}>
            {info}
            <View style={{ width: Math.min(z(420), max - pw - z(64)), gap: 8 }}>
              <Actions>{pr.agreed ? <Agreed pr={pr} /> : agree}{keepButton}</Actions>
              {pr.agreed ? takeBack : null}
            </View>
          </View>
        </View>
      </Screen>
    );
  }
  const main = pr.agreed ? <Agreed pr={pr} /> : agree;
  return (
    <Screen testID="proposal" back={toRooms} width="page" footer={pinned ? <Actions>{main}</Actions> : undefined}>
      <RoomNotes />
      <View style={{ alignItems: 'center', gap: 20 }}>
        <Poster c={c} width={Math.min(phone ? 220 : 280, max * 0.6)} radius={12} />
        {info}
        {!pinned ? <Actions style={{ alignSelf: 'stretch' }}>{main}</Actions> : null}
        <Actions style={{ alignSelf: 'stretch' }}>{keepButton}</Actions>
        {pr.agreed ? <View style={{ alignSelf: 'center' }}>{takeBack}</View> : null}
      </View>
    </Screen>
  );
}

/** The proposal, compact, on top of the matches (once set aside with Keep swiping): poster, agreement, Agree. */
function ProposalCard({ pr }: { pr: ProposalView }) {
  const { cmd, disabled, reopenProposal } = useRoom();
  const { phone, z } = useLayout();
  const c = pr.candidate;
  const agree = pr.agreed
    ? <View style={{ gap: 4, alignItems: phone ? 'flex-start' : 'center' }}><Agreed pr={pr} grow={false} /><TextLink label="Take back" color={glow.muted} disabled={disabled} onPress={() => void cmd.agree(false)} /></View>
    : <Press label="Agree" disabled={disabled} onPress={() => void cmd.agree(true)} style={{ minHeight: z(48), paddingHorizontal: z(28), borderRadius: R.control, flexDirection: 'row', gap: 8, backgroundColor: glow.amber }}><Icon name="check" size={18} color={warm.ink} /><GText bold size={z(16)} color={warm.ink}>Agree</GText></Press>;
  return (
    <View testID="proposal-card" style={{ flexDirection: 'row', alignItems: 'center', gap: z(18), padding: z(14), borderRadius: R.card, backgroundColor: '#fbbf240d', borderWidth: 1, borderColor: '#fbbf2470' }}>
      <Press label={`${c?.title ?? 'The proposal'}, open proposal`} onPress={reopenProposal} style={{ borderRadius: R.control }}><Poster c={c} width={phone ? 78 : z(104)} label={false} /></Press>
      <View style={{ flex: 1, minWidth: 0, gap: z(8) }}>
        <Label color={glow.amber}>{proposalLabel(pr)}</Label>
        <GText bold size={phone ? 20 : z(28)} lines={2} style={{ letterSpacing: -0.6 }}>{c?.title ?? 'A match'}</GText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Dots n={pr.agreeCount} of={pr.requiredCount} />
          <GText size={z(14)} color={glow.soft}>{`${pr.agreeCount} of ${pr.requiredCount} agree`}</GText>
        </View>
        {phone ? <View style={{ flexDirection: 'row', paddingTop: 4 }}>{agree}</View> : null}
      </View>
      {!phone ? agree : null}
    </View>
  );
}

/** One match: a big poster, its facts, Propose this (or Propose this instead). */
function MatchCard({ c, proposing }: { c: Candidate; proposing: boolean }) {
  const { cmd, disabled, reopenProposal } = useRoom();
  const { phone, z } = useLayout();
  const offered = useOffered(c);
  return (
    <View style={{ padding: z(14), gap: z(14), borderRadius: R.card, backgroundColor: warm.faint, borderWidth: 1, borderColor: warm.line }}>
      <View style={{ flexDirection: 'row', gap: z(16) }}>
        <Poster c={c} width={phone ? 96 : z(132)} />
        <View style={{ flex: 1, minWidth: 0, gap: z(8) }}>
          <GText bold size={phone ? 19 : z(24)} lines={3} style={{ letterSpacing: -0.4 }}>{c.title}</GText>
          <GText size={z(14)} color={glow.muted}>{meta(c)}</GText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ScorePill score={c.goodwatchScore} size={phone ? 'S' : 'M'} /><Logos services={offered} size={z(22)} /></View>
        </View>
      </View>
      <Press label={proposing ? 'Propose this instead' : 'Propose this'} disabled={disabled} onPress={() => { reopenProposal(); void cmd.propose(c.id); }}
        style={{ ...grow(z(44)), alignItems: 'stretch' }} visual={{ minHeight: z(44), alignItems: 'center', justifyContent: 'center', borderRadius: R.control, borderWidth: 1, borderColor: warm.lineStrong }}>
        <GText bold size={z(15)}>{proposing ? 'Propose this instead' : 'Propose this'}</GText>
      </Press>
    </View>
  );
}

/** Every match, the proposal on top. */
export function MatchesPage() {
  const { id, view, dismissedProposal, setActivityView } = useRoom();
  const { phone, width, z } = useLayout();
  useFocusEffect(useCallback(() => { setActivityView('matches'); }, [setActivityView]));
  // Nobody stays on Matches once the round is decided or restarted: the room shows what's next.
  // A proposal takes over on the room page underneath, so Back from it leaves the room.
  const phase = view?.phase;
  const proposed = Boolean(view && showsProposal(view, dismissedProposal));
  useEffect(() => { if ((phase && phase !== 'choosing') || proposed) leavePage(id); }, [phase, proposed, id]);
  if (!view) return <RoomStatus />;
  const proposal = view.proposal;
  const others = view.matches.filter((c) => c.id !== proposal?.candidateId);
  const cols = phone ? 1 : width < 1000 ? 2 : Math.min(3, Math.max(2, others.length));
  const count = view.matches.length;
  const keep = <Button secondary label="Keep swiping" fixed={phone ? undefined : z(220)} onPress={() => leavePage(id)} />;
  return (
    <Screen testID="matches" back={() => leavePage(id)} width="page" gap={phone ? 18 : z(24)}>
      <RoomNotes />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <GText bold size={phone ? 34 : z(52)} style={{ flex: 1, letterSpacing: -1.4 }}>{count ? `${count} ${count === 1 ? 'match' : 'matches'}` : 'Matches'}</GText>
        {!phone ? keep : null}
      </View>
      {!count ? <Small>No matches yet</Small> : null}
      {proposal ? <ProposalCard pr={proposal} /> : null}
      {others.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', margin: -z(8) }}>
          {others.map((c) => <View key={c.id} style={{ width: `${100 / cols}%`, padding: z(8) }}><MatchCard c={c} proposing={Boolean(proposal)} /></View>)}
        </View>
      ) : null}
      {phone ? <Actions>{keep}</Actions> : null}
    </Screen>
  );
}
