// PROTOTYPE for "Prototype native-scroll carousels on title pages". Throwaway code: not for production.
//
// A row that scrolls sideways with the browser's own scrolling: a CSS scroll container with snap points, and two
// arrow buttons. No Swiper instance, on the server or in the browser.
//
// The arrows work before hydration: one delegated click handler for every row on the page, in an inline script that
// runs while the document is parsed. React attaches nothing to the arrows, so the handler stays the only one after
// hydration. The same script marks a row that is at its start or end (the arrow there fades) and remembers a tap on
// a `data-early-tap` control that came before hydration, so the control can act on it once it runs.
import { ChevronLeftIcon } from "@heroicons/react/24/outline"
import { ChevronRightIcon } from "@heroicons/react/24/solid"
import type React from "react"
import { useEffect } from "react"

export const NATIVE_ROW_SCRIPT = `(function(){
if(window.__gwRows)return;window.__gwRows=1;
function sync(t){var r=t.closest('[data-nrow]');if(!r)return;var max=t.scrollWidth-t.clientWidth,a=[];
if(t.scrollLeft<=2)a.push('start');if(t.scrollLeft>=max-2)a.push('end');r.setAttribute('data-at',a.join(' '))}
document.addEventListener('click',function(e){
var el=e.target&&e.target.closest?e.target:null;if(!el)return;
var early=el.closest('[data-early-tap]');if(early)early.setAttribute('data-tapped','1');
var b=el.closest('[data-nrow-dir]');if(!b)return;
var r=b.closest('[data-nrow]'),t=r&&r.querySelector('[data-nrow-track]');if(!t)return;
e.preventDefault();
var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
t.scrollBy({left:Number(b.getAttribute('data-nrow-dir'))*t.clientWidth,behavior:reduce?'auto':'smooth'});
},true);
document.addEventListener('scroll',function(e){var t=e.target;
if(t&&t.nodeType===1&&t.hasAttribute('data-nrow-track'))sync(t)},true);
})()`

// Columns per screen width, as ListSwiper has them: 3 on a phone, 8 on a wide screen. A column is a share of the
// row's width, so a tap on an arrow moves by exactly one screen of items.
export const NATIVE_ROW_CSS = `
[data-nrow]{position:relative}
[data-nrow-track]{display:flex;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;
scrollbar-width:none;-webkit-overflow-scrolling:touch}
[data-nrow-track]::-webkit-scrollbar{display:none}
[data-nrow-track]>*{flex:none;scroll-snap-align:start}
[data-nrow-track][data-cols]{--n:3;--g:3px;gap:var(--g)}
[data-nrow-track][data-cols]>*{width:calc((100% - (var(--n) - 1) * var(--g)) / var(--n))}
@media (min-width:480px){[data-nrow-track][data-cols]{--n:4;--g:4px}}
@media (min-width:640px){[data-nrow-track][data-cols]{--n:5;--g:5px}}
@media (min-width:768px){[data-nrow-track][data-cols]{--n:6;--g:6px}}
@media (min-width:1024px){[data-nrow-track][data-cols]{--n:7;--g:7px}}
@media (min-width:1280px){[data-nrow-track][data-cols]{--n:8;--g:8px}}
[data-nrow-dir]{transition:opacity .15s}
[data-nrow][data-at~=start] [data-nrow-dir="-1"],[data-nrow][data-at~=end] [data-nrow-dir="1"]{opacity:.3;cursor:default}
[data-nrow][data-at="start end"] [data-nrow-dir]{display:none}
`

/** The prototype's stylesheet and the inline script, once per page, before the first row. */
export function NativeRowAssets() {
	// A page opened by a navigation inside the app gets no inline script run by the parser: start it here.
	useEffect(() => {
		if ((window as { __gwRows?: number }).__gwRows) return
		const script = document.createElement("script")
		script.text = NATIVE_ROW_SCRIPT
		document.head.appendChild(script)
	}, [])
	return (
		<>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant of this file. */}
			<style dangerouslySetInnerHTML={{ __html: NATIVE_ROW_CSS }} />
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant of this file. */}
			<script dangerouslySetInnerHTML={{ __html: NATIVE_ROW_SCRIPT }} />
		</>
	)
}

const ARROW =
	"absolute top-1/2 -translate-y-1/2 z-10 p-2 bg-blue-600 text-white rounded-full shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 cursor-pointer"

export interface NativeRowProps {
	children: React.ReactNode
	/** Share the row's width between a fixed number of columns per screen width. Without it, items keep their own width. */
	columns?: boolean
	/** Without arrows the row is scrolled by touch, trackpad, or keyboard only. */
	arrows?: boolean
	label: string
	trackClassName?: string
	trackRef?: React.Ref<HTMLDivElement>
}

export function NativeRow({
	children,
	columns = false,
	arrows = true,
	label,
	trackClassName = "",
	trackRef,
}: NativeRowProps) {
	return (
		<div data-nrow="" data-at="start">
			<div
				ref={trackRef}
				data-nrow-track=""
				data-cols={columns ? "" : undefined}
				// biome-ignore lint/a11y/useSemanticElements: a scrolling group of links, as the carousel was.
				role="group"
				aria-label={label}
				className={trackClassName}
			>
				{children}
			</div>
			{arrows && (
				<>
					<button
						type="button"
						data-nrow-dir="-1"
						aria-label={`Scroll ${label} back`}
						className={`${ARROW} left-0`}
					>
						<ChevronLeftIcon className="h-6 w-6" />
					</button>
					<button
						type="button"
						data-nrow-dir="1"
						aria-label={`Scroll ${label} forward`}
						className={`${ARROW} right-0`}
					>
						<ChevronRightIcon className="h-6 w-6" />
					</button>
				</>
			)}
		</div>
	)
}
