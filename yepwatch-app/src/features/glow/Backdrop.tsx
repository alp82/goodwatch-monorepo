import { Image, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { s } from './theme';
/** Native uses supported image blur and dark gradients; device color treatment still needs visual validation. */
export function Backdrop({ url }: { url: string }) {
  return (
    <View pointerEvents="none" style={[s.absolute, { overflow: 'hidden' }]}>
      <Image
        source={{ uri: url }}
        blurRadius={12}
        resizeMode="cover"
        style={[s.absolute, { opacity: 0.4, transform: [{ scale: 1.12 }] }]}
      />
      <LinearGradient
        colors={['#06060659', '#06060619', '#060606bf']}
        locations={[0, 0.4, 1]}
        style={s.absolute}
      />
    </View>
  );
}
