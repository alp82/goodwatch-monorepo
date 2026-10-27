/**
 * First visit: the approved value line and Explainer film, the real install codes (browser only),
 * and the browser path (Create, Join, Continue with GoodWatch). Returning people skip this and land
 * on their rooms. Wide: film left, choices right. Short landscape: same split, compact. Phones: one
 * column, install codes become store buttons (you cannot scan a code on the phone you are holding).
 * The installed app shows no install section.
 */
import { useContext, useState } from 'react';
import { Image, Platform, Pressable, View } from 'react-native';
import { Link } from 'expo-router';
import codes from './codes.json';
import { BootPhase } from './boot-phase';
import { BootReveal } from './BootReveal';
import { GText, Press, glow } from '../glow/theme';
import { IntroFilm } from './IntroFilm';
import { GoodWatchMark, StoreLogo } from '../shell/marks';
import { R } from '../shell/tokens';

const stores = [
  { platform: 'ios' as const, title: 'iPhone', note: 'TestFlight', url: codes.ios.url, svg: codes.ios.svg },
  { platform: 'android' as const, title: 'Android', note: 'Download app', url: codes.android.url, svg: codes.android.svg },
];
// Expo Link's asChild uses HTML attributes; RN Web Pressable needs hrefAttrs (same as WatchLinks).
const externalAttrs = Platform.OS === 'web' ? { hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } } : {};

