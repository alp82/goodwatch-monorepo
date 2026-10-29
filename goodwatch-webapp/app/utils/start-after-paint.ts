// A landing page's scripts start once the page has painted: the start page (docs/implementation/home-intro.md,
// "Loading") and the title pages.
//
// Such a page is complete in the server's HTML and paints before any script runs: the start page's room and boot
// screen, a title page's hero and sections, whose early taps wait for the app (utils/replay-tap.ts). Remix's own markup
// asks for every module of the page from the HTML, so on a slow connection the scripts (200 to 280 KB) share the
// bandwidth with the style sheets and the first screen's pictures, and the first paint waits for all of them. A route
// whose handle is START_AFTER_PAINT gets one classic script in their place (a patch to Remix's `Scripts`,
// patches/@remix-run+react+*.patch): it asks for the modules once the page is on screen.
//
// On screen means: the first contentful paint, and every picture marked with HERO_TIMING that this window shows has
// been painted (Element Timing). Those are the first screen's largest content (the start page's room, a title's
// backdrop), and they can paint a frame after the first paint. A browser without Element Timing waits for the first contentful paint only, one without
// paint timing starts the modules at once, and a tab that never paints (opened in the background) starts them after
// FALLBACK_MS.

/** A route's handle: the route's scripts start after the first paint. */
export const START_AFTER_PAINT = { scripts: "after-paint" } as const

/** The `elementtiming` attribute of a picture that the scripts wait for. Spread it on the `img`. */
export const HERO_TIMING = { elementtiming: "hero" } as const

/** The scripts start after this long even without a paint. */
export const FALLBACK_MS = 5000

/** A value as a script literal that can't end the script element. */
const literal = (value: unknown) =>
	JSON.stringify(value).replace(/</g, "\\u003c")

// The browser half, as plain ES5. Wait only for an image whose box intersects this viewport, that is not an empty
// responsive-source placeholder, and that has not failed to load. An error releases the wait immediately. A picture whose request hasn't
// started has no `currentSrc` yet: it is waited for too. With Early Hints the first paint can come before that.
const BROWSER = `(function(code,preloads,fallback){
var d=document,started=0,painted=0,seen=[];
function start(){if(started)return;started=1;
preloads.forEach(function(href){var link=d.createElement("link");link.rel="modulepreload";link.href=href;d.head.appendChild(link)});
var script=d.createElement("script");script.type="module";script.textContent=code;d.body.appendChild(script)}
var P=window.PerformanceObserver,types=P&&P.supportedEntryTypes||[],timing=types.indexOf("element")>=0;
if(types.indexOf("paint")<0)return start();
function waiting(img){var src=img.currentSrc||"",r=img.getBoundingClientRect();return src.indexOf("data:")!==0&&!(img.complete&&!img.naturalWidth)&&img.getClientRects().length>0&&r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.top<window.innerHeight&&r.left<window.innerWidth&&seen.indexOf(img)<0}
function check(){if(started||!painted)return;if(timing){var heroes=d.querySelectorAll('img[elementtiming="hero"]');for(var i=0;i<heroes.length;i++)if(waiting(heroes[i])){heroes[i].addEventListener("error",check,{once:true});return}}setTimeout(start)}
new P(function(list){if(list.getEntriesByName("first-contentful-paint").length){painted=1;check()}}).observe({type:"paint",buffered:true});
if(timing)new P(function(list){list.getEntries().forEach(function(entry){if(entry.element)seen.push(entry.element)});check()}).observe({type:"element",buffered:true});
setTimeout(start,fallback)})`.replace(/\n/g, "")

/**
 * The classic script that starts a page's modules: the module preloads in the head, then Remix's module script (`code`)
 * at the end of the body. Both are after the server's nodes, where React's hydration of the document leaves them alone.
 */
export function startAfterPaintScript(
	code: string,
	preloads: string[],
): string {
	return `${BROWSER}(${literal(code)},${literal(preloads)},${FALLBACK_MS})`
}
