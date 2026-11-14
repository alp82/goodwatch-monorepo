import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BACKDROP } from './backdrop-colors';
import { s } from './theme';
/** A constant room atmosphere; choosing or browsing titles never reloads the background. */
export function Backdrop() {
  return (
    <View testID="room-atmosphere" pointerEvents="none" style={[s.absolute, { overflow: 'hidden' }]}>
      <LinearGradient colors={BACKDROP.colors} locations={BACKDROP.locations} style={s.absolute} />
    </View>
  );
}
