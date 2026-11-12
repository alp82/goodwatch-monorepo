/**
 * A card's details as a full page in the shared container: a short hero right under the header (the backdrop subdued
 * behind poster, facts, title, genres and scores), two big actions (Trailer, which opens YouTube,
 * and Full details on GoodWatch), then the Summary (tagline, synopsis, essence chips) beside GoodWatch's effect lines
 * in its print colors, "Not for …" and the credits. Every part whose data is missing stays out.
 */
import { useState } from 'react';
import { Image, Platform, Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import type { Candidate } from '@goodwatch/yepwatch-contracts/proposal';
import { titlePresentation } from '../glow/adapter';
import { credits, effectLines, gwScore, highlightChips, sourceScores, text } from '../glow/score-format';
import { ScoreRing, SourceChips } from '../glow/scores';
import { GText, Icon, glow } from '../glow/theme';
import { TrailerLink } from '../glow/TrailerLink';
import { goodwatchTitleUrl } from '../glow/watch-links';
import { useLayout, type Layout } from '../shell/layout';
import { GoodWatchMark } from '../shell/marks';

// Expo Link's asChild uses HTML attributes; RN Web Pressable needs hrefAttrs.
const externalAttrs = Platform.OS === 'web' ? { hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } } : {};
const sand = '#f5e6c8';
type Z = Layout['z'];

const hoursMinutes = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`);
function facts(c: Candidate) {
  const t = titlePresentation(c);
  const movie = t.kind === 'movie';
  return [t.year ? String(t.year) : null, movie ? 'Movie' : 'Show', t.episodeLabel, t.runtimeMinutes ? (movie ? hoursMinutes(t.runtimeMinutes) : `${t.runtimeMinutes} min`) : null]
    .filter((x): x is string => Boolean(x));
}
/** Long synopses fold after about four lines; More opens the rest in place. */
function fold(s: string, max = 230) {
  if (s.length <= max + 40) return { shown: s, hidden: '' };
  const cut = s.lastIndexOf(' ', max);
  return { shown: `${s.slice(0, cut)}…`, hidden: s.slice(cut + 1) };
}

function Kicker({ children, z }: { children: string; z: Z }) {
  return <GText bold size={z(12)} color={glow.amber} style={{ letterSpacing: 1.6 }}>{children.toUpperCase()}</GText>;
}

function Scores({ c, z, ring }: { c: Candidate; z: Z; ring: number }) {
  const certification = text(c.certification);
  if (gwScore(c.goodwatchScore) === null && !sourceScores(c.scores) && !certification) return null;
  return (
    <View testID="details-scores" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: z(18), rowGap: 10 }}>
      <ScoreRing score={c.goodwatchScore} size={ring} />
      <SourceChips scores={c.scores} />
      {certification ? (
        <View testID="certification" style={{ height: 24, paddingHorizontal: 7, borderRadius: 6, borderWidth: 1, borderColor: '#ffffff40', justifyContent: 'center' }}>
          <GText bold size={12} color={glow.soft}>{certification}</GText>
        </View>
      ) : null}
    </View>
  );
}

const actionStyle = (z: Z) => ({ flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: z(64), borderRadius: 14, paddingHorizontal: z(18), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: z(10), backgroundColor: '#ffffff12', borderWidth: 1, borderColor: '#ffffff33' }) as const;

/** Trailer (when there is one) and Full details on GoodWatch: two big, equal actions. */
function Actions({ c, z, stack }: { c: Candidate; z: Z; stack: boolean }) {
  return (
    <View testID="details-actions" style={{ flexDirection: stack ? 'column' : 'row', gap: z(12), width: '100%' }}>
      <TrailerLink url={c.trailerUrl ?? null} style={actionStyle(z)}>
        <Icon name="play" size={z(22)} color={glow.amber} />
        <GText bold size={z(19)} lines={1}>Trailer</GText>
        <Icon name="external" size={z(17)} color={glow.amber} />
      </TrailerLink>
      <Link href={goodwatchTitleUrl(c.identity) as `https://${string}`} target="_blank" rel="noopener noreferrer" asChild>
        <Pressable {...externalAttrs} accessibilityRole="link" accessibilityLabel="Full details on GoodWatch" style={actionStyle(z)}>
          <GoodWatchMark size={z(26)} />
          <GText bold size={z(19)} lines={1} style={{ flexShrink: 1 }}>Full details on GoodWatch</GText>
          <Icon name="external" size={z(17)} color={glow.amber} />
        </Pressable>
      </Link>
    </View>
  );
}

