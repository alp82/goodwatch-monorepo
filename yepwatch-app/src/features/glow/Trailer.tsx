import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { GText } from './theme';
import { playbackMessage, playerHtml, youtubeId, type Playback } from './trailer';
export function Trailer({ url }: { url: string }) {
  const id = youtubeId(url);
  const player = useRef<WebView<object>>(null);
  const [channel] = useState(() => `yepwatch-player-${Math.random().toString(36).slice(2)}`);
  const [playback, setPlayback] = useState<Playback | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') player.current?.injectJavaScript("command('pause');true;");
    });
    return () => sub.remove();
  }, []);
  if (!id) return <GText>This trailer cannot play here. Open its source from title details.</GText>;
  return (
    <View style={{ gap: 16 }}>
      <View
        style={{
          aspectRatio: 16 / 9,
          minHeight: 200,
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        <WebView<object>
          ref={player}
          source={{
            html: playerHtml(id, channel),
            baseUrl: 'https://yepwatch.com',
          }}
          originWhitelist={['https://*']}
          allowsInlineMediaPlayback
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          onMessage={(e) => {
            try {
              const value = JSON.parse(e.nativeEvent.data);
              if (
                value.channel === channel &&
                typeof value.state === 'number' &&
                typeof value.muted === 'boolean' &&
                typeof value.volume === 'number'
              )
                setPlayback(value);
            } catch {
              /* Ignore unrelated player messages. */
            }
          }}
          onError={() =>
            setPlayback({
              state: -1,
              muted: true,
              volume: 0,
              error: 'unavailable',
            })
          }
        />
      </View>
      <GText color="#a3a3a3" size={14}>
        {playbackMessage(playback)}
      </GText>
    </View>
  );
}
