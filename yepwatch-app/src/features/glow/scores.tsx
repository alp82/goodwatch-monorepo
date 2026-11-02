/**
 * Scores in the GoodWatch look (see score-format.ts for the website sources): the poster pill (a dark pill holding
 * the score's colored block with the white G), the ring with its verdict word, and the IMDb, Metacritic and Rotten
 * Tomatoes chips in their brand colors.
 */
import type { ReactNode } from 'react';
import { Image, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { Candidate } from '@goodwatch/yepwatch-contracts/proposal';
import { GText, glow } from './theme';
import { BRAND, gwScore, scoreWord, sourceScores, vibeColor } from './score-format';

const G_WHITE = require('../../../assets/goodwatch-logo-white.webp');
const LOGOS = {
  imdb: require('../../../assets/scores/imdb.webp'),
  metacritic: require('../../../assets/scores/metacritic.webp'),
  rotten: require('../../../assets/scores/rotten-tomatoes.webp'),
};

/** The poster pill: the GoodWatch score in its color with the white G. Nothing without a score. */
export function ScorePill({ score, size = 'M' }: { score: number | null | undefined; size?: 'S' | 'M' | 'L' }) {
  const value = gwScore(score);
  if (value === null) return null;
  const h = size === 'S' ? 20 : size === 'M' ? 24 : 28;
  const font = size === 'S' ? 12 : size === 'M' ? 14 : 16;
  return (
    <View accessible accessibilityLabel={`GoodWatch score ${value}`} testID="score-pill"
      style={{ alignSelf: 'flex-start', padding: 2, borderRadius: 6, backgroundColor: '#030712e6', borderWidth: 1, borderColor: '#ffffff1a' }}>
      <View style={{ height: h, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: size === 'L' ? 8 : 5, borderRadius: 5, backgroundColor: vibeColor(value) }}>
        <Image source={G_WHITE} accessible={false} style={{ width: font, height: font }} />
        <GText bold size={font} color="#ffffff" style={{ fontVariant: ['tabular-nums'] }}>{value}</GText>
      </View>
    </View>
  );
}

/** The ring filled to the score, with the verdict and "GoodWatch score" beside it (title pages). */
export function ScoreRing({ score, size = 48 }: { score: number | null | undefined; size?: number }) {
  const value = gwScore(score);
  if (value === null) return null;
  const stroke = size / 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = vibeColor(value);
  return (
    <View accessible accessibilityLabel={`GoodWatch score ${value} of 100, ${scoreWord(value)}`} testID="score-ring" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth={stroke} />
          <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${(value / 100) * c} ${c}`} rotation={-90} origin={`${size / 2}, ${size / 2}`} />
        </Svg>
        <GText bold size={size * 0.36} style={{ fontVariant: ['tabular-nums'] }}>{value}</GText>
      </View>
      <View>
        <GText bold size={16} color={color}>{scoreWord(value)}</GText>
        <GText size={12} color={glow.soft}>GoodWatch score</GText>
      </View>
    </View>
  );
}

function Chip({ logo, wide, brand, label, children }: { logo: number; wide?: boolean; brand: string; label: string; children: ReactNode }) {
  return (
    <View accessible accessibilityLabel={label} style={{ height: 28, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, borderRadius: 6, backgroundColor: brand }}>
      <Image source={logo} accessible={false} resizeMode="contain" style={wide ? { width: 25, height: 12 } : { width: 14, height: 14 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>{children}</View>
    </View>
  );
}
const Value = ({ children, ink, dim = false }: { children: string; ink: string; dim?: boolean }) => (
  <GText bold size={13} color={ink} style={{ opacity: dim ? 0.9 : 1, fontVariant: ['tabular-nums'] }}>{children}</GText>
);
const Rule = ({ ink }: { ink: string }) => <View style={{ width: 1, height: 12, backgroundColor: ink, opacity: 0.4 }} />;

/** IMDb, Metacritic and Rotten Tomatoes (critics | audience) as brand chips; a site without a score is left out. */
export function SourceChips({ scores }: { scores: Candidate['scores'] }) {
  const s = sourceScores(scores);
  if (!s) return null;
  return (
    <View testID="source-scores" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      {s.imdb ? <Chip logo={LOGOS.imdb} wide brand={BRAND.imdb} label={`IMDb ${s.imdb}`}><Value ink="#000000">{s.imdb}</Value></Chip> : null}
      {s.metacritic ? <Chip logo={LOGOS.metacritic} brand={BRAND.metacritic} label={`Metacritic ${s.metacritic}`}><Value ink="#ffffff">{s.metacritic}</Value></Chip> : null}
      {s.rt || s.rtAudience ? (
        <Chip logo={LOGOS.rotten} brand={BRAND.rotten} label={`Rotten Tomatoes: critics ${s.rt ?? 'unknown'}, audience ${s.rtAudience ?? 'unknown'}`}>
          <Value ink="#ffffff">{s.rt ?? '–'}</Value><Rule ink="#ffffff" /><Value ink="#ffffff" dim>{s.rtAudience ?? '–'}</Value>
        </Chip>
      ) : null}
    </View>
  );
}