function Synopsis({ children, size }: { children: string; size: number }) {
  const [open, setOpen] = useState(false);
  const { shown, hidden } = fold(children);
  return (
    <GText size={size} color={glow.soft} style={{ lineHeight: size * 1.5 }}>
      {open ? `${shown.replace(/…$/, '')} ${hidden}` : shown}
      {hidden ? <Text accessibilityRole="button" onPress={() => setOpen(!open)} style={{ fontFamily: 'GabaritoBold', fontSize: size, color: glow.amber }}>{open ? '  Less' : '  More'}</Text> : null}
    </GText>
  );
}

/** GoodWatch's essence tags as quiet chips with an amber dot; rooms from before them show the fingerprint highlights. */
function Chips({ c, z }: { c: Candidate; z: Z }) {
  const essence = (c.essence ?? []).map((tag) => text(tag)).filter((tag): tag is string => Boolean(tag));
  if (essence.length) {
    return (
      <View testID="details-essence" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: z(8) }}>
        {essence.map((tag) => (
          <View key={tag} style={{ flexDirection: 'row', alignItems: 'center', gap: z(8), paddingVertical: z(6), paddingLeft: z(10), paddingRight: z(12), borderRadius: 10, backgroundColor: '#ffffff0b', borderWidth: 1, borderColor: '#ffffff14' }}>
            <View style={{ width: z(6), height: z(6), borderRadius: 3, backgroundColor: '#fbbf2488' }} />
            <GText size={z(15)} color="#e7e5e4">{tag}</GText>
          </View>
        ))}
      </View>
    );
  }
  const chips = highlightChips(c.highlights);
  if (!chips.length) return null;
  return (
    <View testID="details-highlights" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: z(8) }}>
      {chips.map((h) => (
        <View key={h.key} style={{ paddingHorizontal: z(10), paddingVertical: z(5), borderRadius: 8, backgroundColor: h.background }}>
          <GText bold size={z(14)} color={h.color}>{h.label}</GText>
        </View>
      ))}
    </View>
  );
}

/** The effect lines in their print colors, size and tracking by strength (no heading), then "Not for …". */
function Effects({ c, z, phone }: { c: Candidate; z: Z; phone: boolean }) {
  const lines = effectLines(c.effects);
  const notFor = text(c.notFor);
  if (!lines.length && !notFor) return null;
  const k = (s: number) => Math.max(0, Math.min(1, (s - 6.5) / 3.5));
  const size = (s: number) => Math.round(phone ? 20 + k(s) * 10 : z(22 + k(s) * 18));
  return (
    <View testID="details-effects" style={{ gap: z(2) }}>
      {lines.map((e) => (
        <GText key={e.line} bold size={size(e.strength)} color={e.color}
          style={{ letterSpacing: -(0.004 + 0.022 * k(e.strength)) * size(e.strength), lineHeight: size(e.strength) * 1.24 }}>{e.line}</GText>
      ))}
      {notFor ? <View testID="details-not-for" style={{ marginTop: lines.length ? z(8) : 0 }}><GText size={phone ? 15 : z(16)} color={glow.muted}>{notFor}</GText></View> : null}
    </View>
  );
}

function People({ c, z }: { c: Candidate; z: Z }) {
  const people = credits(c);
  if (!people.length) return null;
  return (
    <View testID="details-people" style={{ gap: z(12) }}>
      {people.map((p) => (
        <View key={p.label} style={{ gap: 2 }}>
          <GText bold size={z(12)} color={glow.muted} style={{ letterSpacing: 1.2 }}>{p.label.toUpperCase()}</GText>
          <GText size={z(16)} color={glow.ink}>{p.names}</GText>
        </View>
      ))}
    </View>
  );
}

