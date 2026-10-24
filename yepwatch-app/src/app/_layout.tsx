import { BootPhase, BootTarget, type BrandTarget } from '../features/home/boot-phase';
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
  const [target, setTarget] = useState<BrandTarget | null>(null);
  const revealed = useCallback(() => setArriving(true), []);
  const done = useCallback(() => setBooted(true), []);
  const hideNative = useCallback(() => { if (Platform.OS !== 'web') void SplashScreen.hideAsync().catch(() => undefined); }, []);
  return <BootTarget.Provider value={{target, setTarget}}><BootPhase.Provider value={booted ? 'ready' : arriving ? 'enter' : 'boot'}><Providers><StatusBar style="light" /><View style={{ flex: 1, backgroundColor: '#070707' }}>
    <View style={{ flex: 1 }} pointerEvents={booted ? 'auto' : 'none'} accessibilityElementsHidden={!booted} importantForAccessibility={booted ? 'auto' : 'no-hide-descendants'} aria-hidden={!booted}>
      {(booted || home) && fontsReady && <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#070707' } }} />}
    </View>
    {Platform.OS === 'web' && !fontsReady && <View aria-hidden pointerEvents="none" style={{ position: 'absolute', opacity: 0 }}>
      <Text style={{ fontFamily: 'Gabarito' }}>YepWatch</Text><Text style={{ fontFamily: 'GabaritoBold' }}>YepWatch</Text>
    </View>}
    {!booted && <Boot ready={fontsReady} done={done} onLayout={hideNative} onRevealed={revealed} />}
  </View></Providers></BootPhase.Provider></BootTarget.Provider>;
}
