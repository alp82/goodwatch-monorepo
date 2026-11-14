import { BootPageReady, BootPhase, bootPage } from '../features/home/boot-phase';
import { useWebFontsReady } from '../features/home/useWebFontsReady';
import { Stack, usePathname } from 'expo-router';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Providers } from '../core/providers';
import { Boot } from '../features/glow/Boot';
import { MemberTransition } from '../features/shell/MemberTransition';
import { CoveredBody } from '../features/shell/parts';
import { installLeftoverTapGuard, leftoverTouchGuard, surfaceAppeared } from '../features/shell/fresh-surface';
import { useFrontRoom } from '../features/shell/useFrontRoom';
import { arrivesInPlace } from '../features/room/nav';
import { ROOT_SCREENS } from '../features/shell/route-order';
installLeftoverTapGuard();
if (Platform.OS !== 'web') {
  // The startup cover continues the system splash exactly (the Y on the same ground), so the splash can
  // go in one frame. Its default 400 ms fade would otherwise play over a page that is already ready.
  SplashScreen.setOptions({ duration: 0 });
  void SplashScreen.preventAutoHideAsync().catch(() => undefined);
}
const arrivalRoom = ({ route }: { route: { params?: object } }) => {
  const params = route.params as { arrival?: string; id?: string } | undefined;
  return { gestureEnabled: false, ...(params?.arrival === '1' || arrivesInPlace(params?.id) ? { animation: 'none' as const } : {}) };
};
export default function Layout() {
  const [loaded, error] = useFonts({ Gabarito: require('../../assets/Gabarito-Regular.ttf'), GabaritoBold: require('../../assets/Gabarito-Bold.ttf') });
  const webFontsReady = useWebFontsReady();
  const fontsReady = Boolean(loaded || error || webFontsReady);
  const [booted, setBooted] = useState(false);
  const [arriving, setArriving] = useState(false);
  const pathname = usePathname();
  // The app builds unseen under the startup cover and shows as soon as the page in front is ready (or
  // right away for pages that don't load first). Back in the room the app was closed in: the start page
  // never shows on the way (useFrontRoom).
  // A new screen ignores the rest of a double or triple tap that opened it.
  useLayoutEffect(() => { surfaceAppeared(); }, [pathname]);
  const { pending: resuming } = useFrontRoom(pathname);
  const page = bootPage(pathname);
  const [readyPages, setReadyPages] = useState<ReadonlySet<string>>(() => new Set());
  const markPageReady = useCallback((key: string) => setReadyPages((keys) => (keys.has(key) ? keys : new Set(keys).add(key))), []);
  const pageReady = !resuming && (page === null || readyPages.has(page));
  const revealed = useCallback(() => setArriving(true), []);
  const done = useCallback(() => setBooted(true), []);
  const hideNative = useCallback(() => { if (Platform.OS !== 'web') void SplashScreen.hideAsync().catch(() => undefined); }, []);
  const shown = booted || arriving;
  // The same element while the fonts stay loaded: this layout re-renders on every change of address and page
  // readiness, and a new Stack element re-rendered the whole navigator and the screens in it each time.
  const stack = useMemo(() => fontsReady && <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#070707' } }}>
    {/* Every screen, in expo-router's own order (route-order.ts): a different order re-renders the tree once more after mount. */}
    {ROOT_SCREENS.map((name) => <Stack.Screen key={name} name={name} {...(name === 'room/[id]' ? { options: arrivalRoom } : null)} />)}
  </Stack>, [fontsReady]);
  return <BootPageReady.Provider value={markPageReady}><BootPhase.Provider value={booted ? 'ready' : arriving ? 'enter' : 'boot'}><Providers><StatusBar style="light" /><View style={{ flex: 1, backgroundColor: '#070707' }} {...(Platform.OS === 'web' ? null : leftoverTouchGuard)}>
    {/* Inert (no focus inside hidden content) until the cover starts to dissolve. Native draws the page
        under the opaque cover, so its first (heavy) draw is done before the dissolve and can't stall it;
        the web hides it outright (the browser composites the dissolve). */}
    <CoveredBody covered={!booted} testID="boot-stack" style={{ flex: 1, opacity: shown || Platform.OS !== 'web' ? 1 : 0 }}>
      {stack}
    </CoveredBody>
    {Platform.OS === 'web' && !fontsReady && <View aria-hidden pointerEvents="none" style={{ position: 'absolute', opacity: 0 }}>
      <Text style={{ fontFamily: 'Gabarito' }}>YepWatch</Text><Text style={{ fontFamily: 'GabaritoBold' }}>YepWatch</Text>
    </View>}
    {!booted && <Boot ready={fontsReady} pageReady={pageReady} word={!page?.startsWith('invite:')} done={done} onLayout={hideNative} onRevealed={revealed} />}
    <MemberTransition />
  </View></Providers></BootPhase.Provider></BootPageReady.Provider>;
}
