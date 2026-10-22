import { useState } from 'react';
import { Image, View } from 'react-native';
import type { GlowTitle } from './model';
import { GText, Icon, Pill, Press, glow } from './theme';
/** Only rendered for a confirmed server decision after its fresh availability check. */
export function Done({
  title,
  width,
  height,
  canRestart,
  disabled,
  where,
  restart,
}: {
  title: GlowTitle;
  width: number;
  height: number;
  canRestart: boolean;
  disabled: boolean;
  where: () => void;
  restart: () => void;
}) {
  const wide = width >= 900;
  const [available, setAvailable] = useState(Math.max(0, height - 120));
  const landscape = width > height && height < 500;
  const compact = available < 520;
  const ph = Math.max(
    72,
    Math.min(
      wide ? 420 : 360,
      landscape ? available - 24 : available - (compact ? 300 : 350),
      width * (wide ? 0.3 : 0.56) * 1.5
    )
  );
  const caption = (
    <GText size={14} bold color={glow.amber} style={{ letterSpacing: 2 }}>
      TONIGHT
    </GText>
  );
  return (
    <View
      onLayout={(event) => setAvailable(event.nativeEvent.layout.height)}
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 12,
        gap: compact ? 8 : wide ? 18 : 12,
        flexDirection: landscape ? 'row' : 'column',
      }}
    >
      {!landscape && caption}
      <View
        style={{
          width: ph / 1.5,
          height: ph,
          flexShrink: 0,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: '#fbbf2455',
          backgroundColor: '#222',
          shadowColor: glow.amber,
          shadowRadius: 28,
          shadowOpacity: 0.2,
          shadowOffset: { width: 0, height: 8 },
          overflow: 'hidden',
        }}
      >
        {title.posterUrl ? (
          <Image
            source={{ uri: title.posterUrl }}
            accessibilityLabel={`${title.title} poster`}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="tickets" size={48} color={glow.amber} />
          </View>
        )}
      </View>
      <View
        style={{
          width: landscape ? undefined : '100%',
          flex: landscape ? 1 : undefined,
          maxWidth: 680,
          alignItems: 'center',
          gap: compact ? 8 : wide ? 18 : 12,
        }}
      >
        {landscape && caption}
        <GText
          size={compact ? 24 : wide ? 44 : 30}
          bold
          color={glow.amber}
          lines={2}
          style={{ textAlign: 'center', letterSpacing: -0.7 }}
        >
          {title.title}
        </GText>
        {title.episodeLabel && (
          <GText size={14} color={glow.soft}>
            {title.episodeLabel}
          </GText>
        )}
        <GText size={14} color={glow.muted}>
          Everyone picked it. Enjoy your watch.
        </GText>
        <View style={{ width: '100%', maxWidth: 440, gap: 4, marginTop: compact ? 0 : 6 }}>
          <Pill label="Where to watch" icon="external" gold onPress={where}>
            Where to watch
          </Pill>
          {canRestart && (
            <Press label="Choose again" disabled={disabled} onPress={restart}>
              <GText bold color={glow.muted} size={14}>
                Choose again
              </GText>
            </Press>
          )}
        </View>
      </View>
    </View>
  );
}
