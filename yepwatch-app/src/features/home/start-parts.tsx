/** Pieces shared by the first visit and the returning start page: the headline and the big tiles. */
import Svg, { Path } from 'react-native-svg';
import { View } from 'react-native';
import { GText, Press, glow } from '../glow/theme';
import { useLayout } from '../shell/layout';
import { R, warm } from '../shell/tokens';

export function Headline({ size }: { size: number }) {
  return (
    <GText bold size={size} style={{ letterSpacing: -size * 0.03, lineHeight: size * 1.08 }}>
      Choose something to watch, <GText bold size={size} color={glow.amber}>together.</GText>
    </GText>
  );
}

function Glyph({ d, size, color, weight = 2 }: { d: string; size: number; color: string; weight?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round" accessible={false}><Path d={d} /></Svg>;
}
const PLUS = 'M12 5v14M5 12h14';
const DOOR = 'M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l4-4-4-4M14 12H3';

export interface TileActions {
  newRoom: () => void;
  join: () => void;
  disabled?: boolean;
  /** A room is opening: the tiles rest without dimming. */
  quiet?: boolean;
}

/** The two big start tiles: New room (amber) and Join a room. */
export function Tiles({ newRoom, join, disabled, quiet, height }: TileActions & { height: number }) {
  const { phone, z } = useLayout();
  const box = phone ? 40 : z(52);
  const pad = phone ? 16 : z(24);
  const word = phone ? 22 : z(30);
  const tile = { flex: 1, height, borderRadius: R.card, alignItems: 'flex-start', justifyContent: 'space-between', padding: pad } as const;
  const icon = { width: box, height: box, borderRadius: 12, alignItems: 'center', justifyContent: 'center' } as const;
  return (
    <View style={{ flexDirection: 'row', gap: phone ? 10 : z(16) }}>
      <Press label="New room" onPress={newRoom} disabled={disabled} quiet={quiet} style={{ ...tile, backgroundColor: glow.amber }}>
        <View style={{ ...icon, backgroundColor: '#20140014' }}><Glyph d={PLUS} size={box * 0.58} color={warm.ink} weight={2.4} /></View>
        <GText bold size={word} color={warm.ink} style={{ letterSpacing: -0.6 }}>New room</GText>
      </Press>
      <Press label="Join a room" onPress={join} disabled={disabled} quiet={quiet} style={{ ...tile, backgroundColor: warm.raised, borderWidth: 1, borderColor: warm.lineStrong }}>
        <View style={{ ...icon, backgroundColor: warm.amberSoft }}><Glyph d={DOOR} size={box * 0.54} color={glow.amber} /></View>
        <GText bold size={word} style={{ letterSpacing: -0.6 }}>Join a room</GText>
      </Press>
    </View>
  );
}

export function Or() {
  const { z } = useLayout();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: warm.line }} /><GText size={z(13)} color={glow.muted}>or</GText><View style={{ flex: 1, height: 1, backgroundColor: warm.line }} />
    </View>
  );
}
