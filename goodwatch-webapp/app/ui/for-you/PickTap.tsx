// Opening a pick's detail. PickContext: the page tells the results which pick's detail is open and how to toggle it.
// `PickTap` wraps a result poster: a tap opens the detail instead of the title page (the detail links there; the
// card's own link stays for middle-click and new tabs). It carries data-pop-id so the pop-out card can lift that
// poster. A press on a poster starts loading the detail's code, so a first open never waits for it.
import { createContext, useContext } from "react"
import type { Ranked } from "~/domain/for-you-page/rank"
import { preloadDetailSurfaces } from "./LazyDetail"
import { useForYou } from "./context"

export interface PickApi {
	/** The pool key of the pick whose detail is showing. */
	openId: string | null
	toggle: (r: Ranked) => void
}

export const PickContext = createContext<PickApi | null>(null)

/** A result poster: a tap opens its detail (a tap on the open one closes it). */
export function PickTap({
	r,
	children,
}: {
	r: Ranked
	children: React.ReactNode
}) {
	const api = useContext(PickContext)
	const { pool } = useForYou()
	if (!api) return <>{children}</>
	const key = pool.keys[r.index]
	const on = api.openId === key
	return (
		<div
			data-pop-id={key}
			className="relative cursor-pointer"
			onPointerDown={preloadDetailSurfaces}
			onClickCapture={(e) => {
				if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
				e.preventDefault()
				e.stopPropagation()
				api.toggle(r)
			}}
		>
			{children}
			<span
				aria-hidden="true"
				className="pointer-events-none absolute -inset-1 rounded-xl ring-2 ring-amber-400 transition-opacity duration-200"
				style={{ opacity: on ? 1 : 0 }}
			/>
		</div>
	)
}
