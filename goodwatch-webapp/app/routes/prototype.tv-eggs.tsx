// PROTOTYPE - throwaway (2026-10-29). Question: where can the old start page's TV and Remote live on as an easter
// egg? Round 2: one picked design per page, ?page=404|error|signout|maintenance (round 1 variants and the
// surfing page are in this branch's history, 0ff28e5bb).
// The room fills the window; the Remote in the hand has Power, CH+, CH-, OK, Netflix and Prime Video.
// Extra params: ?path=/movies/the-matrx (404 guesses), ?outcome=fail (error page: the first retry fails).
import type { LinksFunction } from "@remix-run/node"
import { useSearchParams } from "@remix-run/react"
import { useEffect, useState } from "react"
import livingRoomCss from "~/ui/living-room/living-room.css?url"
import eggsCss from "~/ui/prototype-tv-eggs/eggs.css?url"
import { Page404 } from "~/ui/prototype-tv-eggs/page-404"
import { PageError } from "~/ui/prototype-tv-eggs/page-error"
import { PageMaintenance } from "~/ui/prototype-tv-eggs/page-maintenance"
import { PageSignout } from "~/ui/prototype-tv-eggs/page-signout"

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
	"404": "1 · Channel 404",
	error: "2 · Right back",
	signout: "3 · Signed out",
	maintenance: "4 · Maintenance",
} as const
type PageKey = keyof typeof PAGES

export default function TvEggsPrototype() {
	const [params, setParams] = useSearchParams()
	const page = (params.get("page") as PageKey) in PAGES ? (params.get("page") as PageKey) : "404"
	const path = params.get("path") ?? "/movies/the-matrx-1999"
	// Clocks, noise and timers differ between the server and the browser: draw the pages in the browser only.
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])
	const go = (p: PageKey) => {
		const next = new URLSearchParams(params)
		next.set("page", p)
		next.delete("variant")
		setParams(next, { replace: true, preventScrollReset: true })
	}
	return (
		<div className="bg-[#1a0f0a]">
			<nav className="fixed z-50 flex max-w-[calc(100vw-16px)] max-md:left-1/2 max-md:top-[72px] max-md:-translate-x-1/2 md:bottom-4 md:left-4 gap-1 overflow-x-auto rounded-full bg-white p-1 text-xs font-semibold text-black shadow-2xl ring-2 ring-fuchsia-500">
				{(Object.keys(PAGES) as PageKey[]).map((p) => (
					<button
						key={p}
						type="button"
						onClick={() => go(p)}
						className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 ${p === page ? "bg-fuchsia-600 text-white" : "hover:bg-neutral-200"}`}
					>
						{PAGES[p]}
					</button>
				))}
			</nav>
			{!mounted ? (
				<div style={{ height: "calc(100svh - 64px)" }} />
			) : page === "error" ? (
				<PageError key={page} />
			) : page === "signout" ? (
				<PageSignout key={page} />
			) : page === "maintenance" ? (
				<PageMaintenance key={page} />
			) : (
				<Page404 key={page} path={path} />
			)}
		</div>
	)
}
