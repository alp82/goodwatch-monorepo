/**
 * Tonight: the decided title with its scores and the watch button for the first switched-on service
 * that has it. Tapping or holding the poster cheers (an easter egg, no button or hint: everyone sees
 * it, and the marquee lights when everyone holds). The host can start again; everyone else sees who can.
 */
import { useCallback, useState } from 'react';
import { Animated, BackHandler, Image, Platform, Pressable, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { continuousApi } from '../../core/continuous/api';
import { useReducedMotion } from '../../components/ui';
import { CheerLayer, usePosterCheer, usePosterSpring, type PosterRect } from '../glow/cheer/CheerLayer';
import { FadeImage } from '../glow/FadeImage';
import { gwScore, sourceScores } from '../glow/score-format';
import { ScorePill, SourceChips } from '../glow/scores';
import { CLAPPER_HEIGHT, FilmReveal } from '../glow/Reveal';
import { goodwatchTitleUrl, roomWatchLinks } from '../glow/watch-links';
import { GText, Icon, Press, glow } from '../glow/theme';
import { FaceStack } from '../shell/parts';
import { meta } from './Decide';
import { toRooms } from './nav';
import { RoomBar } from './parts';
import { useRoom } from './RoomProvider';
import { RoomNotes } from './RoomStatus';
import { Screen, Small } from './ui';

/** Decisions whose film reveal already ran in this app session; reopening shows it settled. */
const revealed = new Set<string>();
/** A decision older than this opens settled. */
const REVEAL_FRESH_MS = 10 * 60_000;
// Expo Link's asChild uses HTML attributes; RN Web Pressable needs hrefAttrs.
const externalAttrs = Platform.OS === 'web' ? { hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } } : {};

export function Tonight() {
  const { state, snapshot, view, cmd, disabled, setActivityView } = useRoom();
  // Cheers travel on the matches view.
  useFocusEffect(useCallback(() => {
    setActivityView('matches');
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { toRooms(); return true; });
    return () => sub.remove();
  }, [setActivityView]));
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
  if (!view || !shared || !decision || !c) return null;
  const holders = new Map(state.cheerHolders);
  if (gesture.holding) holders.set(view.me.id, gesture.seed);
  const required = view.people.map((p) => p.id);
  const allHold = enabled && required.length > 0 && required.every((id) => holders.has(id));
  const watch = roomWatchLinks(decision.availability, shared.screens, metadata.data)[0];
  const watchUrl = watch?.url ?? goodwatchTitleUrl(c.identity);
  const ph = 300;
  return (
    <Screen testID="tonight" back={toRooms} right={<RoomBar />}
      footer={<>
        <Link href={watchUrl as `https://${string}`} target="_blank" rel="noopener noreferrer" asChild>
          <Pressable {...externalAttrs} accessibilityRole="link" accessibilityLabel={watch ? `${watch.action} ${watch.name}` : 'Where to watch'}
            style={{ height: 56, borderRadius: 10, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: glow.amber }}>
            {watch?.logoUrl ? <Image source={{ uri: watch.logoUrl }} accessible={false} style={{ width: 24, height: 24, borderRadius: 6 }} /> : null}
            <GText bold size={17} color="#201400">{watch ? `${watch.action} ${watch.name}` : 'Where to watch'}</GText>
          </Pressable>
        </Link>
        {view.isHost
          ? <Press label="Start again" disabled={disabled} onPress={() => void cmd.restart()} style={{ minHeight: 40 }}><GText bold color={glow.muted}>Start again</GText></Press>
          : <View style={{ minHeight: 40, alignItems: 'center', justifyContent: 'center' }}><Small>{`${view.hostName || 'The host'} can start again`}</Small></View>}
      </>}
>
      <RoomNotes />
      <View style={{ alignItems: 'center', gap: 14, paddingTop: 4 }}>
        <View onLayout={(e) => { const l = e.nativeEvent.layout; if (l.width > 0) setPoster({ x: l.x, y: l.y + CLAPPER_HEIGHT, width: l.width, height: l.height - CLAPPER_HEIGHT }); }}>
          <Pressable testID="tonight-poster" accessibilityRole="button" accessibilityLabel={`Cheer for ${c.title}`}
            disabled={!enabled} {...gesture.pressHandlers} style={{ cursor: enabled ? 'pointer' : 'auto' } as object}>
            <Animated.View style={{ transform: [{ scale: spring.scale }] }}>
              <FilmReveal width={ph / 1.5} height={ph} play={play} onPlay={onPlay}>
                {c.posterUrl ? <FadeImage source={{ uri: c.posterUrl }} accessibilityLabel={`${c.title} poster`} style={{ width: '100%', height: '100%' }} />
                  : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Icon name="tickets" size={48} color={glow.amber} /></View>}
              </FilmReveal>
            </Animated.View>
          </Pressable>
        </View>
        <GText bold size={30} style={{ textAlign: 'center', letterSpacing: -0.8 }}>{c.title}</GText>
        <Small>{meta(c)}</Small>
        {gwScore(c.goodwatchScore) !== null || sourceScores(c.scores) ? (
          <View testID="tonight-scores" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <ScorePill score={c.goodwatchScore} size="L" />
            <SourceChips scores={c.scores} />
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><FaceStack people={view.faces} size={24} max={6} /><Small>Everyone agreed</Small></View>
        {poster.width > 0 ? <CheerLayer poster={poster} events={state.cheerEvents} holders={holders} allHold={allHold} reduced={reduced} selfId={view.me.id} onBurst={() => spring.kick(0.006)} /> : null}
      </View>
    </Screen>
  );
}
