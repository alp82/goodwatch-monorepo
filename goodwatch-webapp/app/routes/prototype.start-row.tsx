// PROTOTYPE - throwaway (#541, on the prototype branch named in the ticket). Five variants of the "Talked about now" row on the real
// start page: the living room and the section below it as a guest sees them, with the row mounted at the top of the
// section (BelowRoom.tsx's prototype slot). `?variant=A|B|C|D|E`, switched by the floating bar or ← → below the room.
//   A Ranked: ten title cards with big rank numbers and a "why it's hot" chip.
//   B Mixed: each hot title followed by its trailer (click-to-load facade), a post and a headline.
//   C Ticker: one crawling line, Expand opens the ten; the room's lip names the top three.
//   D Pulse: a board with each title's 14-day buzz curve; the lead title large with its curve and best content.
//   E Pulse + native: D with B's native content: the lead carries its two or three best pieces, each row a preview.
// All data is made up in memory (ui/prototype-start-row/data.ts); nothing is read or written, nothing is fetched from
// a third party. Run without services and with the flags on, as docs/prototypes/talked-about-now/start-row/README.md
// says, and open /prototype/start-row?variant=A#browse.
// A production build leaves the route out (PROTOTYPES in vite.config.js: `prototype.start-row*`).
import { type LinksFunction, json } from "@remix-run/node"
import { useLoaderData, useLocation } from "@remix-run/react"
import { useMemo } from "react"
import { tvServices } from "~/server/living-room/tv-home.server"
import { BelowRoomPrototypeSlot } from "~/ui/living-room/BelowRoom"
import livingRoomCss from "~/ui/living-room/living-room.css?url"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import { TvLivingRoom } from "~/ui/living-room/tv/TvLivingRoom"
import type { TvHomeData } from "~/ui/living-room/tv/tv-home"
import { Switcher } from "~/ui/prototype-start-row/Switcher"
import { VariantMixed } from "~/ui/prototype-start-row/VariantMixed"
import { VariantPulse } from "~/ui/prototype-start-row/VariantPulse"
import { VariantPulseNative } from "~/ui/prototype-start-row/VariantPulseNative"
import { VariantRanked } from "~/ui/prototype-start-row/VariantRanked"
import { TICKER_LIP, VariantTicker } from "~/ui/prototype-start-row/VariantTicker"

const VARIANTS = {
	A: "Ranked",
	B: "Mixed",
	C: "Ticker",
	D: "Pulse",
	E: "Pulse + native",
}

/** The section's own "Popular right now" list, as on the real page (there it is the 16 start titles). */
const START_TITLES: StartTitle[] = [
	{ media_type: "show", tmdb_id: 95480, title: "Slow Horses", release_year: 2022, poster_path: "/AdYr4DjOgXvDUMwu6vEhZy1Rnxk.jpg" },
	{ media_type: "show", tmdb_id: 95396, title: "Severance", release_year: 2022, poster_path: "/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg" },
	{ media_type: "movie", tmdb_id: 546554, title: "Knives Out", release_year: 2019, poster_path: "/pThyQovXQrw2m0s9x82twj48Jq4.jpg" },
	{ media_type: "show", tmdb_id: 136315, title: "The Bear", release_year: 2022, poster_path: "/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg" },
	{ media_type: "movie", tmdb_id: 329865, title: "Arrival", release_year: 2016, poster_path: "/pEzNVQfdzYDzVK0XqxERIw2x2se.jpg" },
	{ media_type: "show", tmdb_id: 83867, title: "Andor", release_year: 2022, poster_path: "/khZqmwHQicTYoS7Flreb9EddFZC.jpg" },
	{ media_type: "movie", tmdb_id: 346648, title: "Paddington 2", release_year: 2017, poster_path: "/1OJ9vkD5xPt3skC6KguyXAgagRZ.jpg" },
	{ media_type: "show", tmdb_id: 107113, title: "Only Murders in the Building", release_year: 2021, poster_path: "/1yjFVQZuW8aofZ5Cgol8iImsVFp.jpg" },
	{ media_type: "movie", tmdb_id: 157336, title: "Interstellar", release_year: 2014, poster_path: "/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg" },
]

export function loader() {
	return json<TvHomeData>({
		member: false,
		startTitles: START_TITLES,
		// The TV's first picture: the top hot title's backdrop (East of Eden).
		picture: "/70RZX7kNjA0Qjn6HigB1oMvFJ8R.jpg",
		tonight: [],
		shows: null,
		services: tvServices([]),
	})
}

export const meta = () => [
	{ title: "Talked about now, start row (prototype) · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]
export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: livingRoomCss },
	{ rel: "preconnect", href: "https://image.tmdb.org" },
]
// The data never changes: no TV screen and no variant asks the loader again.
export const shouldRevalidate = () => false

export default function StartRowPrototype() {
	const data = useLoaderData<typeof loader>() as unknown as TvHomeData
	const variant = new URLSearchParams(useLocation().search).get("variant") ?? "A"
	const slot = useMemo(
		() => ({
			row:
				variant === "B" ? <VariantMixed /> : variant === "C" ? <VariantTicker /> : variant === "D" ? (
						<VariantPulse />
					) : variant === "E" ? (
						<VariantPulseNative />
					) : (
						<VariantRanked />
					),
			lip: variant === "C" ? TICKER_LIP : undefined,
		}),
		[variant],
	)
	return (
		<BelowRoomPrototypeSlot.Provider value={slot}>
			<TvLivingRoom data={data} />
			<Switcher variants={VARIANTS} />
			{/* The query devtools' button sits over the phone's lower right corner. */}
			<style>{".tsqd-open-btn-container{display:none!important}"}</style>
		</BelowRoomPrototypeSlot.Provider>
	)
}
