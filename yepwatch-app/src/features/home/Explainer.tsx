import { type ReactNode, useEffect, useRef, useState } from 'react';
import { AppState, Image, Text, View, type ImageSourcePropType } from 'react-native';
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

/**
 * Native intro film: it loops for as long as it's on screen and never holds its last frame. Its first frame is
 * drawn until the WebView paints. Reduced motion: a still of the last frame (an image and native text), no WebView.
 */
export function Explainer({ obscured }: { obscured: boolean }) {
  const motion = useMotionPreference();
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => { const sub = AppState.addEventListener('change', state => setActive(state === 'active')); return () => sub.remove(); }, []);
  return <View testID="native-home-intro" style={{ height: HEIGHT, width: '100%', maxWidth: 576, backgroundColor: '#070707' }}>
    {/* Until the preference is known (ms after launch, under the startup cover) nothing is drawn: either picture could be the wrong one. */}
    {motion === null ? null : motion ? <StillFrame /> : <Film blocked={obscured || !active} />}
  </View>;
}

function Film({ blocked }: { blocked: boolean }) {
  const player = useRef<WebView<object>>(null);
  const [painted, setPainted] = useState(false);
  useEffect(() => { if (painted) player.current?.injectJavaScript(`window.yepIntroState(${JSON.stringify({ blocked })});true;`); }, [painted, blocked]);
  return <>
    <WebView<object> ref={player} source={source} originWhitelist={['*']} onShouldStartLoadWithRequest={request => request.url === 'about:blank'}
      onMessage={event => { if (event.nativeEvent.data === 'painted') setPainted(true); }}
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

function StillFrame() {
  return <View accessible accessibilityRole="image" accessibilityLabel={LABEL} style={{ height: HEIGHT, width: '100%' }}>
    <Frame image={lastFrame}>
      <Text accessible={false} allowFontScaling={false} numberOfLines={1} style={{ position: 'absolute', left: 0, right: 0, top: 158.05, height: 30 * FILM_SCALE, fontSize: 19 * FILM_SCALE, lineHeight: 30 * FILM_SCALE, letterSpacing: -0.4 * FILM_SCALE, color: '#fafafa', textAlign: 'center', includeFontPadding: false, textAlignVertical: 'center' }}>
        Watch <Text style={{ color: '#fbbf24', fontWeight: '600' }}>and enjoy.</Text>
      </Text>
    </Frame>
  </View>;
}
