import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useReducedMotion } from '../../components/ui';
import { nativeIntroHtml } from './native-intro-html';
const source = { html: nativeIntroHtml };
export function Explainer({ obscured }: { obscured: boolean }) {
  const player = useRef<WebView<object>>(null);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const quiet = useReducedMotion();
  useEffect(() => { const sub = AppState.addEventListener('change', state => setActive(state === 'active')); return () => sub.remove(); }, []);
  useEffect(() => { if (loaded) player.current?.injectJavaScript(`window.yepIntroState(${JSON.stringify({ blocked: obscured || !active, quiet })});true;`); }, [loaded, obscured, active, quiet]);
  return <View testID="native-home-intro" style={{ height: 224, width: '100%', maxWidth: 576 }}>
    <WebView<object> ref={player} source={source} originWhitelist={['*']} onShouldStartLoadWithRequest={request => request.url === 'about:blank'}
      onLoadEnd={() => setLoaded(true)} scrollEnabled={false} bounces={false} overScrollMode="never" javaScriptEnabled
      style={{ backgroundColor: '#070707' }} />
  </View>;
}
