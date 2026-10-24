import { Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, View } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Providers } from '../core/providers';
import { Boot } from '../features/glow/Boot';
if (Platform.OS !== 'web') void SplashScreen.preventAutoHideAsync().catch(() => undefined);
export default function Layout() {
  const [loaded, error] = useFonts({ Gabarito: require('../../assets/Gabarito-Regular.ttf'), GabaritoBold: require('../../assets/Gabarito-Bold.ttf') });
  const [booted, setBooted] = useState(false);
  const done = useCallback(() => setBooted(true), []);
  const hideNative = useCallback(() => { if (Platform.OS !== 'web') void SplashScreen.hideAsync().catch(() => undefined); }, []);
  return <Providers><StatusBar style="light" /><View style={{ flex: 1, backgroundColor: '#070707' }}>
    <View style={{ flex: 1 }} pointerEvents={booted ? 'auto' : 'none'} accessibilityElementsHidden={!booted} importantForAccessibility={booted ? 'auto' : 'no-hide-descendants'} aria-hidden={!booted}>
      {booted && (loaded || error) && <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#070707' } }} />}
    </View>
    {!booted && <Boot ready={Boolean(loaded || error)} done={done} onLayout={hideNative} />}
  </View></Providers>;
}
