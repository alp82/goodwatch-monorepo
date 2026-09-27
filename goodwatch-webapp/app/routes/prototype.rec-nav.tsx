// PROTOTYPE - throwaway. #192 (map #172): how a person moves between Home (the Living room), Watch next, Discover
// and Search, Taste, and Explorer on a phone, and how the desktop header changes to match. A simulated app shell
// covers the site's real header and bottom nav and draws light mocks of each settled page.
//   /prototype/rec-nav?variant=tabs|search|merge|hub|command&page=home|watch|discover|taste|explorer&as=member|guest
// Extra: &tab=sides|crowd|fingerprint (Taste), &s=1&q=<text> (Discover in search mode).
// No database reads: titles are a fixed snapshot in app/ui/prototype-rec-nav/data.ts. Nothing is written.
import type { LinksFunction } from "@remix-run/node"
import { useSearchParams } from "@remix-run/react"
import { useState } from "react"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { Shell } from "~/ui/prototype-rec-nav/Shell"
import type { VariantKey } from "~/ui/prototype-rec-nav/model"
import css from "~/ui/prototype-rec-nav/nav.css?url"
import { VARIANTS } from "~/ui/prototype-rec-nav/variants"

export async function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return null
}

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@400..900&display=swap" },
	{ rel: "stylesheet", href: css },
]
// Every state lives in the URL, but none of it needs the (empty) loader again.
export const shouldRevalidate = () => false

export const meta = () => [{ title: "Navigation prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

export default function RecNavPrototype() {
	const [params, setParams] = useSearchParams()
	const raw = params.get("variant") as VariantKey
	const variant: VariantKey = raw in VARIANTS ? raw : "tabs"
	const who = params.get("as") === "guest" ? "guest" : "member"
	const [open, setOpen] = useState(false)
	const setWho = (w: string) => {
		const p = new URLSearchParams(params)
		w === "member" ? p.delete("as") : p.set("as", w)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	return (
		<>
			<Shell key={variant} variant={variant} />
			<div className={`rn-dev ${open ? "" : "is-closed"}`}>
				<button type="button" className="rn-dev-pill" onClick={() => setOpen(!open)}>
					{open ? "Hide" : `${variant} · ${who}`}
				</button>
				<div className="rn-dev-body">
					<div className="rn-dev-sw">
						<PrototypeSwitcher variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, v.name]))} position="top-0 left-0" />
					</div>
					<div className="rn-dev-who">
						{["member", "guest"].map((w) => (
							<button type="button" key={w} className={who === w ? "is-on" : ""} onClick={() => setWho(w)}>
								{w === "member" ? "Member" : "Guest"}
							</button>
						))}
					</div>
				</div>
			</div>
		</>
	)
}
