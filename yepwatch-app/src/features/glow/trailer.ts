/** Only canonical YouTube identities enter either embedded player. */
export function youtubeId(value: string | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase();
    const id =
      host === 'youtu.be'
        ? u.pathname.slice(1)
        : ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(
            host
          )
        ? u.pathname === '/watch'
          ? u.searchParams.get('v')
          : u.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1]
        : null;
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
export interface Playback {
  state: number;
  muted: boolean;
  volume: number;
  error?: string;
}
export function reportedAudible(p: Playback | null) {
  return !p?.error && p?.state === 1 && p.muted === false && p.volume > 0;
}
export function embeddingRefused(p: Playback | null) {
  return p?.error === '101' || p?.error === '150';
}
export function playbackMessage(p: Playback | null) {
  if (embeddingRefused(p)) return 'This trailer cannot play inside the app. Watch it on YouTube.';
  if (p?.error)
    return 'Trailer playback is unavailable. Use the player controls or watch on YouTube.';
  if (!p) return 'Connecting to the trailer player…';
  if (reportedAudible(p)) return 'Playing · sound on';
  if (p.state === 1) return 'Playing · sound off';
  if (p.state === 2) return 'Paused';
  return 'Use the player to start playback.';
}
export function playerHtml(id: string, channel: string) {
  // id/channel are generated/validated, never arbitrary catalog HTML.
  return `<!doctype html><html><meta name="referrer" content="strict-origin-when-cross-origin"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#player{margin:0;width:100%;height:100%;background:#000;overflow:hidden}</style><div id="player"></div><script>
var p,playbackError;function report(error){if(error)playbackError=String(error);if(!p)return;var data={channel:${JSON.stringify(
    channel
  )},state:p.getPlayerState?p.getPlayerState():-1,muted:p.isMuted?p.isMuted():true,volume:p.getVolume?p.getVolume():0};if(playbackError)data.error=playbackError;var raw=JSON.stringify(data);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(raw);else parent.postMessage(data,'*')}
function onYouTubeIframeAPIReady(){p=new YT.Player('player',{videoId:${JSON.stringify(
    id
  )},playerVars:{autoplay:1,playsinline:1,rel:0},events:{onReady:function(){p.playVideo();report()},onStateChange:function(e){if(e.data===1)playbackError=undefined;report()},onError:function(e){report(e.data)},onAutoplayBlocked:function(){report('Playback needs a tap')}}});setInterval(function(){report()},700)}
function command(c){if(!p)return;if(c==='sound'){p.unMute();p.setVolume(100);p.playVideo()}if(c==='play')p.playVideo();if(c==='pause')p.pauseVideo();setTimeout(function(){report()},100)}
window.addEventListener('message',function(e){if(e.source!==parent)return;if(e.data&&e.data.channel===${JSON.stringify(
    channel
  )})command(e.data.command)});var tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';document.head.appendChild(tag);
</script></html>`;
}
