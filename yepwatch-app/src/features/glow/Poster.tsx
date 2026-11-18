/**
 * The voting card: poster, score and services, title and meta, Details and Trailer. It follows the
 * stage's drag (`x`, `y`) and tilts with it; the look's layers slot in around the poster: `halo`
 * behind the card, `under` between the poster and the title gradient, `over` above everything.
 */
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Animated, StyleSheet, View, type GestureResponderHandlers, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { playFeedback } from '../feedback/sounds';
import { FadeImage } from './FadeImage';
import { ScorePill } from './scores';
import { GText, Icon, glow, native, s } from './theme';
import type { GlowTitle } from './model';
import { TrailerLink } from './TrailerLink';
import { HoverPress } from '../shell/hover';
import { R } from '../shell/tokens';

export const titleMeta = (title: GlowTitle) => [
  title.year,
  title.kind === 'movie' ? 'Movie' : title.kind === 'show_start' ? 'New series' : 'Continue series',
  title.episodeLabel,
  title.runtimeMinutes ? `${title.runtimeMinutes} min` : null,
].filter(Boolean).join(' · ');

export function Poster({ title, width, height, phone, z, showText = true, x, y, pan, halo, under, over, look, services, leaving = false, tools = true, onDetails }: {
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
  /** Its Details and Trailer buttons (off where the screen shows them beside the card). */
  tools?: boolean;
  onDetails: () => void;
}) {
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
        // Web: the answered card flies in a layer of its own, so its frames move pixels instead of repainting the poster.
        ...(leaving && !native ? ({ willChange: 'transform' } as object) : null),
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
        // A named card needs a role for its name (axe aria-prohibited-attr): it reads as the card's picture.
        accessibilityRole={leaving ? undefined : 'image'}
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
        {/* The scrim behind Details and Trailer: a still layer of the card, so it rides the drag without repainting. */}
        {tools && <LinearGradient colors={['#00000052', '#00000000']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: height * 0.2 }} pointerEvents="none" />}
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
      {tools && title.trailerUrl && (
        <PosterChip trailer={title.trailerUrl} disabled={leaving} onPoster style={{ position: 'absolute', right: 16, top: 14 }} />
      )}
      {tools && (
        <PosterChip details={`Details about ${title.title}`} onPress={onDetails} disabled={leaving} onPoster style={{ position: 'absolute', left: 16, top: 14 }} />
      )}
    </Animated.View>
  );
}

const same = (n: number) => n;

type ChipAction = { trailer: string | null; details?: never; onPress?: never } | { details: string; onPress: () => void; trailer?: never };

/**
 * Details or Trailer for the voting card: quiet dark glass, white text, a soft shadow, on both
 * widths. `onPoster` draws it over the poster art (phones and in-between widths); otherwise it sits beside the
 * card. The chip is 40 px tall inside a press area of at least 48 px. `trailer` opens YouTube outside the app;
 * `details` is the Details chip's accessible name.
 */
export function PosterChip({ disabled = false, onPoster = false, z = same, style, ...action }: ChipAction & {
  disabled?: boolean;
  onPoster?: boolean;
  z?: (n: number) => number;
  style?: StyleProp<ViewStyle>;
}) {
  const look: ViewStyle = {
    height: z(40), paddingHorizontal: z(12), borderRadius: R.control, flexDirection: 'row', alignItems: 'center', gap: z(8),
    backgroundColor: onPoster ? '#000000a6' : '#ffffff0d', borderWidth: 1, borderColor: onPoster ? '#ffffff33' : '#ffffff2a',
    boxShadow: '0 2px 8px #0000004d',
  };
  // One flat style: the trailer's Link hands it to the web element as is.
  const area = StyleSheet.flatten([{ minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' }, style]);
  if (action.details === undefined) {
    const face = (
      <>
        <View style={{ width: z(22), height: z(22), borderRadius: z(11), backgroundColor: glow.nope, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="play" size={z(12)} color="#fff" />
        </View>
        <GText bold size={z(14)} color={glow.ink}>Trailer</GText>
      </>
    );
    // Without a trailer to open it's only the look: a card flying off, or a place kept beside the card.
    if (!action.trailer || disabled) return <View style={area}><View style={look}>{face}</View></View>;
    return <TrailerLink url={action.trailer} style={area} visual={look}>{face}</TrailerLink>;
  }
  return (
    // A card flying off keeps its look; beside the card, a chip with no card to act on dims.
    <HoverPress label={action.details} disabled={disabled} dim={!onPoster} onPress={action.onPress} style={area} visual={look}>
      <Icon name="external" size={z(13)} color={glow.ink} />
      <GText bold size={z(14)} color={glow.ink}>Details</GText>
    </HoverPress>
  );
}
