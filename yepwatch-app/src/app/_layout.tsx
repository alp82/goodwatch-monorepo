import { BootPageReady, BootPhase } from '../features/home/boot-phase';
import { useWebFontsReady } from '../features/home/useWebFontsReady';
import { Stack, usePathname } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Providers } from '../core/providers';
import { Boot } from '../features/glow/Boot';
if (Platform.OS !== 'web') void SplashScreen.preventAutoHideAsync().catch(() => undefined);
export default function Layout() {
  const [loaded, error] = useFonts({ Gabarito: require('../../assets/Gabarito-Regular.ttf'), GabaritoBold: require('../../assets/Gabarito-Bold.ttf') });
  const webFontsReady = useWebFontsReady();
  const fontsReady = Boolean(loaded || error || webFontsReady);
  const [booted, setBooted] = useState(false);
  const [arriving, setArriving] = useState(false);
  const home = usePathname() === '/';
  // Only the home page builds in behind the dissolving word. Deep links (rooms, invitations) still mount
  // after the boot, so room reads and card exposure never start behind it. Taps work from the moment the
  // home page starts to appear; if one navigates away (a room, sign-in), the router stays mounted.
  const [keepStack, setKeepStack] = useState(false);
  const showStack = booted || home || keepStack;
  const [pageReady, setPageReady] = useState(false);
  const markPageReady = useCallback(() => setPageReady(true), []);
  const revealed = useCallback(() => { setArriving(true); if (home) setKeepStack(true); }, [home]);
  const done = useCallback(() => setBooted(true), []);
  const hideNative = useCallback(() => { if (Platform.OS !== 'web') void SplashScreen.hideAsync().catch(() => undefined); }, []);
  return <BootPageReady.Provider value={markPageReady}><BootPhase.Provider value={booted ? 'ready' : arriving ? 'enter' : 'boot'}><Providers><StatusBar style="light" /><View style={{ flex: 1, backgroundColor: '#070707' }}>
    <View style={{ flex: 1 }} pointerEvents={booted || arriving ? 'auto' : 'none'} accessibilityElementsHidden={!(booted || arriving)} importantForAccessibility={booted || arriving ? 'auto' : 'no-hide-descendants'} aria-hidden={!(booted || arriving)}>
      {showStack && fontsReady && <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#070707' } }} />}
    </View>
    {Platform.OS === 'web' && !fontsReady && <View aria-hidden pointerEvents="none" style={{ position: 'absolute', opacity: 0 }}>
      <Text style={{ fontFamily: 'Gabarito' }}>YepWatch</Text><Text style={{ fontFamily: 'GabaritoBold' }}>YepWatch</Text>
    </View>}
    {!booted && <Boot ready={fontsReady} pageReady={!home || pageReady} buildsIn={home} done={done} onLayout={hideNative} onRevealed={revealed} />}
  </View></Providers></BootPhase.Provider></BootPageReady.Provider>;
}
