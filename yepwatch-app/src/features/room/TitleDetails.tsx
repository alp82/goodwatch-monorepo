/**
 * A card's details, compact like a GoodWatch title page: title, poster with year · runtime · age rating, genres and
 * services; the scores row; up to three fingerprint highlights; tagline and overview; director or creator and the
 * top cast; where to watch. Every part whose data is missing stays out.
 */
import { Image, View } from 'react-native';
import type { Candidate, ScreenContext } from '@goodwatch/yepwatch-contracts/proposal';
import { titlePresentation } from '../glow/adapter';
import { WatchLinks } from '../glow/WatchLinks';
import { GText, glow } from '../glow/theme';
import { credits, highlightChips, sourceScores, gwScore, text } from '../glow/score-format';
import { ScoreRing, SourceChips } from '../glow/scores';
import type { ServiceChoice } from './services';
import { Logos, Small } from './ui';

export function TitleDetails({ c, offered, screens }: { c: Candidate; offered: ServiceChoice[]; screens: ScreenContext[] }) {
  const title = titlePresentation(c);
  const certification = text(c.certification);
  const facts = [title.year, title.episodeLabel, title.runtimeMinutes ? `${title.runtimeMinutes} min` : null].filter(Boolean).join(' · ');
  const chips = highlightChips(c.highlights);
  const tagline = text(c.tagline);
  const overview = text(title.overview);
  const people = credits(c);
  const scored = gwScore(c.goodwatchScore) !== null || sourceScores(c.scores) !== null;
  return (
    <>
      <GText bold size={28} style={{ letterSpacing: -0.8 }}>{title.title}</GText>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        {title.posterUrl ? <Image source={{ uri: title.posterUrl.replace('/w500/', '/w185/') }} accessible={false} style={{ width: 92, height: 138, borderRadius: 10 }} /> : null}
        <View style={{ flex: 1, gap: 8 }}>
          {facts || certification ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              {facts ? <Small>{facts}</Small> : null}
              {certification ? (
                <View testID="certification" style={{ height: 20, paddingHorizontal: 6, borderRadius: 6, borderWidth: 1, borderColor: '#ffffff40', justifyContent: 'center' }}>
                  <GText bold size={11} color={glow.soft}>{certification}</GText>
                </View>
              ) : null}
            </View>
          ) : null}
          {title.genres.length ? <Small>{title.genres.join(' · ')}</Small> : null}
          {offered.length ? <Logos services={offered} size={22} /> : null}
        </View>
      </View>
      {scored || chips.length ? (
        <View style={{ gap: 12 }}>
          {scored ? (
            <View testID="details-scores" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 10 }}>
              <ScoreRing score={c.goodwatchScore} size={46} />
              <SourceChips scores={c.scores} />
            </View>
          ) : null}
          {chips.length ? (
            <View testID="details-highlights" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {chips.map((h) => (
                <View key={h.key} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: h.background }}>
                  <GText bold size={12} color={h.color}>{h.label}</GText>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {tagline || overview ? (
        <View style={{ gap: 6 }}>
          {tagline ? <GText bold size={17} color={glow.ink}>{tagline}</GText> : null}
          {overview ? <GText color={glow.soft} style={{ lineHeight: 22 }}>{overview}</GText> : null}
        </View>
      ) : null}
      {people.length ? (
        <View testID="details-people" style={{ gap: 4 }}>
          {people.map((p) => (
            <GText key={p.label} size={14} color={glow.soft}><GText size={14} bold color={glow.muted}>{`${p.label}  `}</GText>{p.names}</GText>
          ))}
        </View>
      ) : null}
      <WatchLinks identity={c.identity} availability={c.availability} screens={screens} />
    </>
  );
}
