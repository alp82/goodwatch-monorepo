import { FadeImage } from './FadeImage';
import { useLayoutEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GText, Icon, Press, Score, glow, s, native } from './theme';
import { useDrag } from './useDrag';
import type { GesturePhase, GlowTitle } from './model';
export function Poster({
  title,
  width,
  height,
  mode,
  showText = true,
  disabled,
  onVote,
  onBrowse,
  onDetails,
  onTrailer,
  onGesture,
}: {
  title: GlowTitle;
  width: number;
  height: number;
  mode: 'voting' | 'matches' | 'decided';
  showText?: boolean;
  disabled: boolean;
  onVote: (yes: boolean) => void;
  onBrowse: (direction: number) => void;
  onDetails: () => void;
  onTrailer: () => void;
  onGesture: (phase: GesturePhase) => void;
}) {
  const [detailsFocused, setDetailsFocused] = useState(false);
  const latch = useRef(false);
  const [animating, setAnimating] = useState(false);
  const drag = useDrag({
    disabled: disabled || animating || mode === 'decided',
    onTap: onDetails,
    onGesture,
    onRelease: (dx, velocity) => {
      if (Math.abs(dx) < width * 0.18 && Math.abs(velocity) < 0.5) {
        drag.recenter();
        return;
      }
      if (latch.current) {
        drag.recenter();
        return;
      }
      latch.current = true;
      setAnimating(true);
      drag.transition(Math.sign(dx), width, () => {
        if (mode === 'voting') onVote(dx > 0);
        else onBrowse(dx < 0 ? 1 : -1);
        latch.current = false;
        setAnimating(false);
      });
    },
  });
  const reset = drag.reset;
  // A server card replacement must cancel the prior external animation.
  useLayoutEffect(() => {
    latch.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnimating(false);
    reset();
  }, [title.id, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View
      testID="poster"
      style={{
        width,
        height,
        borderRadius: 24,
        backgroundColor: '#242424',
        shadowColor: '#000',
        shadowOpacity: 0.6,
        shadowRadius: 32,
        shadowOffset: { width: 0, height: 16 },
        transform: [
          { translateX: drag.x },
          {
            rotate: drag.x.interpolate({
              inputRange: [-width, 0, width],
              outputRange: ['-10deg', '0deg', '10deg'],
            }),
          },
        ],
      }}
    >
      <View
        {...drag.pan}
        accessibilityLabel={`${title.title}. Swipe or use the choice buttons.`}
        style={{
          flex: 1,
          overflow: 'hidden',
          borderRadius: 24,
          borderWidth: 1,
          borderColor: '#ffffff26',
        }}
      >
        {title.posterUrl ? (
          <FadeImage
            testID="poster-art"
            source={{ uri: title.posterUrl }}
            resizeMode="cover"
            style={s.absolute}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View
            style={[s.absolute, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}
          >
            <Icon name="tickets" size={48} color={glow.muted} />
            <GText size={24} bold style={{ textAlign: 'center', marginTop: 12 }}>
              {title.title}
            </GText>
          </View>
        )}
        <LinearGradient
          colors={['transparent', '#00000030', '#000000ed']}
          locations={[0, 0.5, 1]}
          style={s.absolute}
          pointerEvents="none"
        />
        {showText && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 18,
              right: 18,
              bottom: 16,
              gap: 5,
            }}
          >
            <GText bold size={Math.min(30, width * 0.105)} lines={2}>
              {title.title}
            </GText>
            <GText color="#dedede" size={13} style={{ marginTop: 5 }}>
              {[
                title.year,
                title.kind === 'movie'
                  ? 'Movie'
                  : title.kind === 'show_start'
                  ? 'New series'
                  : 'Continue series',
                title.episodeLabel,
                title.runtimeMinutes ? `${title.runtimeMinutes} min` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </GText>
            <View
              style={{
                flexDirection: 'row',
                gap: 9,
                alignItems: 'center',
                height: 44,
                marginRight: title.trailerUrl ? 122 : 0,
              }}
            >
              {title.score !== null && <Score value={title.score} size={32} />}
              <GText size={11} bold lines={1} color={glow.soft}>
                {title.genres.join(' · ').toUpperCase()}
              </GText>
            </View>
          </View>
        )}
        {mode === 'voting' && (
          <>
            <Animated.View
              testID="stamp-yep"
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                position: 'absolute',
                top: 28,
                left: 18,
                backgroundColor: '#15803d',
                borderRadius: 12,
                paddingHorizontal: 20,
                paddingVertical: 10,
                transform: [{ rotate: '-14deg' }],
                opacity: drag.x.interpolate({
                  inputRange: [0, 25, 85],
                  outputRange: [0, 0.35, 1],
                  extrapolate: 'clamp',
                }),
              }}
            >
              <GText size={40} bold>
                YEP
              </GText>
            </Animated.View>
            <Animated.View
              testID="stamp-nope"
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                position: 'absolute',
                top: 28,
                right: 18,
                backgroundColor: '#dc2626',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 10,
                transform: [{ rotate: '14deg' }],
                opacity: drag.x.interpolate({
                  inputRange: [-85, -25, 0],
                  outputRange: [1, 0.35, 0],
                  extrapolate: 'clamp',
                }),
              }}
            >
              <GText size={40} bold>
                NOPE
              </GText>
            </Animated.View>
          </>
        )}
      </View>
      {title.trailerUrl && (
        <Press
          label="Watch trailer"
          onPress={onTrailer}
          style={{
            position: 'absolute',
            right: 14,
            bottom: 16,
            borderRadius: 999,
            paddingHorizontal: showText ? 18 : 24,
            minHeight: showText ? 46 : 56,
            flexDirection: 'row',
            gap: 8,
            backgroundColor: '#fff',
          }}
        >
          <View
            style={{
              width: showText ? 30 : 34,
              height: showText ? 30 : 34,
              borderRadius: 20,
              backgroundColor: '#dc2626',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="play" size={16} color="#fff" />
          </View>
          <GText bold color="#151515" size={14}>
            {showText ? 'Trailer' : 'Play trailer'}
          </GText>
        </Press>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Details about ${title.title}`}
        onPress={onDetails}
        onFocus={() => setDetailsFocused(true)}
        onBlur={() => setDetailsFocused(false)}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          minWidth: 44,
          height: 36,
          borderRadius: 12,
          paddingHorizontal: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: native || detailsFocused ? '#0007' : 'transparent',
        }}
      >
        {(native || detailsFocused) && <GText size={11}>Details</GText>}
      </Pressable>
    </Animated.View>
  );
}
