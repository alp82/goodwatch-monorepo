/**
 * Tonight (direction D): the decided poster and its details side by side on wide windows (stacked on
 * narrow ones) over the poster itself, blurred, fading and settling in. The watch button goes to the
 * first switched-on service that has it. Tapping or holding the poster cheers (an easter egg, no
 * button or hint: everyone sees it, and the marquee lights when everyone holds). The host can start
 * again; everyone else sees who can.
 */
import { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { continuousApi } from '../../core/continuous/api';
import { useReducedMotion } from '../../components/ui';
import { CheerLayer, usePosterCheer, usePosterSpring, type PosterRect } from '../glow/cheer/CheerLayer';
import { FadeImage } from '../glow/FadeImage';
import { gwScore, sourceScores } from '../glow/score-format';
import { ScorePill, SourceChips } from '../glow/scores';
import { CLAPPER_HEIGHT, FilmReveal } from '../glow/Reveal';
import { goodwatchTitleUrl, roomWatchLinks } from '../glow/watch-links';
import { GText, Icon, Press, glow, grow, native } from '../glow/theme';
import { FaceStack } from '../shell/parts';
import { useLayout } from '../shell/layout';
import { useBackAction } from '../shell/sheet-back';
import { warm } from '../shell/tokens';
import { meta } from './Decide';
import { toRooms } from './nav';
import { useRoom, useRoomLive } from './RoomProvider';
import { RoomNotes } from './RoomStatus';
import { Actions, Screen, usePinnedActions } from './ui';

/** Decisions whose film reveal already ran in this app session; reopening shows it settled. */
const revealed = new Set<string>();
/** A decision older than this opens settled. */
const REVEAL_FRESH_MS = 10 * 60_000;
// Expo Link's asChild uses HTML attributes; RN Web Pressable needs hrefAttrs.
const externalAttrs = Platform.OS === 'web' ? { hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } } : {};

/** The poster, blurred, behind everything: it fades in and settles from a slight zoom instead of appearing at once. */
function TonightGlow({ uri }: { uri: string }) {
  const reduced = useReducedMotion();
  const [enter] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    if (reduced) { enter.setValue(1); return; }
    Animated.timing(enter, { toValue: 1, duration: 1400, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [enter, reduced]);
  return (
    <View testID="tonight-glow" pointerEvents="none" accessible={false} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      <Animated.View style={{ position: 'absolute', left: -40, right: -40, top: -40, bottom: -40, opacity: enter, transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [1.12, 1] }) }] }}>
        <Image source={{ uri }} accessible={false} resizeMode="cover" blurRadius={18} style={{ width: '100%', height: '100%', opacity: 0.55 }} />
      </Animated.View>
      <LinearGradient colors={['#07070766', '#070707b3', glow.bg]} locations={[0, 0.55, 1]} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
    </View>
  );
}

