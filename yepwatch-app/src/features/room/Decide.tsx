/**
 * Matches ("What are we watching now?") and a friend's I'm in taking over the screen. On Matches every match
 * is a checkbox: tap every one you're in for (matches-in.ts says what a tap sends today). Everyone in for
 * one title decides it (Tonight); everyone in for two or more opens the tiebreak. Privacy: counts, never
 * who; a friend's I'm in reads "Someone's in", with dots and "2 of 3 in".
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Animated, Image, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import type { Candidate } from '@goodwatch/yepwatch-contracts/proposal';
import { useLayout } from '../shell/layout';
import { leaveScreen, useBackAction } from '../shell/sheet-back';
import { R, warm } from '../shell/tokens';
import { GText, Icon, Press, glow, spaceToggles } from '../glow/theme';
import { ScorePill } from '../glow/scores';
import { showsProposal, type ProposalView, type RoomView } from './model';
import { leavePage, toRooms } from './nav';
import { useRoom, useRoomLive } from './RoomProvider';
import { RoomNotes, RoomStatus } from './RoomStatus';
import { servicesIn } from './services';
import { everyoneIn, inRows, inTap, localAfter, type ProposalIns } from './matches-in';
import { useHover, useOn } from './matches-motion';
import { Tiebreak } from './Tiebreak';
import { Actions, Button, Dots, Label, Logos, Screen, T, TextLink, usePinnedActions, useServices } from './ui';
import { PosterCopy } from './vote/shapes';
import { cardReason, offeredOn } from './Voting';

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
  const { cmd, disabled } = useRoom();
  const { snapshot } = useRoomLive();
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
        : text(`${pr.agreeCount} of ${pr.requiredCount} in`)}
    </View>
  );
}

/** "You're in", where I'm in was. */
function Agreed({ grow = true }: { grow?: boolean }) {
  const { z } = useLayout();
  return (
    <View style={{ ...(grow ? { flexGrow: 1, flexShrink: 1, flexBasis: 0 } : null), minHeight: z(54), paddingHorizontal: 18, borderRadius: 12, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fbbf2414', borderWidth: 1, borderColor: warm.amberLine }}>
      <Icon name="check" size={18} color={glow.amber} /><GText bold size={z(17)} color={glow.amber}>You’re in</GText>
    </View>
  );
}

/**
 * While this device's Propose of this title awaits its answer: where "You proposed this" will be, the same
 * size, so nothing moves when the answer makes it yours. Nothing claims it before then: a friend may have
 * proposed the same title at the same moment.
 */
function Proposing({ grow = true }: { grow?: boolean }) {
  const { z } = useLayout();
  return (
    <View accessibilityLiveRegion="polite" style={{ ...(grow ? { flexGrow: 1, flexShrink: 1, flexBasis: 0 } : null), minHeight: z(54), paddingHorizontal: 18, borderRadius: 12, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: warm.line }}>
      <View style={{ width: 18, height: 18 }} />
      {/* As wide as "You're in": a card beside it doesn't move when the answer comes. */}
      <View>
        <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ opacity: 0 }}><GText bold size={z(17)}>You’re in</GText></View>
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}><GText bold size={z(17)} color={glow.muted} lines={1}>Joining…</GText></View>
      </View>
    </View>
  );
}
/** Keeps the space of the Take back link under "You're in" while the proposal is pending. */
function TakeBackSpace({ children }: { children: ReactNode }) {
  return <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ opacity: 0 }}>{children}</View>;
}

const proposalLabel = (pr: ProposalView) => (pr.mine || pr.agreed ? 'You’re in' : 'Someone’s in');