function QrCard({ store, width }: { store: (typeof stores)[number]; width: number }) {
  const [hover, setHover] = useState(false);
  return (
    <Link href={store.url as `https://${string}`} target="_blank" rel="noopener noreferrer" asChild>
      <Pressable {...externalAttrs} accessibilityRole="link" accessibilityLabel={`Install YepWatch on ${store.title}`} onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)}
        style={{ width, padding: 12, gap: 10, borderRadius: R.card, borderWidth: 1, borderColor: hover ? glow.amber : '#2a2a2a', backgroundColor: '#131313' }}>
        <View style={{ width: width - 24, height: width - 24, borderRadius: 8, overflow: 'hidden', backgroundColor: '#fff' }}>
          <Image source={{ uri: `data:image/svg+xml,${encodeURIComponent(store.svg)}` }} accessibilityLabel={`${store.title} installation QR code`} style={{ width: '100%', height: '100%' }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <StoreLogo platform={store.platform} size={26} />
          <View style={{ flex: 1 }}>
            <GText bold size={17}>{store.title}</GText>
            <GText size={12} color={glow.muted}>{store.note}</GText>
          </View>
          <GText size={20} color={glow.amber}>↗</GText>
        </View>
      </Pressable>
    </Link>
  );
}
function StoreButton({ store, height, note }: { store: (typeof stores)[number]; height: number; note: boolean }) {
  return (
    <Link href={store.url as `https://${string}`} target="_blank" rel="noopener noreferrer" asChild>
      <Pressable {...externalAttrs} accessibilityRole="link" accessibilityLabel={`Install YepWatch on ${store.title}`}
        style={{ flex: 1, minHeight: height, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 10, borderRadius: R.control, borderWidth: 1, borderColor: '#343434', backgroundColor: '#121212' }}>
        <StoreLogo platform={store.platform} size={20} />
        <GText bold size={15}>{store.title}</GText>
        {note ? <GText size={12} color={glow.muted}>{store.note}</GText> : <GText size={15} color={glow.amber}>↗</GText>}
      </Pressable>
    </Link>
  );
}
function Divider({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: '#2a2a2a' }} />
      <GText size={13} color={glow.muted}>{text}</GText>
      <View style={{ flex: 1, height: 1, backgroundColor: '#2a2a2a' }} />
    </View>
  );
}
export interface LandingActions { create: () => void; join: () => void; signIn?: () => void; disabled: boolean }
/** The approved Sign in with GoodWatch look (dark surface, GoodWatch mark), worded Continue with GoodWatch. */
export function GoodWatchButton({ onPress, disabled, height = 50 }: { onPress: () => void; disabled?: boolean; height?: number }) {
  return (
    <Press label="Continue with GoodWatch" onPress={onPress} disabled={disabled} style={{ minHeight: height, borderRadius: R.control, flexDirection: 'row', gap: 10, backgroundColor: '#242424', borderWidth: 1, borderColor: glow.line }}>
      <GoodWatchMark size={24} />
      <GText bold size={16}>Continue with GoodWatch</GText>
    </Press>
  );
}
function WebChoices({ size, actions }: { size: 'wide' | 'compact' | 'stack'; actions: LandingActions }) {
  const h = size === 'compact' ? 46 : 54;
  return (
    <View style={{ gap: size === 'compact' ? 8 : 10 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Press label="Create a room" onPress={actions.create} disabled={actions.disabled} style={{ flex: 1, minHeight: h, borderRadius: R.control, backgroundColor: glow.amber }}>
          <GText bold size={size === 'compact' ? 15 : 17} color="#201400">Create a room</GText>
        </Press>
        <Press label="Join a room" onPress={actions.join} disabled={actions.disabled} style={{ flex: 1, minHeight: h, borderRadius: R.control, borderWidth: 1, borderColor: '#3a3a3a' }}>
          <GText bold size={size === 'compact' ? 15 : 17}>Join a room</GText>
        </Press>
      </View>
      {actions.signIn && <GoodWatchButton onPress={actions.signIn} disabled={actions.disabled} height={size === 'compact' ? 44 : 50} />}
    </View>
  );
}

export function Landing(actions: LandingActions) {
  const phase = useContext(BootPhase);
  const web = Platform.OS === 'web';
  const [box, setBox] = useState({ width: 390, height: 600 });
  const [filmBox, setFilmBox] = useState(200);
  const wide = box.width >= 860 && box.height >= 460;
  const landscape = !wide && box.height < 460 && box.width >= 560;
  // The film starts as the page appears, not behind the boot word.
  const obscured = phase === 'boot';
  const headline = (size: number, center: boolean) => (
    <GText bold size={size} style={{ letterSpacing: -size * 0.025, lineHeight: size * 1.12, textAlign: center ? 'center' : 'left' }}>
      Choose something to watch, <GText bold size={size} color={glow.amber}>together.</GText>
    </GText>
  );
  return (
    <View onLayout={(e) => setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })} style={{ flex: 1, minHeight: 0, width: '100%', alignSelf: 'center' }}>
      {wide ? (
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 56, paddingHorizontal: 32, maxWidth: 1080, width: '100%', alignSelf: 'center' }}>
          <View style={{ flex: 1.1, gap: 36, alignItems: 'center' }}>
            <BootReveal index={0}>{headline(Math.min(50, box.width * 0.042), true)}</BootReveal>
            <BootReveal index={1} style={{ alignSelf: 'stretch' }}><IntroFilm obscured={obscured} height={Math.min(340, box.height * 0.46)} width={Math.min(560, box.width * 0.5)} /></BootReveal>
          </View>
          <View style={{ flex: 1, maxWidth: 460, gap: 20 }}>
            {web && <>
              <BootReveal index={2} style={{ flexDirection: 'row', gap: 16 }}>{stores.map((s) => <QrCard key={s.platform} store={s} width={Math.min(222, (Math.min(460, box.width * 0.42) - 16) / 2)} />)}</BootReveal>
              <BootReveal index={3}><Divider text="Or start here in your browser" /></BootReveal>
            </>}
            <BootReveal index={web ? 4 : 2}><WebChoices size="wide" actions={actions} /></BootReveal>
          </View>
        </View>
      ) : landscape ? (
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 24, paddingHorizontal: 20, paddingVertical: 10 }}>
          <View style={{ flex: 1, gap: 8, alignItems: 'center' }}>
            <BootReveal index={0}>{headline(22, true)}</BootReveal>
            <BootReveal index={1} style={{ alignSelf: 'stretch' }}><IntroFilm obscured={obscured} height={Math.max(110, Math.min(170, box.height - 90))} width={box.width / 2 - 40} /></BootReveal>
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            {web && <>
              <BootReveal index={2} style={{ flexDirection: 'row', gap: 8 }}>{stores.map((s) => <StoreButton key={s.platform} store={s} height={42} note={(box.width - 64) / 4 >= 180} />)}</BootReveal>
              <BootReveal index={3}><Divider text="or in your browser" /></BootReveal>
            </>}
            <BootReveal index={web ? 4 : 2}><WebChoices size="compact" actions={actions} /></BootReveal>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, minHeight: 0, width: '100%', maxWidth: 560, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 12 }}>
          <BootReveal index={0}>{headline(box.width < 360 ? 24 : 28, true)}</BootReveal>
          <BootReveal index={1} onLayout={(e) => setFilmBox(e.nativeEvent.layout.height)} style={{ flex: 1, minHeight: 0, maxHeight: 300, justifyContent: 'center', overflow: 'hidden' }}>
            {filmBox >= 110 && <IntroFilm obscured={obscured} height={Math.min(240, filmBox - 8)} width={Math.min(560, box.width) - 40} />}
          </BootReveal>
          {web && <>
            <BootReveal index={2} style={{ flexDirection: 'row', gap: 10 }}>{stores.map((s) => <StoreButton key={s.platform} store={s} height={48} note={(Math.min(560, box.width) - 50) / 2 >= 180} />)}</BootReveal>
            <BootReveal index={3}><Divider text="or in your browser" /></BootReveal>
          </>}
          <BootReveal index={web ? 4 : 2}><WebChoices size="stack" actions={actions} /></BootReveal>
        </View>
      )}
    </View>
  );
}