/** Title details keep their place while a trailer opens outside YepWatch. */
export function TitleDetails({ c }: { c: Candidate }) {
  const { z, phone, wide, width, max } = useLayout();
  const t = titlePresentation(c);
  const bleed = (width - max) / 2;
  // The frame's own top padding: the hero starts right under the header.
  const padTop = phone ? 22 : z(40);
  const posterW = phone ? 104 : z(wide ? 220 : 180);
  const titleSize = phone ? (t.title.length > 22 ? 28 : 34) : z(t.title.length > 22 ? 52 : 68);
  const factLine = facts(c).join(' · ');
  const genres = t.genres.map((g) => g.replace('Sci-Fi & Fantasy', 'Sci-fi')).join(' · ');
  const tagline = text(c.tagline);
  const overview = text(t.overview);
  const summary = Boolean(tagline || overview || c.essence?.length || highlightChips(c.highlights).length);
  const effects = effectLines(c.effects).length > 0 || Boolean(text(c.notFor));
  const people = credits(c).length > 0;
  const info = (
    <View style={{ flex: 1, minWidth: 0, gap: z(phone ? 6 : 12) }}>
      {factLine ? <Kicker z={z}>{factLine}</Kicker> : null}
      <GText bold size={titleSize} style={{ letterSpacing: -titleSize * 0.03, lineHeight: titleSize * 1.04 }}>{t.title}</GText>
      {genres ? <GText size={phone ? 15 : z(18)} color={glow.soft}>{genres}</GText> : null}
      {!phone ? <View style={{ marginTop: z(4) }}><Scores c={c} z={z} ring={z(52)} /></View> : null}
    </View>
  );
  const actions = (stack: boolean) => <Actions c={c} z={z} stack={stack} />;
  const posterUri = t.posterUrl && phone ? t.posterUrl.replace('/w500/', '/w342/') : t.posterUrl;
  const backdropUri = t.backdropUrl && phone ? t.backdropUrl.replace('/w1280/', '/w780/') : t.backdropUrl;
  return (
    <>
      <View testID="details-hero" style={{ marginTop: -padTop, marginLeft: -bleed, width }}>
        <View style={{ overflow: 'hidden' }}>
          {backdropUri ? <Image source={{ uri: backdropUri }} accessible={false} resizeMode="cover" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, opacity: 0.38 }} /> : null}
          <LinearGradient start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} colors={['#070707f2', '#070707b3', '#07070740']} locations={[0, 0.5, 1]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
          <LinearGradient colors={['#07070700', '#070707d9', glow.bg]} locations={[0.3, 0.85, 1]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
          <View style={{ marginLeft: bleed, width: max, paddingTop: phone ? 20 : z(36), paddingBottom: phone ? 18 : z(36), flexDirection: 'row', alignItems: phone ? 'flex-end' : 'center', gap: phone ? 14 : z(36) }}>
            {posterUri ? (
              <View style={{ width: posterW, height: posterW * 1.5, borderRadius: phone ? 10 : 14, overflow: 'hidden', borderWidth: 1, borderColor: '#ffffff24', backgroundColor: '#1a1610' }}>
                <Image source={{ uri: posterUri }} accessibilityLabel={`${t.title} poster`} style={{ width: '100%', height: '100%' }} />
              </View>
            ) : null}
            {info}
            {wide ? <View style={{ width: z(380) }}>{actions(true)}</View> : null}
          </View>
        </View>
      </View>
      <View style={{ gap: phone ? 26 : z(44), marginTop: phone ? 16 : z(32) }}>
        {phone ? <Scores c={c} z={z} ring={46} /> : null}
        {!wide ? actions(phone) : null}
        {summary || effects || people ? (
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: phone ? 30 : z(56) }}>
            {summary ? (
              <View testID="details-summary" style={{ flex: wide ? 1.35 : undefined, gap: z(22) }}>
                <GText bold size={phone ? 21 : z(26)} style={{ letterSpacing: -0.5 }}>Summary</GText>
                {tagline ? <GText bold size={phone ? 18 : z(22)} color={sand}>{tagline}</GText> : null}
                {overview ? <Synopsis size={phone ? 17 : z(20)}>{overview}</Synopsis> : null}
                <Chips c={c} z={z} />
              </View>
            ) : wide ? <View style={{ flex: 1.35 }} /> : null}
            {effects || people ? (
              <View style={{ flex: wide ? 1 : undefined, gap: z(22), paddingTop: wide ? z(4) : 0 }}>
                <Effects c={c} z={z} phone={phone} />
                {effects && people ? <View style={{ height: 1, backgroundColor: '#ffffff14', marginVertical: z(6) }} /> : null}
                <People c={c} z={z} />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </>
  );
}
