/**
 * The Taste card (rethink.md screen 3): a warm card with the amber TASTE tab, the title's picture with its name over
 * it, the question centered under it and the answer tiles. Details cover the card's own picture (the card stays where
 * it is). The compact layout (a poster beside the words) is the start page's next-day question.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useReducedMotion } from '../../components/ui';
import { GText, Icon, glow, native } from '../glow/theme';
import { HoverPress, Nudge } from '../shell/hover';
import { useLayout } from '../shell/layout';
import { R, warm } from '../shell/tokens';
import { ANSWER_ICON, ANSWER_LABEL, type CardAnswer } from './answers';

/** What a card shows of its title. */
export interface CardTitle { key: number; title: string; posterUrl: string | null; meta: string; overview: string | null }

export const cardShell = { backgroundColor: warm.raised, borderWidth: 1, borderColor: warm.lineStrong, borderTopWidth: 3, borderTopColor: glow.amber, borderRadius: R.card, overflow: 'hidden', boxShadow: '0 14px 28px #00000080' } as ViewStyle;
const sized = (url: string, w: 185 | 342 | 500 | 780) => url.replace(/\/w\d+\//, `/w${w}/`);

/** The amber tab every Taste card carries, with an optional count or line on the right. */
export function TasteTab({ label = 'TASTE', right }: { label?: string; right?: string }) {
  const { z } = useLayout();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: z(24), paddingHorizontal: 8, borderRadius: 6, backgroundColor: warm.amberSoft, borderWidth: 1, borderColor: warm.amberLine }}>
        <Icon name="heartFilled" size={z(12)} color={glow.amber} />
        <GText bold size={z(11)} color={glow.amber} style={{ letterSpacing: 1.2 }}>{label}</GText>
      </View>
      <View style={{ flex: 1 }} />
      {right ? <GText size={z(13)} color={glow.soft} style={{ fontVariant: ['tabular-nums'] }}>{right}</GText> : null}
    </View>
  );
}

/** One answer tile. Loved it is amber; Haven't seen (and Didn't watch it) is the quiet one. */
export function AnswerButton({ a, onPress, compact, disabled, tall, low }: { a: CardAnswer; onPress: () => void; compact: boolean; disabled?: boolean; tall?: boolean; /** A shorter tall tile (the compact card). */ low?: boolean }) {
  const { z } = useLayout();
  const loved = a === 'loved';
  const quiet = a === 'unseen' || a === 'did_not_watch';
  const color = loved ? warm.ink : quiet ? glow.muted : glow.ink;
  return (
    <HoverPress label={ANSWER_LABEL[a]} onPress={onPress} disabled={disabled} repeatable hover={quiet ? 'tint' : 'lighten'}
      style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: z(tall ? (low ? 64 : 76) : compact ? 48 : 52), borderRadius: R.control, paddingHorizontal: compact ? 6 : 12, flexDirection: tall ? 'column' : 'row', gap: tall ? 6 : compact ? 5 : 8,
        backgroundColor: loved ? glow.amber : quiet ? 'transparent' : '#ffffff0d', borderWidth: 1, borderColor: loved ? glow.amber : quiet ? 'transparent' : warm.lineStrong }}>
      <Icon name={ANSWER_ICON[a]} size={z(tall ? 22 : compact ? 15 : 17)} color={loved ? warm.ink : quiet ? glow.muted : glow.soft} />
      <GText bold size={z(compact ? 14 : 16)} color={color} lines={1}>{ANSWER_LABEL[a]}</GText>
    </HoverPress>
  );
}

/** The answer stamped on a card while it's dragged toward that answer, and on its way out. */
export function Stamp({ a }: { a: CardAnswer }) {
  const loved = a === 'loved';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, height: 44, borderRadius: 10, backgroundColor: loved ? glow.amber : '#2a251d', borderWidth: 1, borderColor: loved ? glow.amber : warm.lineStrong }}>
      <Icon name={ANSWER_ICON[a]} size={18} color={loved ? warm.ink : glow.soft} />
      <GText bold size={17} color={loved ? warm.ink : glow.soft}>{ANSWER_LABEL[a]}</GText>
    </View>
  );
}

function useFade(duration = 240) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    const a = Animated.timing(v, { toValue: 1, duration: reduced ? 0 : duration, easing: Easing.out(Easing.cubic), useNativeDriver: native });
    a.start();
    return () => a.stop();
  }, [v, duration, reduced]);
  return v;
}

