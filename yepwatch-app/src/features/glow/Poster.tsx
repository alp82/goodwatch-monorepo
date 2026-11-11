/**
 * The voting card: poster, score and services, title and meta, Details and Trailer. It follows the
 * stage's drag (`x`, `y`) and tilts with it; the look's layers slot in around the poster: `halo`
 * behind the card, `under` between the poster and the title gradient, `over` above everything.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, View, type GestureResponderHandlers } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { playFeedback } from '../feedback/sounds';
import { FadeImage } from './FadeImage';
import { ScorePill } from './scores';
import { GText, Icon, Press, glow, grow, native, s } from './theme';
import type { GlowTitle } from './model';

export const titleMeta = (title: GlowTitle) => [
  title.year,
  title.kind === 'movie' ? 'Movie' : title.kind === 'show_start' ? 'New series' : 'Continue series',
  title.episodeLabel,
  title.runtimeMinutes ? `${title.runtimeMinutes} min` : null,
].filter(Boolean).join(' · ');

export function Poster({ title, width, height, phone, z, showText = true, x, y, pan, halo, under, over, look, services, leaving = false, onDetails, onTrailer }: {
  title: GlowTitle;
  width: number;
  height: number;
  phone: boolean;
  z: (n: number) => number;
  showText?: boolean;
  /** The drag: the card follows it and tilts. */
  x: Animated.Value;
  y: Animated.Value;
  pan: GestureResponderHandlers;
  halo?: ReactNode;
  under?: ReactNode;
  over?: ReactNode;
  /** The card's look (exposed on the web for checks). */
  look?: string;
  /** The room's services this title is on. */
  services?: ReactNode;
  /** An answered card flying off: it looks the same, but it isn't the voting card (no test id or name) and its buttons answer nothing. */
  leaving?: boolean;
  onDetails: () => void;
  onTrailer: () => void;
}) {
  const [detailsFocused, setDetailsFocused] = useState(false);
  const previous = useRef(title.id);
  useLayoutEffect(() => {
    if (previous.current !== title.id) playFeedback('poster');
    previous.current = title.id;
  }, [title.id]);
  return (
    <Animated.View
      testID={leaving ? 'poster-leaving' : 'poster'}
      {...(native ? null : ({ dataSet: { look } } as object))}
      style={{
        width,
        height,
        transform: [
          { translateX: x },
          { translateY: y },
          { rotate: x.interpolate({ inputRange: [-width, 0, width], outputRange: ['-16deg', '0deg', '16deg'] }) },
        ],
      }}
    >
      {halo}
      <View
        {...pan}
        accessibilityLabel={leaving ? undefined : `${title.title}. Swipe or use the choice buttons.`}
        style={[{
          flex: 1,
          overflow: 'hidden',
          borderRadius: 14,
          backgroundColor: '#1a1610',
          borderWidth: 1,
          borderColor: '#ffffff24',
          boxShadow: '0 16px 32px #00000099',
        }, native ? null : ({ cursor: 'grab', touchAction: 'none', userSelect: 'none' } as object)]}
      >
        {title.posterUrl ? (
          <FadeImage testID="poster-art" source={{ uri: title.posterUrl }} resizeMode="cover" style={s.absolute} accessibilityIgnoresInvertColors />
        ) : (
          <View style={[s.absolute, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
            <Icon name="tickets" size={48} color={glow.muted} />
            <GText size={24} bold style={{ textAlign: 'center', marginTop: 12 }}>{title.title}</GText>
          </View>
        )}
        {under}
        <LinearGradient colors={['transparent', '#000000d9']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: height * 0.42 }} pointerEvents="none" />
        {showText && (
          <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 16, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ScorePill score={title.score} size={phone ? 'M' : 'L'} />
              {services}
            </View>
            <GText bold size={phone ? Math.min(26, width * 0.09) : z(32)} lines={2} style={{ letterSpacing: -0.7 }}>{title.title}</GText>
            <GText size={z(14)} color={glow.soft} lines={1}>{titleMeta(title)}</GText>
          </View>
        )}
        {over}
        {/* Catches the pointer above the image so the browser never starts an image drag. */}
        <View style={s.absolute} />
      </View>
      {title.trailerUrl && (
        <Press label="Watch trailer" onPress={onTrailer} quiet={leaving}
          style={{ position: 'absolute', right: 16, top: 14, ...grow(44) }}
          visual={{ borderRadius: 10, paddingHorizontal: 12, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff' }}>
          <View style={{ width: 30, height: 30, borderRadius: 20, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="play" size={16} color="#fff" />
          </View>
          <GText bold color="#151515" size={14}>Trailer</GText>
        </Press>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Details about ${title.title}`}
        disabled={leaving}
        onPress={onDetails}
        onFocus={() => setDetailsFocused(true)}
        onBlur={() => setDetailsFocused(false)}
        // The press area is the full touch target; the amber box inside keeps its 44 px look.
        style={{ position: 'absolute', left: 16, top: 14, ...grow(44), justifyContent: 'center' }}
      >
        <View style={{
          minWidth: 44, height: 44, borderRadius: 12, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center',
          backgroundColor: detailsFocused ? '#fbbf24' : '#fbbf24df', borderWidth: 1, borderColor: '#fff5', flexDirection: 'row', gap: 5,
        }}>
          <GText size={14} bold color="#18130a">Details ↗</GText>
        </View>
      </Pressable>
    </Animated.View>
  );
}
