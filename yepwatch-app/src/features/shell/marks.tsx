/**
 * Existing artwork, not new glyphs.
 * GoodWatch mark: assets/goodwatch-mark.png, the asset of the approved glow/GoodWatchSignIn button.
 * Apple / Android: same paths as the store logos on the approved YepWatch landing (the earlier landing page).
 */
import { Image } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

export function GoodWatchMark({ size = 24 }: { size?: number }) {
  return <Image source={require('../../../assets/goodwatch-mark.png')} accessible={false} style={{ width: size, height: size, borderRadius: size * 0.22 }} />;
}

export function StoreLogo({ platform, size = 26, color = '#fafafa' }: { platform: 'ios' | 'android'; size?: number; color?: string }) {
  return platform === 'android' ? (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill={color} accessible={false}>
      <Path d="m9 8-3-5 1.4-.8L10.6 7a16 16 0 0 1 10.8 0l3.2-4.8L26 3l-3 5c4.3 2.3 7 6.4 7 11H2c0-4.6 2.7-8.7 7-11Z" />
      <Circle cx="9" cy="13" r="1.5" fill="#070707" />
      <Circle cx="23" cy="13" r="1.5" fill="#070707" />
      <Path d="M4 21h24v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z" />
    </Svg>
  ) : (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} accessible={false}>
      <Path d="M17.1 12.3c0-2 1.6-3 1.7-3.1-1-1.5-2.6-1.7-3.1-1.7-1.3-.1-2.5.8-3.2.8-.6 0-1.7-.8-2.7-.8-1.4 0-2.7.8-3.4 2-1.5 2.5-.4 6.3 1 8.4.7 1 1.4 2 2.5 1.9 1 0 1.4-.6 2.7-.6s1.6.6 2.7.6 1.8-1 2.4-1.9c.8-1.1 1.1-2.2 1.1-2.3-.1 0-2.1-.8-2.1-3.3ZM15 6.1c.5-.7 1-1.6.9-2.6-.8 0-1.8.5-2.4 1.2-.5.6-1 1.6-.9 2.5.9.1 1.8-.4 2.4-1.1Z" />
    </Svg>
  );
}
