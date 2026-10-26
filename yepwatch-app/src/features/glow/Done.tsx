import { useCallback, useState, type ComponentProps } from 'react';
import { Animated, Pressable, View } from 'react-native';
import type { CheerEvent } from '../../core/continuous/cheers';
import { useReducedMotion } from '../../components/ui';
import { column } from '../shell/tokens';
import { CheerLayer, usePosterCheer, usePosterSpring, type PosterRect } from './cheer/CheerLayer';
import { titleYear } from './decision-model';
import { FadeImage } from './FadeImage';
import type { GlowTitle } from './model';
import { CLAPPER_HEIGHT, FilmReveal } from './Reveal';
import { GText, Icon, Press, glow } from './theme';
import { WatchLinks } from './WatchLinks';

/** Decisions whose film reveal already ran in this app session; Back, review and reopening show it settled. */
const revealed = new Set<string>();
/** A decision older than this opens settled (from History or a later visit). */
const REVEAL_FRESH_MS = 10 * 60_000;

export interface TonightCheer {
  /** Live, foreground, and you're still in the room. Taps and holds are sent only then. */
  enabled: boolean;
  send: (kind: 'tap' | 'hold' | 'release', seed: number) => void;
  events: readonly CheerEvent[];
  /** Peers holding now (participantId -> episode seed). Your own hold is added here. */
  peers: ReadonlyMap<string, number>;
  selfId: string;
  /** Non-dropped participants; the Marquee bonus needs every one of them holding. */
  required: string[];
}

/**
 * The final decision. Only rendered for a confirmed server decision after its fresh availability
 * check. The choice is final: no Keep swiping; only the host's Start again begins a new round.
 */
export function Done({ title, decisionKey, decidedAt, serverNow, watch, startAgain, ownerName, cheer }: {
  title: GlowTitle;
  decisionKey: string;
  decidedAt: number;
  serverNow: number;
  watch: Omit<ComponentProps<typeof WatchLinks>, 'compact'>;
  /** Host only: opens the prefilled settings for the next round. */
  startAgain?: () => void;
  ownerName: string | null;
  cheer: TonightCheer;
}) {
  const reduced = useReducedMotion();
  const [play] = useState(() => !revealed.has(decisionKey) && serverNow - decidedAt < REVEAL_FRESH_MS);
  const onPlay = useCallback(() => { revealed.add(decisionKey); }, [decisionKey]);
  const [area, setArea] = useState({ width: 390, height: 500 });
  const [poster, setPoster] = useState<PosterRect>({ x: 0, y: 0, width: 0, height: 0 });
  /** Measured title + links + Start again; the poster takes what is left, so nothing clips or scrolls. */
  const [actions, setActions] = useState(300);
  // Short windows put the poster beside the actions so nothing clips.
  const side = area.height < 440 && area.width >= 500;
  const compact = area.height < 560;
  const ph = side
    ? Math.max(90, Math.min(area.height - 32 - CLAPPER_HEIGHT, 300))
    : Math.max(90, Math.min(360, area.height - actions - (compact ? 8 : 14) - CLAPPER_HEIGHT - 8));
  const spring = usePosterSpring(reduced);
  const gesture = usePosterCheer({ enabled: cheer.enabled, send: cheer.send, spring });
  const holders = new Map(cheer.peers);
  if (gesture.holding) holders.set(cheer.selfId, gesture.seed);
  const allHold = cheer.enabled && cheer.required.length > 0 && cheer.required.every((id) => holders.has(id));
  return (
    <View testID="tonight" onLayout={(e) => setArea({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      style={{ ...column, flex: 1, minHeight: 0, overflow: 'hidden', flexDirection: side ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: side ? 28 : compact ? 8 : 14 }}>
      <View onLayout={(e) => { const l = e.nativeEvent.layout; setPoster({ x: l.x, y: l.y + CLAPPER_HEIGHT, width: l.width, height: l.height - CLAPPER_HEIGHT }); }}>
        <Pressable testID="tonight-poster" accessibilityRole="button" accessibilityLabel={`Cheer for ${titleYear(title)}`} accessibilityHint="Everyone in the room sees it. Hold to keep cheering."
          disabled={!cheer.enabled} {...gesture.pressHandlers} style={{ cursor: cheer.enabled ? 'pointer' : 'auto' } as object}>
          <Animated.View style={{ transform: [{ scale: spring.scale }] }}>
            <FilmReveal width={ph / 1.5} height={ph} play={play} onPlay={onPlay}>
              {title.posterUrl ? <FadeImage source={{ uri: title.posterUrl }} accessibilityLabel={`${titleYear(title)} poster`} style={{ width: '100%', height: '100%' }} />
                : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Icon name="tickets" size={48} color={glow.amber} /></View>}
            </FilmReveal>
          </Animated.View>
        </Pressable>
      </View>
      <View onLayout={(e) => setActions(e.nativeEvent.layout.height)} style={{ width: side ? undefined : '100%', flex: side ? 1 : undefined, alignItems: 'center', gap: 8 }}>
        <GText size={compact ? 24 : 30} bold color={glow.amber} lines={2} style={{ textAlign: 'center', letterSpacing: -0.7 }}>{titleYear(title)}</GText>
        {title.episodeLabel && <GText size={14} color={glow.soft}>{title.episodeLabel}</GText>}
        <View style={{ width: '100%', gap: 8 }}>
          <WatchLinks {...watch} compact={compact} />
          {startAgain
            ? <Press label="Start again" onPress={startAgain} style={{ minHeight: 44 }}><GText bold color={glow.muted} size={14}>Start again</GText></Press>
            : ownerName ? <GText size={12} color={glow.muted} style={{ textAlign: 'center', paddingVertical: 12 }}>{ownerName} can start again</GText> : null}
        </View>
      </View>
      {poster.width > 0 && (
        <CheerLayer poster={poster} events={cheer.events} holders={holders} allHold={allHold} reduced={reduced} selfId={cheer.selfId} onBurst={() => spring.kick(0.006)} />
      )}
    </View>
  );
}
