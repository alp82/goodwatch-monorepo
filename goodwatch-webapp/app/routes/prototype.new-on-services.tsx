// PROTOTYPE - throwaway (#489, prototype C). A "new on your services" page: what arrived on the streaming services
// lately, for everyone and not only the titles a member waits for (#456 tells a member about those alone, and only
// until they open My shows or My movies).
// Four variations of the page on this one route, for a visitor and for a member:
//   /prototype/new-on-services?variant=A|B|C|D
//     A  Day by day     a list with scores, grouped by the day a title was found
//     B  By service     a shelf of posters per service, what the member waited for on top
//     C  Poster wall    every arrival as a poster, best score first, movies and shows as the choice
//     D  Landing page   one heading, the ten best ranked, links to every service and country
//     &viewer=visitor|member|quiet   a visitor; a member with wanted titles that landed; a member without
//     &data=several|one|none         how much arrived
//     &country=US|DE &services=netflix,hulu &kind=movie|show   the page's own choices, kept in the address
//     &chrome=off                    hides the prototype's own controls (the pill stays)
// The pill at the bottom, or the left and right arrow keys, switches the variation. "State" shows the full state
// and the page as a search result: the address the real page would have, its title, heading and description.
// Every title is prepared in ui/prototype-new-on-services/model.ts: no loader reads a service, nothing is written.
// Notes and screenshots: docs/prototypes/new-on-services/README.md.
import type { MetaFunction } from "@remix-run/node"
import { useSearchParams } from "@remix-run/react"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { VariantA } from "~/ui/prototype-new-on-services/a-days"
import { VariantB } from "~/ui/prototype-new-on-services/b-services"
import type { PageProps } from "~/ui/prototype-new-on-services/bits"
import { VariantC } from "~/ui/prototype-new-on-services/c-wall"
import { Controls } from "~/ui/prototype-new-on-services/chrome"
import { VariantD } from "~/ui/prototype-new-on-services/d-landing"
import {
	arrivalsOf,
	choiceOf,
	pick,
	seoOf,
} from "~/ui/prototype-new-on-services/model"

const VARIANTS = {
	A: "Day by day",
	B: "By service",
	C: "Poster wall",
	D: "Landing page",
}

export async function loader() {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return null
}

// The title the real page would have, so that the browser's tab shows it. The prototype itself is never listed.
export const meta: MetaFunction = ({ location }) => {
	const choice = choiceOf(new URLSearchParams(location.search))
	const seo = seoOf(choice, arrivalsOf({ ...choice, kind: "all" }))
	return [
		{ title: seo.title },
		{ name: "description", content: seo.description },
		{ name: "robots", content: "noindex, nofollow" },
	]
}

export default function NewOnServicesPrototype() {
	const [params, setParams] = useSearchParams()
	const variant = pick(VARIANTS, params.get("variant"), "A")
	const choice = choiceOf(params)
	const changed = (next: Record<string, string>) => {
		const p = new URLSearchParams(params)
		// An empty value takes the parameter away.
		for (const [k, v] of Object.entries(next))
			v === "" ? p.delete(k) : p.set(k, v)
		return p
	}
	const everything = arrivalsOf({ ...choice, kind: "all" })
	const page: PageProps = {
		choice,
		arrivals: arrivalsOf(choice),
		everything,
		seo: seoOf(choice, everything),
		set: (next) =>
			setParams(changed(next), { replace: true, preventScrollReset: true }),
		href: (next) => `/prototype/new-on-services?${changed(next)}`,
	}
	return (
		<>
			{variant === "A" && <VariantA {...page} />}
			{variant === "B" && <VariantB {...page} />}
			{variant === "C" && <VariantC {...page} />}
			{variant === "D" && <VariantD {...page} />}
			<Controls
				page={page}
				variant={`${variant} (${VARIANTS[variant]})`}
				hidden={params.get("chrome") === "off"}
			/>
			<PrototypeSwitcher
				variants={VARIANTS}
				position="bottom-[84px] left-1/2 -translate-x-1/2 lg:bottom-6 !z-[1050]"
			/>
		</>
	)
}