/** A friend's I'm in: shown to everyone else in the round until it's decided or set aside on this device with Keep swiping. */
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
  const agree = <Button label="I’m in" icon={<Icon name="check" size={18} color={warm.ink} />} disabled={disabled} onPress={() => void cmd.agree(true)} />;
  const keepButton = <Button secondary label="Keep swiping" onPress={keep} />;
  const takeBack = <TextLink label="Take back" color={glow.muted} disabled={disabled} onPress={() => void cmd.agree(false)} />;
  const under = pr.agreed ? takeBack : pr.pending ? <TakeBackSpace><TextLink label="Take back" color={glow.muted} disabled onPress={() => undefined} /></TakeBackSpace> : null;
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
              <Actions>{pr.agreed ? <Agreed /> : pr.pending ? <Proposing /> : agree}{keepButton}</Actions>
              {under}
            </View>
          </View>
        </View>
      </Screen>
    );
  }
  const main = pr.agreed ? <Agreed /> : pr.pending ? <Proposing /> : agree;
  return (
    <Screen testID="proposal" back={toRooms} width="page" footer={pinned ? <Actions>{main}</Actions> : undefined}>
      <RoomNotes />
      <View style={{ alignItems: 'center', gap: 20 }}>
        <Poster c={c} width={Math.min(phone ? 220 : 280, max * 0.6)} radius={12} />
        {info}
        {!pinned ? <Actions style={{ alignSelf: 'stretch' }}>{main}</Actions> : null}
        <Actions style={{ alignSelf: 'stretch' }}>{keepButton}</Actions>
        {under ? <View style={{ alignSelf: 'center' }}>{under}</View> : null}
      </View>
    </Screen>
  );
}

// ——— Matches: "What are we watching now?" ———

/** "I'm in" marks kept on this device only, per room and round (see matches-in.ts), while the app runs. */
const marks = new Map<string, Set<string>>();

const FILL = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as const;
/** The row's backdrop band: the match's own poster, blurred. */
const BLUR = { css: 'blur(22px) saturate(1.4) brightness(0.7)', blur: 22, tints: [{ color: '#000000', opacity: 0.35 }] } as const;
/** Seats shown at most; a bigger room reads its count from "2 of 7 in". */
const MAX_SEATS = 5;

/** The poster as the checkbox: off, dimmed with an empty round box in its center; on, full brightness, an amber check pops in and an amber frame. */
function CheckPoster({ c, width, on, hover, hero }: { c: Candidate; width: number; on: boolean; hover: Animated.Value; hero?: boolean }) {
  const v = useOn(on, 220);
  const radius = hero ? 12 : 8;
  const b = hero ? Math.min(72, Math.max(44, Math.round(width * 0.24))) : Math.max(28, Math.round(width * 0.46));
  const disc = { ...FILL, borderRadius: b / 2 };
  const off = v.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  // Off: a dark veil (0.58, 0.4 on hover). On: none.
  const veil = Animated.multiply(off, hover.interpolate({ inputRange: [0, 1], outputRange: [0.58, 0.4] }));
  return (
    <View style={{ width }}>
      <View style={{ borderRadius: radius, overflow: 'hidden' }}>
        <Poster c={c} width={width} radius={radius} label={false} />
        <Animated.View pointerEvents="none" style={[FILL, { backgroundColor: '#000', opacity: veil }]} />
      </View>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -3, right: -3, top: -3, bottom: -3, borderRadius: radius + 3, borderWidth: 3, borderColor: glow.amber, opacity: v }} />
      <View pointerEvents="none" style={[FILL, { alignItems: 'center', justifyContent: 'center' }]}>
        <View style={{ width: b, height: b }}>
          <Animated.View style={[disc, { backgroundColor: '#00000080', borderWidth: hero ? 2.5 : 2, borderColor: '#ffffffd9', opacity: off }]} />
          <Animated.View style={[disc, { borderWidth: hero ? 2.5 : 2, borderColor: glow.amber, opacity: Animated.multiply(off, hover) }]} />
          <Animated.View style={[disc, { backgroundColor: glow.amber, borderWidth: 2, borderColor: '#0d0d0d', alignItems: 'center', justifyContent: 'center', opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.3, 1.18, 1] }) }] }]}>
            <Icon name="check" size={b * 0.58} color={warm.ink} />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

