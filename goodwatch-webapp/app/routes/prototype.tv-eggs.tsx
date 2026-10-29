// PROTOTYPE - throwaway (2026-10-29). Question: where can the old start page's TV and Remote live on as an easter
// egg? Five pages, each with variants: ?page=404|error|signout|surf|maintenance and ?variant=a|b|c.
// The TV is simplified to the room photo, one screen and a four-key Remote (Power, CH+, CH-, OK).
// Extra params: ?path=/movies/the-matrx (404 guesses), ?outcome=fail (error page: the first retry fails).
import type { LinksFunction } from "@remix-run/node"
import { useSearchParams } from "@remix-run/react"
import { useEffect, useState } from "react"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import eggsCss from "~/ui/prototype-tv-eggs/eggs.css?url"
import { Page404, VARIANTS_404 } from "~/ui/prototype-tv-eggs/page-404"
import { PageError, VARIANTS_ERROR } from "~/ui/prototype-tv-eggs/page-error"
import { PageMaintenance, VARIANTS_MAINTENANCE } from "~/ui/prototype-tv-eggs/page-maintenance"
import { PageSignout, VARIANTS_SIGNOUT } from "~/ui/prototype-tv-eggs/page-signout"
import { PageSurf, VARIANTS_SURF } from "~/ui/prototype-tv-eggs/page-surf"
import livingRoomCss from "~/ui/living-room/living-room.css?url"

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: livingRoomCss },
	{ rel: "stylesheet", href: eggsCss },
]

export const meta = () => [{ title: "TV easter eggs prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

export const loader = () => {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return null
}

const PAGES = {
	"404": { label: "1 · Channel 404", variants: VARIANTS_404 },
	error: { label: "2 · Right back", variants: VARIANTS_ERROR },
	signout: { label: "3 · Signed out", variants: VARIANTS_SIGNOUT },
	surf: { label: "4 · Surfing", variants: VARIANTS_SURF },
	maintenance: { label: "5 · Maintenance", variants: VARIANTS_MAINTENANCE },
} as const
type PageKey = keyof typeof PAGES

export default function TvEggsPrototype() {
	const [params, setParams] = useSearchParams()
	const page = (params.get("page") as PageKey) in PAGES ? (params.get("page") as PageKey) : "404"
	const variant = params.get("variant") ?? "a"
	const path = params.get("path") ?? "/movies/the-matrx-1999"
	// Clocks, noise and timers differ between the server and the browser: draw the pages in the browser only.
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])
	const go = (p: PageKey) => {
		const next = new URLSearchParams(params)
		next.set("page", p)
		next.set("variant", "a")
		setParams(next, { replace: true, preventScrollReset: true })
	}
	return (
		<div className="min-h-screen bg-gray-900 pt-16">
			<nav className="fixed left-1/2 top-[70px] z-50 flex max-w-[calc(100vw-16px)] -translate-x-1/2 gap-1 overflow-x-auto rounded-full bg-white p-1 text-xs font-semibold text-black shadow-2xl ring-2 ring-fuchsia-500">
				{(Object.keys(PAGES) as PageKey[]).map((p) => (
					<button
						key={p}
						type="button"
						onClick={() => go(p)}
						className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 ${p === page ? "bg-fuchsia-600 text-white" : "hover:bg-neutral-200"}`}
					>
						{PAGES[p].label}
					</button>
				))}
			</nav>
			<div className="pt-10">
				{!mounted ? null : page === "error" ? (
					<PageError key={`${page}${variant}`} variant={variant} />
				) : page === "signout" ? (
					<PageSignout key={`${page}${variant}`} variant={variant} />
				) : page === "surf" ? (
					<PageSurf key={`${page}${variant}`} variant={variant} />
				) : page === "maintenance" ? (
					<PageMaintenance key={`${page}${variant}`} variant={variant} />
				) : (
					<Page404 key={`${page}${variant}`} variant={variant} path={path} />
				)}
			</div>
			<PrototypeSwitcher variants={PAGES[page].variants} />
		</div>
	)
}
