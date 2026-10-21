import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { Providers } from '../core/providers';
import { Page, Words } from '../components/ui';
export default function Layout() {
  const [loaded, error] = useFonts({ Gabarito: require('../../assets/Gabarito-Regular.ttf'), GabaritoBold: require('../../assets/Gabarito-Bold.ttf') });
  if (!loaded && !error) return <Page><Words>Getting ready…</Words></Page>;
  return <Providers><StatusBar style="light" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#060606' } }} /></Providers>;
}