/** A plus sign (the icon set has none). */
function Plus({ size, color }: { size: number; color: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" accessible={false}><Path d="M12 5v14M5 12h14" /></Svg>;
}

/**
 * One seat per person: yours first (a dashed amber ring with a plus; your face drops in when you're in),
 * then the others who are in as plain filled seats (counts, never who), then faint empty seats.
 */
function Seats({ on, n, of, size, name }: { on: boolean; n: number; of: number; size: number; name: string }) {
  const v = useOn(on, 220);
  const seats = Math.min(of, MAX_SEATS);
  const others = Math.min(seats - 1, Math.max(0, n - (on ? 1 : 0)));
  const empty = Math.max(0, seats - 1 - others);
  const ring = { width: size, height: size, borderRadius: size / 2 } as const;
  const overlap = -size * 0.24;
  return (
    <View accessible={false} style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={ring}>
        <Animated.View style={[ring, { position: 'absolute', borderWidth: 2, borderStyle: 'dashed', borderColor: glow.amber, backgroundColor: '#0d0d0d', alignItems: 'center', justifyContent: 'center', opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
          <Plus size={size * 0.5} color={glow.amber} />
        </Animated.View>
        <Animated.View style={[ring, { position: 'absolute', backgroundColor: glow.amber, borderWidth: 2, borderColor: '#0d0d0d', alignItems: 'center', justifyContent: 'center', opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-size * 0.35, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]}>
          <GText bold size={size * 0.42} color="#141008">{(name || '?').slice(0, 1).toUpperCase()}</GText>
        </Animated.View>
      </View>
      {Array.from({ length: others }, (_, k) => <View key={`in-${k}`} style={[ring, { marginLeft: overlap, backgroundColor: '#8a8072', borderWidth: 2, borderColor: '#0d0d0d' }]} />)}
      {Array.from({ length: empty }, (_, k) => <View key={`open-${k}`} style={[ring, { marginLeft: overlap, backgroundColor: '#0d0d0d', borderWidth: 1.5, borderColor: '#ffffff33' }]} />)}
    </View>
  );
}

/** "I'm in" off; a check and "You're in" on. */
function InLabel({ on, size }: { on: boolean; size: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {on ? <Icon name="check" size={size} color={glow.amber} /> : null}
      <GText bold size={size} color={on ? glow.amber : glow.soft} lines={1}>{on ? 'You’re in' : 'I’m in'}</GText>
    </View>
  );
}

/** Score and where to watch, together, no labels. */
function ScoreWhere({ c, small }: { c: Candidate; small?: boolean }) {
  const { z } = useLayout();
  const offered = useOffered(c);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: small ? 26 : z(30) }}>
      <ScorePill score={c.goodwatchScore} size={small ? 'S' : 'M'} />
      {offered.length ? <Logos services={offered} size={small ? 20 : z(24)} /> : <GText size={z(12)} color={glow.muted}>Not on your services</GText>}
    </View>
  );
}

/** Everyone said Yep: that's what made it a match. */
function AllYep({ of, size }: { of: number; size: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon name="check" size={size} color={glow.amber} />
      <GText bold size={size} lines={1} color={glow.amber}>{of > 1 ? `All ${of} said Yep` : 'You said Yep'}</GText>
    </View>
  );
}

/** The faint amber tint and line over a match once you're in (quiet: the poster carries it). */
function OnLayer({ on, radius }: { on: boolean; radius: number }) {
  const v = useOn(on);
  return <Animated.View pointerEvents="none" style={[FILL, { borderRadius: radius, backgroundColor: '#fbbf240d', borderWidth: 1.5, borderColor: '#fbbf2499', opacity: v }]} />;
}

interface MatchProps { c: Candidate; on: boolean; n: number; of: number; name: string; onToggle: () => void; disabled: boolean }

/**
 * A whole match as one checkbox (role checkbox, checked state, Space toggles on the web). Hover: the tall
 * single match lifts; rows lighten their surface and border.
 */
function Toggle({ on, label, onToggle, disabled, lift, inner, children }: { on: boolean; label: string; onToggle: () => void; disabled: boolean; lift?: boolean; inner: object; children: (hover: Animated.Value) => ReactNode }) {
  const h = useHover();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: on, disabled }} aria-checked={on} disabled={disabled}
      onPress={onToggle} {...spaceToggles(onToggle, disabled)} {...h.handlers}
      style={({ pressed }) => [pressed && { opacity: 0.88 }]}>
      <Animated.View style={{ transform: [{ translateY: lift ? h.v.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) : 0 }] }}>
        {lift ? <Animated.View pointerEvents="none" style={[FILL, { borderRadius: R.card, backgroundColor: '#1c1915e6', opacity: h.v, shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 10 }]} /> : null}
        <View style={inner}>{children(h.v)}</View>
        {lift ? null : <Animated.View pointerEvents="none" style={[FILL, { borderRadius: R.card, backgroundColor: '#ffffff0a', borderWidth: 1, borderColor: warm.lineStrong, opacity: h.v }]} />}
      </Animated.View>
    </Pressable>
  );
}