export function Tonight() {
  const { state, view, cmd, disabled, setActivityView } = useRoom();
  const { snapshot, cheerHolders, cheerEvents } = useRoomLive();
  // Cheers travel on the matches view.
  useFocusEffect(useCallback(() => { setActivityView('matches'); }, [setActivityView]));
  useBackAction(toRooms);
  const shared = snapshot?.shared;
  const decision = shared?.decision ?? null;
  const c = view?.decision ?? null;
  const country = shared?.screens.find((s) => s.confirmed)?.country;
  const metadata = useQuery({ queryKey: ['continuous-metadata', country ?? undefined], queryFn: () => continuousApi.metadata(country || undefined), enabled: Boolean(country), staleTime: 300_000 });
  const reduced = useReducedMotion();
  const key = shared && decision ? `${shared.roomId}:${shared.generation}:${decision.decidedAt}` : '';
  const [play] = useState(() => Boolean(key) && !revealed.has(key) && state.activityNow() - (decision?.decidedAt ?? 0) < REVEAL_FRESH_MS);
  const onPlay = useCallback(() => { revealed.add(key); }, [key]);
  const [poster, setPoster] = useState<PosterRect>({ x: 0, y: 0, width: 0, height: 0 });
  const spring = usePosterSpring(reduced);
  const selfDropped = Boolean(view?.me.dropped);
  const enabled = state.connection === 'live' && !selfDropped;
  const gesture = usePosterCheer({ enabled, send: state.cheer, spring });
  const { phone, wide, height, header, max, z } = useLayout();
  const pinned = usePinnedActions();
  if (!view || !shared || !decision || !c) return null;
  const holders = new Map(cheerHolders);
  if (gesture.holding) holders.set(view.me.id, gesture.seed);
  const required = view.people.map((p) => p.id);
  const allHold = enabled && required.length > 0 && required.every((id) => holders.has(id));
  const watch = roomWatchLinks(decision.availability, shared.screens, metadata.data)[0];
  const watchUrl = watch?.url ?? goodwatchTitleUrl(c.identity);
  const watchButton = (
    <Link href={watchUrl as `https://${string}`} target="_blank" rel="noopener noreferrer" asChild>
      <Pressable {...externalAttrs} accessibilityRole="link" accessibilityLabel={watch ? `${watch.action} ${watch.name}` : 'Where to watch'}
        style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: z(56), borderRadius: 12, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, backgroundColor: glow.amber }}>
        {watch?.logoUrl ? <Image source={{ uri: watch.logoUrl }} accessible={false} style={{ width: z(26), height: z(26), borderRadius: 6 }} /> : null}
        <GText bold size={z(17)} color={warm.ink} lines={1}>{watch ? `${watch.action} ${watch.name}` : 'Where to watch'}</GText>
      </Pressable>
    </Link>
  );
  const again = view.isHost
    ? <Press label="Start again" disabled={disabled} onPress={() => void cmd.restart()} style={{ ...grow(40), alignSelf: wide ? 'flex-start' : 'center' }}><GText bold size={z(15)} color={glow.muted}>Start again</GText></Press>
    : <View style={{ minHeight: 40, justifyContent: 'center' }}><GText size={z(13)} color={glow.muted} style={{ textAlign: wide ? 'left' : 'center' }}>{`${view.hostName || 'The host'} can start again`}</GText></View>;
  const pw = wide ? Math.min(z(400), (height - header - z(96) - CLAPPER_HEIGHT) / 1.5, max * 0.4) : Math.min(phone ? 230 : 300, max * 0.62);
  const titleSize = wide ? z(64) : 34;
  const posterBlock = (
    <View>
      <View onLayout={(e) => { const l = e.nativeEvent.layout; if (l.width > 0) setPoster({ x: l.x, y: l.y + CLAPPER_HEIGHT, width: l.width, height: l.height - CLAPPER_HEIGHT }); }}>
        <Pressable testID="tonight-poster" accessibilityRole="button" accessibilityLabel={`Cheer for ${c.title}`}
          disabled={!enabled} {...gesture.pressHandlers} style={{ cursor: enabled ? 'pointer' : 'auto' } as object}>
          <Animated.View style={{ transform: [{ scale: spring.scale }] }}>
            <FilmReveal width={pw} height={pw * 1.5} play={play} onPlay={onPlay}>
              {c.posterUrl ? <FadeImage source={{ uri: c.posterUrl }} accessibilityLabel={`${c.title} poster`} style={{ width: '100%', height: '100%' }} />
                : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Icon name="tickets" size={48} color={glow.amber} /></View>}
            </FilmReveal>
          </Animated.View>
        </Pressable>
      </View>
      {poster.width > 0 ? <CheerLayer poster={poster} events={cheerEvents} holders={holders} allHold={allHold} reduced={reduced} selfId={view.me.id} onBurst={() => spring.kick(0.006)} /> : null}
    </View>
  );
  const info = (
    <View style={{ gap: z(14), alignItems: wide ? 'flex-start' : 'center' }}>
      <GText bold size={titleSize} style={{ letterSpacing: -1.6, lineHeight: titleSize * 1.02, textAlign: wide ? 'left' : 'center' }}>{c.title}</GText>
      <GText size={z(15)} color={glow.soft}>{meta(c)}</GText>
      {gwScore(c.goodwatchScore) !== null || sourceScores(c.scores) ? (
        <View testID="tonight-scores" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: wide ? 'flex-start' : 'center', gap: 6 }}>
          <ScorePill score={c.goodwatchScore} size="L" />
          <SourceChips scores={c.scores} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><FaceStack people={view.faces} size={z(24)} max={6} /><GText size={z(13)} color={glow.muted}>Everyone agreed</GText></View>
    </View>
  );
  const glowLayer = c.posterUrl ? <TonightGlow uri={c.posterUrl} /> : null;
  if (wide) {
    return (
      <Screen testID="tonight" back={toRooms} width="page" backdrop={glowLayer}>
        <RoomNotes />
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: z(64) }}>
          {posterBlock}
          <View style={{ flex: 1, maxWidth: z(580), gap: z(30), paddingTop: CLAPPER_HEIGHT + z(12) }}>
            {info}
            <View style={{ width: Math.min(z(380), max - pw - z(64)), gap: 8 }}><Actions>{watchButton}</Actions>{again}</View>
          </View>
        </View>
      </Screen>
    );
  }
  return (
    <Screen testID="tonight" back={toRooms} width="page" backdrop={glowLayer} footer={pinned ? <Actions>{watchButton}</Actions> : undefined}>
      <RoomNotes />
      <View style={{ alignItems: 'center', gap: phone ? 16 : 22 }}>
        {posterBlock}
        {info}
        {!pinned ? <Actions style={{ alignSelf: 'stretch' }}>{watchButton}</Actions> : null}
        {again}
      </View>
    </Screen>
  );
}
