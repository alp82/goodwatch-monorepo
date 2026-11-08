import { Text, type StyleProp, type TextStyle } from 'react-native';
import { TRACK } from './geometry';
import { web, webText } from './paint';

/** A display word in Gabarito Bold. The line box equals the font size, so the caps sit centered. */
export function Word({ text, size, color, style }: { text: string; size: number; color: string; style?: StyleProp<TextStyle> }) {
  return (
    <Text
      accessible={false}
      // Native clips instead of wrapping; the web keeps one line without clipping its glow.
      numberOfLines={web ? undefined : 1}
      ellipsizeMode="clip"
      style={[{ fontFamily: 'GabaritoBold', fontSize: size, lineHeight: size, letterSpacing: TRACK * size, color, textAlign: 'center', includeFontPadding: false }, webText({ whiteSpace: 'nowrap', userSelect: 'none' }), style]}
    >
      {text}
    </Text>
  );
}
