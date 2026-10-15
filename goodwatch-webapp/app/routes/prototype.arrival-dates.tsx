// PROTOTYPE - throwaway (#625, child of #365, follows #489). What the "new on your services" page can honestly say
// about arrival dates, depending on how GoodWatch learns what arrived. It is variation D of prototype C (the ranked
// landing page the owner chose) under each data option of the research; only words, grouping and labels change.
//   /prototype/arrival-dates?variant=A|B|C|D|E|F
//     A  A day per arrival    option 1: daily lists everywhere, every title has a day
//     B  This week            option 2: weekly rechecks, "this week" and "last week", never a day
//     C  Mix by service size  option 3: big services daily, small ones (MUBI) weekly
//     D  Mix by country       option 4: the United States and Germany daily, Brazil weekly
//     E  Mix by popularity    option 5: popular titles daily, the long tail weekly, one ranked list
//     F  No days (control)    any option: best first, the page never says a day
//     &viewer=visitor|member|quiet          a visitor; a member with 5 wanted titles that landed; a member without
//     &data=several|one|none|first          how much arrived; "first" is the first week of watching
//     &country=US|DE|BR &service=netflix    (or services=netflix,hulu) the page's own choices
//     &chrome=off                           hides the prototype's own controls (the pill stays)
// The pill at the bottom, or the left and right arrow keys, switches the variation. "State" shows how each service
// is checked, every title's real day next to what the page says, and the page as a search result.
// Every title is prepared in ui/prototype-arrival-dates/model.ts: no loader reads a service, nothing is written.
// Notes and screenshots: docs/prototypes/arrival-dates/README.md.
import type { MetaFunction } from "@remix-run/node"
import { useSearchParams } from "@remix-run/react"
import type { PageProps } from "~/ui/prototype-arrival-dates/bits"
import { Controls } from "~/ui/prototype-arrival-dates/chrome"
import { Landing } from "~/ui/prototype-arrival-dates/landing"
import {
	VARIANTS,
	arrivalsOf,
	choiceOf,
	seoOf,
} from "~/ui/prototype-arrival-dates/model"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

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

export default function ArrivalDatesPrototype() {
	const [params, setParams] = useSearchParams()
	const choice = choiceOf(params)
	const changed = (next: Record<string, string>) => {
		const p = new URLSearchParams(params)
		// `service` is the short form of `services`: a new choice of services replaces it.
		if ("services" in next) p.delete("service")
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
		href: (next) => `/prototype/arrival-dates?${changed(next)}`,
	}
	return (
		<>
			<Landing {...page} />
			<Controls page={page} hidden={params.get("chrome") === "off"} />
			<PrototypeSwitcher
				variants={VARIANTS}
				position="bottom-[84px] left-1/2 -translate-x-1/2 lg:bottom-6 !z-[1050]"
			/>
		</>
	)
}
