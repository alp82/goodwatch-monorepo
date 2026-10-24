import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { s } from './theme';
/** A constant room atmosphere; choosing or browsing titles never reloads the background. */
export function Backdrop() {
  return (
    <View testID="room-atmosphere" pointerEvents="none" style={[s.absolute, { overflow: 'hidden' }]}>
      <LinearGradient
        colors={['#17140e', '#0b0b0e', '#070707']}
        locations={[0, 0.45, 1]}
        style={s.absolute}
      />
    </View>
  );
}
