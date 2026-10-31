// Opening a pick's detail. PickContext: the page tells the results which pick's detail is open and how to toggle it.
// `PickTap` wraps a result poster and hands it `open`, which the poster card takes as its `onOpen`: the card keeps the
// site's standard actions (a panel on hover, tiles after the first tap on a touch screen), and a click on the poster,
// its Open tile or a tap on the bare art opens the detail instead of the title page (a tap on the open one closes it;
// a card too narrow for actions opens it on the first tap). The card's own link stays for middle-click and new tabs.
// The wrapper carries data-pop-id so the quick view can lift that poster. A press on a poster starts loading the
// detail's code, so a first open never waits for it.
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

/** A result poster; `children` gets the toggle for its detail (undefined without a page that shows details). */
export function PickTap({
	r,
	children,
}: {
	r: Ranked
	children: (open: (() => void) | undefined) => React.ReactNode
}) {
	const api = useContext(PickContext)
	const { pool } = useForYou()
	if (!api) return <>{children(undefined)}</>
	const key = pool.keys[r.index]
	const on = api.openId === key
	return (
		<div
			data-pop-id={key}
			className="relative"
			onPointerDown={preloadDetailSurfaces}
		>
			{children(() => api.toggle(r))}
			<span
				aria-hidden="true"
				className="pointer-events-none absolute -inset-1 z-40 rounded-xl ring-2 ring-amber-400 transition-opacity duration-200"
				style={{ opacity: on ? 1 : 0 }}
			/>
		</div>
	)
}