const inName = (c: Candidate, n: number, of: number) => `I’m in for ${c.title}, ${n} of ${of} in`;

/** Two or more matches: one wide row each on a blurred band of its own poster. The poster is the checkbox; the whole row toggles. */
function MatchRow({ c, on, n, of, name, onToggle, disabled }: MatchProps) {
  const { phone, z } = useLayout();
  const cw = phone ? 78 : z(112);
  const pw = phone ? 60 : z(72);
  const reason = cardReason(c);
  // The backdrop band: barely there off, full strength on.
  const band = useOn(on, 260).interpolate({ inputRange: [0, 1], outputRange: [0.16, 1] });
  const why = [reason, phone ? null : meta(c)].filter(Boolean).reverse().join('  ·  ');
  return (
    <Toggle on={on} label={inName(c, n, of)} onToggle={onToggle} disabled={disabled}
      inner={{ borderRadius: R.card, overflow: 'hidden', backgroundColor: warm.raised, borderWidth: 1, borderColor: warm.line }}>
      {(hover) => (
        <>
          <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '70%', overflow: 'hidden', opacity: band }}>
            <PosterCopy uri={sized(c.posterUrl, 185)} {...BLUR} />
            <LinearGradient pointerEvents="none" colors={['rgba(7,7,7,0)', warm.raised]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '75%' }} />
          </Animated.View>
          <OnLayer on={on} radius={R.card} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: phone ? 12 : z(18), padding: phone ? 10 : z(12), paddingRight: phone ? 8 : z(18) }}>
            <CheckPoster c={c} width={pw} on={on} hover={hover} />
            <View style={{ flex: 1, minWidth: 0, gap: phone ? 4 : z(5) }}>
              <GText bold size={phone ? 16 : z(20)} lines={phone ? 2 : 1} style={{ letterSpacing: -0.3 }}>{c.title}</GText>
              <GText size={phone ? 12 : z(13)} color={glow.muted} lines={1}>{phone ? meta(c) : why}</GText>
              {phone ? <View style={{ paddingTop: 2 }}><ScoreWhere c={c} small /></View> : null}
            </View>
            {phone ? null : (
              <View style={{ width: z(230), gap: z(6) }}>
                <ScoreWhere c={c} small />
                <AllYep of={of} size={z(13)} />
              </View>
            )}
            <View style={{ width: cw, alignItems: 'center', gap: 6 }}>
              <Seats on={on} n={n} of={of} size={phone ? 26 : z(30)} name={name} />
              <InLabel on={on} size={phone ? 12 : z(13)} />
            </View>
          </View>
        </>
      )}
    </Toggle>
  );
}

