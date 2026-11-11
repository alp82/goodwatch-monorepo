/**
 * Installing the app from the web: the real install codes (`codes.json`) as QR cards for desktop
 * browsers, store buttons for phone browsers (you can't scan a code on the phone you hold), and the
 * header's Get the app popover. The installed app shows none of these.
 */
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Image, Platform, Pressable, View, type ViewStyle } from 'react-native';
import { Link } from 'expo-router';
import codes from './codes.json';
import { GText, Press, glow, grow } from '../glow/theme';
import { StoreLogo } from '../shell/marks';
import { useLayout } from '../shell/layout';
import { R, warm } from '../shell/tokens';

export interface Store { platform: 'ios' | 'android'; title: string; note: string; url: string; svg: string }
export const stores: readonly Store[] = [
  { platform: 'ios', title: 'iPhone', note: 'TestFlight', url: codes.ios.url, svg: codes.ios.svg },
  { platform: 'android', title: 'Android', note: 'Download app', url: codes.android.url, svg: codes.android.svg },
];
/** Install offers belong to browsers only. */
export const installable = Platform.OS === 'web';

// Expo Link's asChild uses HTML attributes; RN Web Pressable needs hrefAttrs.
const externalAttrs = Platform.OS === 'web' ? { hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } } : {};
const qrSource = (store: Store) => ({ uri: `data:image/svg+xml,${encodeURIComponent(store.svg)}` });

/** Desktop browsers: the install card (QR code, store, note). */
export function QrCard({ store, width }: { store: Store; width: number }) {
  const { z } = useLayout();
  const [hover, setHover] = useState(false);
  return (
    <Link href={store.url as `https://${string}`} target="_blank" rel="noopener noreferrer" asChild>
      <Pressable {...externalAttrs} accessibilityRole="link" accessibilityLabel={`Install YepWatch on ${store.title}`} onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)}
        style={{ width, padding: 12, gap: 10, borderRadius: R.card, borderWidth: 1, borderColor: hover ? glow.amber : '#2a2a2a', backgroundColor: glow.panel }}>
        <View style={{ width: width - 24, height: width - 24, borderRadius: 8, overflow: 'hidden', backgroundColor: '#fff' }}>
          <Image source={qrSource(store)} accessibilityLabel={`${store.title} installation QR code`} style={{ width: '100%', height: '100%' }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <StoreLogo platform={store.platform} size={z(26)} />
          <View style={{ flex: 1 }}>
            <GText bold size={z(17)}>{store.title}</GText>
            <GText size={z(12)} color={glow.muted}>{store.note}</GText>
          </View>
          <GText size={z(20)} color={glow.amber}>↗</GText>
        </View>
      </Pressable>
    </Link>
  );
}

/** A compact QR code with its store, for the header popover and the start page card. */
export function MiniQr({ store, size }: { store: Store; size: number }) {
  const { z } = useLayout();
  return (
    <Link href={store.url as `https://${string}`} target="_blank" rel="noopener noreferrer" asChild>
      <Pressable {...externalAttrs} accessibilityRole="link" accessibilityLabel={`Install YepWatch on ${store.title}`} style={{ alignItems: 'center', gap: z(8) }}>
        <View style={{ width: size, height: size, borderRadius: 8, overflow: 'hidden', backgroundColor: '#fff', padding: 4 }}>
          <Image source={qrSource(store)} accessibilityLabel={`${store.title} installation QR code`} style={{ width: '100%', height: '100%' }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <StoreLogo platform={store.platform} size={z(16)} />
          <GText bold size={z(14)}>{store.title}</GText>
        </View>
      </Pressable>
    </Link>
  );
}

/** Phone browsers: a store button. */
export function StoreButton({ store }: { store: Store }) {
  return (
    <Link href={store.url as `https://${string}`} target="_blank" rel="noopener noreferrer" asChild>
      <Pressable {...externalAttrs} accessibilityRole="link" accessibilityLabel={`Install YepWatch on ${store.title}`}
        style={{ flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: warm.lineStrong, backgroundColor: warm.faint }}>
        <StoreLogo platform={store.platform} size={22} />
        <View>
          <GText bold size={15}>{store.title}</GText>
          <GText size={11} color={glow.muted}>{store.note}</GText>
        </View>
      </Pressable>
    </Link>
  );
}

/** Desktop start page: the app, with both codes, as one quiet card. */
export function AppCard() {
  const { z } = useLayout();
  return (
    <View testID="get-the-app-card" style={{ flexDirection: 'row', alignItems: 'center', gap: z(28), padding: z(22), borderRadius: 16, borderWidth: 1, borderColor: warm.amberLine, backgroundColor: warm.amberSoft, overflow: 'hidden' }}>
      <View style={{ flex: 1, gap: z(8) }}>
        <GText bold size={z(28)} style={{ letterSpacing: -0.6 }}>Get the app</GText>
        <GText size={z(16)} color={glow.soft}>Scan with your phone.</GText>
      </View>
      {stores.map((st) => <MiniQr key={st.platform} store={st} size={z(112)} />)}
    </View>
  );
}

/** Header (desktop browsers): Get the app, with both codes in a popover. Escape or a click outside closes it. */
export function GetTheApp() {
  const { z } = useLayout();
  const [open, setOpen] = useState(false);
  const box = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (!open || Platform.OS !== 'web') return;
    const outside = (e: PointerEvent) => {
      const node = box.current as unknown as HTMLElement | null;
      if (node && !node.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', key); };
  }, [open]);
  return (
    <View ref={box} style={{ zIndex: 40 }}>
      <Press label="Get the app" selected={open} onPress={() => setOpen((v) => !v)} style={{ ...grow(Math.max(44, z(38))), alignItems: 'stretch' }}
        visual={{ height: Math.max(44, z(38)), paddingHorizontal: z(14), borderRadius: R.control, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: open ? warm.amberSoft : '#ffffff0a', borderWidth: 1, borderColor: open ? warm.amberLine : warm.line }}>
        <StoreLogo platform="ios" size={z(15)} color={open ? glow.amber : glow.soft} />
        <StoreLogo platform="android" size={z(15)} color={open ? glow.amber : glow.soft} />
        <GText bold size={z(14)} color={open ? glow.amber : glow.ink}>Get the app</GText>
      </Press>
      {open ? (
        <View testID="get-the-app" style={{ position: 'absolute', top: z(48), right: 0, flexDirection: 'row', gap: z(18), padding: z(18), borderRadius: R.card, borderWidth: 1, borderColor: warm.lineStrong, backgroundColor: warm.raised, boxShadow: '0 18px 50px rgba(0,0,0,0.6)' } as ViewStyle}>
          {stores.map((st) => <MiniQr key={st.platform} store={st} size={z(132)} />)}
        </View>
      ) : null}
    </View>
  );
}
