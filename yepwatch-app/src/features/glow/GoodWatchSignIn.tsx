import { Image } from 'react-native';
import { GText, Press, s } from './theme';
export function GoodWatchSignIn({ onPress, disabled, busy = false }: { onPress: () => void; disabled?: boolean; busy?: boolean }) {
  return <Press label="Sign in with GoodWatch" onPress={onPress} disabled={disabled} style={s.pill}>
    <Image source={require('../../../assets/goodwatch-mark.png')} style={{ width: 24, height: 24 }} accessible={false} />
    <GText bold>{busy ? 'Signing in with GoodWatch…' : 'Sign in with GoodWatch'}</GText>
  </Press>;
}