/** One match, editorial: big poster beside its facts, filling a phone and sitting wide on desktop. The poster is the checkbox; the whole card toggles. */
function SingleMatch({ c, on, n, of, name, onToggle, disabled }: MatchProps) {
  const { phone, z, max } = useLayout();
  const pad = phone ? 12 : z(24);
  const width = phone ? max : Math.min(max, z(880));
  const posterW = phone ? Math.round((width - pad * 2) * 0.46) : z(290);
  const reason = cardReason(c);
  const seats = (
    <View style={{ minHeight: z(56), flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <Seats on={on} n={n} of={of} size={z(38)} name={name} />
      <View style={{ flex: 1 }}><InLabel on={on} size={z(18)} /></View>
      <GText size={z(13)} color={glow.muted}>{`${n} of ${of} in`}</GText>
    </View>
  );
  return (
    <View style={{ width, alignSelf: 'center' }}>
      <Toggle on={on} label={inName(c, n, of)} onToggle={onToggle} disabled={disabled} lift inner={{ borderRadius: R.card, padding: pad, gap: phone ? 14 : z(18) }}>
        {(hover) => (
          <>
            <OnLayer on={on} radius={R.card} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <GText bold size={phone ? 12 : z(13)} color={glow.amber} style={{ letterSpacing: 1.4 }}>YOUR MATCH</GText>
              <View style={{ flex: 1, height: 1, backgroundColor: warm.lineStrong }} />
            </View>
            <View style={{ flexDirection: 'row', gap: phone ? 14 : z(32), alignItems: phone ? 'flex-start' : 'stretch' }}>
              <View style={{ boxShadow: '0 8px 18px #00000080', borderRadius: 12 }}><CheckPoster c={c} width={posterW} on={on} hover={hover} hero /></View>
              <View style={{ flex: 1, minWidth: 0, gap: phone ? 8 : z(12) }}>
                <GText bold size={phone ? 24 : z(46)} lines={4} style={{ letterSpacing: phone ? -0.6 : -1.4 }}>{c.title}</GText>
                <GText size={phone ? 13 : z(15)} color={glow.soft}>{meta(c)}</GText>
                <ScoreWhere c={c} small={phone} />
                <AllYep of={of} size={phone ? 13 : z(15)} />
                {!phone && reason ? <GText size={z(16)} color={glow.muted} style={{ fontStyle: 'italic' }}>{reason}</GText> : null}
                {phone ? null : <View style={{ flex: 1 }} />}
                {phone ? null : <View style={{ width: z(360) }}>{seats}</View>}
              </View>
            </View>
            {phone && reason ? <GText size={14} color={glow.muted} style={{ fontStyle: 'italic' }}>{reason}</GText> : null}
            {phone ? seats : null}
          </>
        )}
      </Toggle>
    </View>
  );
}

/** Every match, the proposal on top. */
export function MatchesPage() {
  const { id, view, dismissedProposal, setActivityView } = useRoom();
  useFocusEffect(useCallback(() => { setActivityView('matches'); }, [setActivityView]));
  // Nobody stays on Matches once the round is decided or restarted: the room shows what's next.
  // A friend's proposal takes over on the room page underneath, so Back from it leaves the room. Your own
  // (an I'm in from here) doesn't: you stay to say which other ones you're in for.
  const phase = view?.phase;
  const proposed = Boolean(view && showsProposal(view, dismissedProposal));
  const leaving = Boolean(phase && phase !== 'choosing') || proposed;
  // Sheets close first: a sheet holds a navigation away, and this page would stay.
  useEffect(() => { if (leaving) leaveScreen(() => leavePage(id)); }, [leaving, id]);
  // While it leaves, the page keeps the last layout it showed. Drawn for a frame or two before the room's page
  // replaced it, the proposal's card where its match was (another height) moved Keep swiping (CI run 43605791062).
  const [shown, setShown] = useState(view);
  if (view && !leaving && view !== shown) setShown(view);
  const page = leaving ? shown ?? view : view;
  if (!page) return <RoomStatus />;
  return <Matches id={id} view={page} held={leaving} />;
}

/** `held`: the layout from before the page began leaving, shown until it's gone; its toggles do nothing. */
function Matches({ id, view, held }: { id: string; view: RoomView; held: boolean }) {
  const { cmd, disabled } = useRoom();
  const { phone, z, max } = useLayout();
  const key = `${id}:${view.generation}`;
  const [local, setLocal] = useState<ReadonlySet<string>>(() => marks.get(key) ?? new Set());
  const [tiebreak, setTiebreak] = useState(false);
  const [favorite, setFavorite] = useState<string | null>(null);
  const pr = view.proposal;
  const proposal: ProposalIns | null = pr ? { candidateId: pr.candidateId, agreeCount: pr.agreeCount, mine: pr.agreed || pr.pending } : null;
  const required = pr?.requiredCount ?? view.people.filter((p) => p.inRound && !p.dropped).length;
  const matches = view.matches;
  const rows = inRows(matches.map((c) => c.id), proposal, local);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const tied = everyoneIn(rows, required).map((cid) => matches.find((c) => c.id === cid)!).filter(Boolean);
  const toggle = (cid: string) => {
    if (held) return;
    const tap = inTap(cid, proposal, local);
    const next = localAfter(local, cid, tap, proposal);
    marks.set(key, next);
    setLocal(next);
    if (tap.kind === 'agree') void cmd.agree(tap.agreed);
    else if (tap.kind === 'propose') void cmd.propose(cid);
  };
  const count = matches.length;
  const sub = count === 0 ? 'When everyone says Yep to a title, it shows up here.' : count === 1 ? '1 match · Tap it if you’re in' : `${count} matches · Tap every one you’re in for`;
  const one = count === 1 ? matches[0] : null;
  const name = view.me.nickname;
  const props = (c: Candidate): MatchProps => ({ c, on: byId.get(c.id)?.mine ?? false, n: byId.get(c.id)?.count ?? 0, of: required, name, onToggle: () => toggle(c.id), disabled });
  const decided = tied.length === 1 ? tied[0] : null;
  const keep = <Button secondary label="Keep swiping" onPress={() => leavePage(id)} />;
  const footer = (
    <View style={{ gap: 10, width: phone ? '100%' : z(tied.length > 1 ? 520 : 400), alignSelf: 'center' }}>
      {/* One line, always there: everyone getting in on a title moves nothing. */}
      <View accessibilityLiveRegion="polite" style={{ minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {tied.length ? <Icon name="check" size={16} color={glow.amber} /> : null}
        {tied.length ? <GText bold size={z(14)} color={glow.amber} lines={1}>{decided ? `Everyone’s in for ${decided.title}` : `Everyone’s in for ${tied.length}`}</GText> : null}
      </View>
      <Actions>
        {keep}
        {tied.length > 1 ? <Button label={`Pick one of ${tied.length}`} icon={<Icon name="dice" size={17} color={warm.ink} />} onPress={() => setTiebreak(true)} /> : null}
      </Actions>
    </View>
  );
  return (
    <Screen testID="matches" back={() => leavePage(id)} width="page" gap={phone ? 16 : z(28)} footer={footer}
      sheet={tiebreak && tied.length > 1 ? (
        <Tiebreak tied={tied} favorites={favorite ? { [favorite]: 1 } : {}} mine={favorite} required={required} seed={key} onPick={setFavorite} onClose={() => setTiebreak(false)} />
      ) : undefined}>
      <RoomNotes />
      <View style={{ gap: 4, alignItems: phone ? 'flex-start' : 'center' }}>
        <GText bold size={phone ? 28 : z(40)} style={{ letterSpacing: -1.1, textAlign: phone ? 'left' : 'center' }}>What are we watching now?</GText>
        <GText size={phone ? 14 : z(15)} color={glow.soft} style={{ textAlign: phone ? 'left' : 'center', maxWidth: z(600) }}>{sub}</GText>
      </View>
      {one ? <SingleMatch {...props(one)} /> : count ? (
        <View style={{ gap: phone ? 8 : z(10), width: phone ? '100%' : Math.min(max, z(920)), alignSelf: 'center' }}>
          {matches.map((c) => <MatchRow key={c.id} {...props(c)} />)}
        </View>
      ) : null}
    </Screen>
  );
}