/** Details over the card's own picture: fades in, the card stays put. */
function InlineDetails({ t, onClose }: { t: CardTitle; onClose: () => void }) {
  const { z } = useLayout();
  const v = useFade();
  return (
    <Animated.View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, opacity: v, backgroundColor: '#0d0b08f2', transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
      <ScrollView contentContainerStyle={{ padding: z(16), gap: z(8) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <GText bold size={z(12)} color={glow.amber} style={{ flex: 1, letterSpacing: 0.2 }}>Details</GText>
          <HoverPress label="Close details" hover="tint" onPress={onClose} style={{ borderRadius: 12 }}><Icon name="close" size={20} color={glow.soft} /></HoverPress>
        </View>
        <GText bold size={z(20)} style={{ letterSpacing: -0.4 }}>{t.title}</GText>
        {t.meta ? <GText size={z(14)} color={glow.muted}>{t.meta}</GText> : null}
        <GText size={z(15)} color={glow.soft} style={{ lineHeight: z(15) * 1.45 }}>{t.overview || 'No description yet.'}</GText>
      </ScrollView>
    </Animated.View>
  );
}

function Question({ size, children }: { size: number; children?: ReactNode }) {
  return children
    ? <GText bold size={size} style={{ textAlign: 'center' }}>{children}</GText>
    : <GText bold size={size} style={{ textAlign: 'center' }}><GText bold size={size} color={glow.amber}>Seen it?</GText> Did you like it?</GText>;
}

export interface TasteCardProps {
  t: CardTitle;
  w: number;
  answers: readonly CardAnswer[];
  onAnswer: (a: CardAnswer) => void;
  /** The tab's right side ("3 of 10"). */
  count?: string;
  disabled?: boolean;
  /** The live card in a deck: touch drags start on the picture in any direction. */
  dragPicture?: boolean;
}

/** The full Taste card, `w` wide: landscape picture, question, three tall answer tiles. */
export function TasteCard({ t, w, answers, onAnswer, count, disabled, dragPicture }: TasteCardProps) {
  const { phone, z } = useLayout();
  const [details, setDetails] = useState(false);
  const toggle = () => setDetails((x) => !x);
  const ph = Math.round(Math.min(w * 0.56, phone ? 230 : z(340)));
  return (
    <View style={[cardShell, { width: w }, dragPicture && !native ? ({ touchAction: 'pan-y' } as ViewStyle) : null]}>
      <View style={[{ height: ph, backgroundColor: warm.well, overflow: 'hidden' }, dragPicture && !native ? ({ touchAction: 'none' } as ViewStyle) : null]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${t.title}, details`} onPress={toggle} disabled={disabled} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
          {t.posterUrl ? <Image source={{ uri: sized(t.posterUrl, 780) }} accessible={false} resizeMode="cover" style={{ position: 'absolute', left: 0, right: 0, top: -w * 0.35, height: w * 1.5 }} /> : null}
          <LinearGradient colors={['#00000033', '#00000000', '#000000e0']} locations={[0, 0.35, 1]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} pointerEvents="none" />
        </Pressable>
        <View pointerEvents="none" style={{ position: 'absolute', left: 12, right: 12, top: 12 }}><TasteTab right={count} /></View>
        <View pointerEvents="box-none" style={{ position: 'absolute', left: phone ? 14 : z(20), right: phone ? 14 : z(20), bottom: phone ? 12 : z(16), flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
          <View pointerEvents="none" style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <GText bold size={phone ? 26 : z(36)} lines={2} style={{ letterSpacing: -0.7, lineHeight: (phone ? 26 : z(36)) * 1.08 }}>{t.title}</GText>
            {t.meta ? <GText size={z(14)} color={glow.soft}>{t.meta}</GText> : null}
          </View>
          <HoverPress label="Details" onPress={toggle} disabled={disabled} style={{ minHeight: 48, alignItems: 'stretch' }}
            visual={{ minHeight: 36, paddingHorizontal: 10, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#000000a0', borderWidth: 1, borderColor: '#ffffff2a' }}>
            <GText bold size={z(13)} color={glow.soft}>Details</GText>
            <Nudge dx={2}><Icon name="right" size={z(13)} color={glow.soft} /></Nudge>
          </HoverPress>
        </View>
        {details ? <InlineDetails t={t} onClose={() => setDetails(false)} /> : null}
      </View>
      <View style={{ padding: phone ? 14 : z(18), gap: phone ? 12 : z(14) }}>
        <Question size={phone ? 18 : z(20)} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {answers.map((a) => <AnswerButton key={a} a={a} compact={w < 380} tall disabled={disabled} onPress={() => onAnswer(a)} />)}
        </View>
      </View>
    </View>
  );
}

/** The compact card: poster beside the label, the title's question and short answer tiles (the next-day question). */
export function CompactTasteCard({ t, w, label, question, answers, onAnswer, disabled }: { t: CardTitle; w: number; label: string; question: string; answers: readonly CardAnswer[]; onAnswer: (a: CardAnswer) => void; disabled?: boolean }) {
  const { phone, z } = useLayout();
  const pw = phone ? 64 : z(84);
  return (
    <View style={[cardShell, { width: w, padding: phone ? 12 : z(16), gap: phone ? 12 : z(14) }]}>
      <View style={{ flexDirection: 'row', gap: phone ? 12 : z(16), alignItems: 'center' }}>
        <View style={{ width: pw, height: pw * 1.5, borderRadius: 8, overflow: 'hidden', backgroundColor: warm.well }}>
          {t.posterUrl ? <Image source={{ uri: sized(t.posterUrl, 185) }} accessible={false} style={{ width: '100%', height: '100%' }} /> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <TasteTab label={label.toUpperCase()} />
          <GText bold size={phone ? 20 : z(24)} lines={2} style={{ letterSpacing: -0.4 }}>{question}</GText>
          {t.meta ? <GText size={z(13)} color={glow.muted} lines={1}>{t.meta}</GText> : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {/* Narrow cards stack icon over words, so "Didn't watch it" fits whole. */}
        {answers.map((a) => <AnswerButton key={a} a={a} compact={w < 420} tall={w < 420} low disabled={disabled} onPress={() => onAnswer(a)} />)}
      </View>
    </View>
  );
}
