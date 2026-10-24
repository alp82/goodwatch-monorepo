import { BootPhase, BootTarget } from './boot-phase';
import { useContext, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Animated, Easing, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMotionPreference } from '../../components/ui';
import { GText, Pill, Wordmark, glow } from '../glow/theme';
import { GoodWatchSignIn } from '../glow/GoodWatchSignIn';
import { Explainer } from './Explainer';
export interface HomeLandingProps {
  create: () => void;
  join: () => void;
  returnToRoom?: () => void;
  signIn?: () => void;
  disabled: boolean;
}
export function HomeLanding({ create, join, returnToRoom, signIn, disabled }: HomeLandingProps) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height && height < 500;
  const quiet = useMotionPreference();
  const phase = useContext(BootPhase);
  const { setTarget } = useContext(BootTarget);
  const brand = useRef<ComponentRef<typeof View>>(null);
  const [brandY, setBrandY] = useState<number | null>(null);
  const [film] = useState(() => new Animated.Value(0));
  const [actions] = useState(() => new Animated.Value(0));
  const [started, setStarted] = useState(false);
  const arriving = phase !== 'boot';
  useEffect(() => {
    if (brandY === null || quiet === null || !arriving) return;
    const options = { useNativeDriver: true, easing: Easing.out(Easing.cubic) };
    if (quiet) { film.setValue(1); actions.setValue(1); return; }
    const timer = setTimeout(() => setStarted(true), 500);
    const animation = Animated.parallel([
      Animated.sequence([Animated.delay(500), Animated.timing(film, { ...options, toValue: 1, duration: 240 })]),
      Animated.sequence([Animated.delay(850), Animated.timing(actions, { ...options, toValue: 1, duration: 240 })]),
    ]);
    animation.start(); return () => { clearTimeout(timer); animation.stop(); };
  }, [brandY, quiet, film, actions, arriving]);
  return <SafeAreaView style={{ flex: 1, backgroundColor: glow.bg, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
    <View style={{ width: '100%', maxWidth: landscape ? 850 : 520, flexDirection: landscape ? 'row' : 'column', alignItems: 'center', gap: 24 }}>
      <View style={{ width: landscape ? '50%' : '100%', alignItems: 'center', gap: 42 }}>
        <View ref={brand} onLayout={() => brand.current?.measureInWindow((x,y,width,height) => { setBrandY(y+height/2); setTarget({x,y,width,height}); })} style={{opacity:phase==='ready'?1:0}}>
          <Wordmark size={42} />
        </View>
        <Animated.View style={{ width: '100%', opacity: film, transform: [{ translateY: film.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}><Explainer obscured={!started && !quiet} /></Animated.View>
      </View>
      <Animated.View style={{ width: landscape ? '46%' : '100%', gap: 14, opacity: actions, transform: [{ translateY: actions.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
        <View style={{ flexDirection: 'row', gap: 10 }}><Pill label="Create a room" gold onPress={create} disabled={disabled} style={{ flex: 1 }}>Create a room</Pill><Pill label="Join a room" onPress={join} disabled={disabled} style={{ flex: 1 }}>Join a room</Pill></View>
        {signIn && <GoodWatchSignIn onPress={signIn} disabled={disabled} />}
        {returnToRoom && <Pill label="Return to your room" onPress={returnToRoom} disabled={disabled}><GText color={glow.amber}>Return to your room →</GText></Pill>}
      </Animated.View>
    </View>
  </SafeAreaView>;
}
