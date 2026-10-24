import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { GText } from './theme';
import { playbackMessage, playerHtml, youtubeId, type Playback } from './trailer';
export function Trailer({ url }: { url: string }) {
  const id = youtubeId(url);
  const frame = useRef<HTMLIFrameElement>(null);
  const [channel] = useState(() => `yepwatch-player-${Math.random().toString(36).slice(2)}`);
  const [playback, setPlayback] = useState<Playback | null>(null);
  useEffect(() => {
    const listener = (e: MessageEvent) => {
      if (
        e.source !== frame.current?.contentWindow ||
        e.data?.channel !== channel ||
        typeof e.data.state !== 'number' ||
        typeof e.data.muted !== 'boolean' ||
        typeof e.data.volume !== 'number'
      )
        return;
      setPlayback(e.data);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [channel]);
  if (!id) return <GText>This trailer cannot play here. Open its source from title details.</GText>;
  return (
    <View style={{ gap: 16 }}>
      <iframe
        ref={frame}
        title="Title trailer"
        srcDoc={playerHtml(id, channel)}
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        style={{
          width: '100%',
          aspectRatio: '16/9',
          minHeight: 200,
          border: 0,
          borderRadius: 16,
          background: '#000',
        }}
      />
      <GText color="#a3a3a3" size={14}>
        {playbackMessage(playback)}
      </GText>
    </View>
  );
}
