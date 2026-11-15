import { filmMarkup } from './film-markup';
import { introCss } from './intro-styles';
/**
 * Local artwork only: the native intro has no network or navigation dependency.
 * It loops and never holds its last frame. The first play starts without the fade in (the app draws the film's
 * first frame as an image until the page tells it `painted`, so the film takes over from that picture); every
 * later play fades in and out like the web film.
 */
export const nativeIntroHtml = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'"><style>${introCss}
html,body{margin:0;background:#070707;color:#fafafa;font-family:system-ui,sans-serif;overflow:hidden}*{box-sizing:border-box}.mini-intro{height:224px;margin:0}.mini-film{transform:scale(1.45);transform-origin:50% 0}.mini-stage{height:113px;transform:scale(.94)}.mini-captions{margin-top:-4px}.mini-control{top:78px!important}.mini-control{cursor:pointer}
@keyframes native-clock-first{0%,96%{opacity:1}100%{opacity:0}}.mini-film{animation:native-clock-first 18s linear both,mini-clock 18s linear 18s infinite}
</style></head><body class="home-landing"><section class="mini-intro" aria-label="Swipe your picks. Find a shared match. Agree, then watch and enjoy."><div class="mini-film mini-paused" aria-hidden="true">${filmMarkup}</div><button class="mini-control" aria-label="Pause intro"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg></button></section><script>
const stage=document.querySelector('.mini-intro'),film=document.querySelector('.mini-film'),button=document.querySelector('button');
let paused=false,blocked=true,timer;
function post(message){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(message);}
function update(){film.classList.toggle('mini-paused',paused||blocked);stage.classList.toggle('mini-user-paused',paused);button.setAttribute('aria-label',paused?'Play intro':'Pause intro');button.innerHTML=paused?'<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>':'<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';}
window.yepIntroState=function(state){blocked=state.blocked;update();};
stage.addEventListener('pointerdown',()=>{stage.classList.add('mini-touch-controls');clearTimeout(timer);timer=setTimeout(()=>stage.classList.remove('mini-touch-controls'),2200);});
button.addEventListener('click',()=>{paused=!paused;update();});update();
requestAnimationFrame(()=>requestAnimationFrame(()=>post('painted')));
</script></body></html>`;
