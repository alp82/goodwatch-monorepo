import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Image, Text, View, type ImageSourcePropType } from 'react-native';
import { WebView } from 'react-native-webview';
import { useMotionPreference } from '../../components/ui';
import { nativeIntroHtml } from './native-intro-html';
const source = { html: nativeIntroHtml };
const LABEL = 'Swipe your picks. Find a shared match. Agree, then watch and enjoy.';
const HEIGHT = 224;
/** Both frames are drawn by scripts/intro-frames.ts from the same page, 576 dp wide and centered like it. */
const firstFrame: ImageSourcePropType = require('../../../assets/intro/first-frame.png');
const lastFrame: ImageSourcePropType = require('../../../assets/intro/last-frame.png');
/** The film's 1.45 scale, applied to the caption the page sets at 19/30 px with -0.4 px tracking. */
const FILM_SCALE = 1.45;
const HOLD_FADE_MS = 220;
/** Once the film has played in this app run, the start page shows its last frame (owner Q64 a). */
let played = false;

/**
 * Native start page film: plays once, then holds its last frame as an image and native text, with no WebView
 * left running. Its first frame is drawn until the WebView paints. Reduced motion: the last frame only.
 */
export function Explainer({ obscured }: { obscured: boolean }) {
  const motion = useMotionPreference();
  const [phase, setPhase] = useState<'film' | 'ending' | 'held'>(() => (played ? 'held' : 'film'));
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [hold] = useState(() => new Animated.Value(0));
  useEffect(() => { const sub = AppState.addEventListener('change', state => setActive(state === 'active')); return () => sub.remove(); }, []);
  useEffect(() => {
    if (phase !== 'ending') return;
    const fade = Animated.timing(hold, { toValue: 1, duration: HOLD_FADE_MS, useNativeDriver: true });
    fade.start(() => setPhase('held'));
    return () => fade.stop();
  }, [phase, hold]);
  const held = phase === 'held' || motion === true;
  return <View testID="native-home-intro" style={{ height: HEIGHT, width: '100%', maxWidth: 576, backgroundColor: '#070707' }}>
    {/* Until the preference is known (ms after launch, under the startup cover) neither frame is drawn: either could be the wrong one. */}
    {held ? <LastFrame /> : motion === null ? null : <>
      <Film blocked={obscured || !active || phase !== 'film'} onEnded={() => { played = true; setPhase('ending'); }} />
      {phase === 'ending' && <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: hold }}><LastFrame /></Animated.View>}
    </>}
  </View>;
}

function Film({ blocked, onEnded }: { blocked: boolean; onEnded: () => void }) {
  const player = useRef<WebView<object>>(null);
  const [painted, setPainted] = useState(false);
  useEffect(() => { if (painted) player.current?.injectJavaScript(`window.yepIntroState(${JSON.stringify({ blocked })});true;`); }, [painted, blocked]);
  return <>
    <WebView<object> ref={player} source={source} originWhitelist={['*']} onShouldStartLoadWithRequest={request => request.url === 'about:blank'}
      onMessage={event => { if (event.nativeEvent.data === 'painted') setPainted(true); else if (event.nativeEvent.data === 'ended') onEnded(); }}
      scrollEnabled={false} bounces={false} overScrollMode="never" javaScriptEnabled
      style={{ backgroundColor: '#070707' }} />
    {!painted && <Frame image={firstFrame} />}
  </>;
}

function Frame({ image, children }: { image: ImageSourcePropType; children?: ReactNode }) {
  return <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden', alignItems: 'center', backgroundColor: '#070707' }}>
    <Image source={image} accessible={false} fadeDuration={0} style={{ width: 576, height: HEIGHT }} />
    {children}
  </View>;
}

function LastFrame() {
  return <View accessible accessibilityRole="image" accessibilityLabel={LABEL} style={{ height: HEIGHT, width: '100%' }}>
    <Frame image={lastFrame}>
      <Text accessible={false} allowFontScaling={false} numberOfLines={1} style={{ position: 'absolute', left: 0, right: 0, top: 158.05, height: 30 * FILM_SCALE, fontSize: 19 * FILM_SCALE, lineHeight: 30 * FILM_SCALE, letterSpacing: -0.4 * FILM_SCALE, color: '#fafafa', textAlign: 'center', includeFontPadding: false, textAlignVertical: 'center' }}>
        Watch <Text style={{ color: '#fbbf24', fontWeight: '600' }}>and enjoy.</Text>
      </Text>
    </Frame>
  </View>;
}
