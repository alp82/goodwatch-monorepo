// PROTOTYPE - throwaway. "Where it streams" clips. Real availability: the services with the most titles in Germany,
// and every offer of the first start titles in Germany, the US and Britain (server/prototype-intro/scorestream.server.ts).
import type { LandingCard } from "~/server/prototype-landing.server"
import type { Offer } from "~/server/prototype-intro/scorestream.server"
import type { ClipProps } from "../../clip"
import { Frame, Words, at, bestKnown, brands, extraOf, logo, poster } from "./common"

const INCLUDED = ["flatrate"]
/** Services most people in Germany know, in order. */
const KNOWN = [/netflix/i, /prime video$/i, /disney/i, /apple tv/i, /^wow$/i, /rtl/i, /joyn/i, /paramount/i, /magenta/i, /sky/i, /crunchyroll/i, /mubi/i, /ard/i, /zdf/i, /arte/i]
const FREE = ["free", "ads"]
const PAID = ["rent", "buy"]

const offersOf = (props: ClipProps, card: LandingCard, country = "DE", types?: string[]) =>
	brands((extraOf(props.data)?.offers ?? []).filter((o) => o.key === card.key && o.country === country && (!types || types.includes(o.type))))

/** The title with the most offers in the country among those `ok` accepts. */
function richest(props: ClipProps, ok: (c: LandingCard) => boolean = () => true) {
	const cards = props.data.landing.filter(ok)
	const n = (c: LandingCard) => offersOf(props, c).length
	return [...cards].sort((a, b) => n(b) - n(a))[0] ?? props.data.landing[0]
}

/** (a) Every service's logo deals in like the sign-up wall's posters; then only those that carry the title stay lit. */
export function StreamingDeal(props: ClipProps) {
	const extra = extraOf(props.data)
	const card = richest(props, (c) => offersOf(props, c, "DE", INCLUDED).length > 0)
	const lit = new Set(offersOf(props, card, "DE", INCLUDED).map((o) => o.id))
	// The names people know first, then the rest by how many titles they carry.
	const known = (name: string) => KNOWN.findIndex((re) => re.test(name))
	const top = brands(extra?.top ?? []).sort((a, b) => {
		const x = known(a.name)
		const y = known(b.name)
		return (x < 0 ? 99 : x) - (y < 0 ? 99 : y)
	})
	// The lit services are in the grid, among the biggest others.
	const grid = [...top.filter((s) => lit.has(s.id)), ...top.filter((s) => !lit.has(s.id))].slice(0, 12)
	const order = [...grid].sort((a, b) => top.indexOf(a) - top.indexOf(b))
	const names = grid.filter((s) => lit.has(s.id)).map((s) => s.name)
	const said = names.length > 3 ? `${names.slice(0, 2).join(", ")} and ${names.length - 2} more` : names.join(" and ").replace(" and ", names.length === 3 ? ", " : " and ")
	return (
		<Frame>
			<div className="lpc-ss-top">
				<div className="lpc-ss-h">
					<Words text="Every service." from={150} accent="service." />
				</div>
				<div className="lpc-ss-sub lpc-ss-rise" style={at(900)}>
					Netflix to the smallest one, in one place.
				</div>
			</div>
			<div className="lpc-ss-logos">
				{order.map((s, i) => {
					const on = lit.has(s.id)
					return (
						<div key={s.id} className="lpc-ss-logo">
							<div className={on ? "lpc-ss-lift" : "lpc-ss-dim"} style={{ ...at(3300), width: "100%", height: "100%" }}>
								<div className={i % 2 ? "lpc-ss-deal-r" : "lpc-ss-deal"} style={{ ...at(700 + i * 130), width: "100%", height: "100%" }}>
									<img src={logo(s.logo)} alt={s.name} />
								</div>
							</div>
							{on && <div className="lpc-ss-glow lpc-ss-fade" style={at(3400, 600)} />}
						</div>
					)
				})}
			</div>
			<div className="lpc-ss-caption lpc-ss-rise" style={at(3700)}>
				<span className="lpc-ss-amber">{card.title}</span> is on {said || "your services"}.
			</div>
		</Frame>
	)
}

/** (b) One title, every way to watch it here: included, free, or to rent or buy. */
export function StreamingWays(props: ClipProps) {
	const all3 = (c: LandingCard) => [INCLUDED, FREE, PAID].every((t) => offersOf(props, c, "DE", t).length > 0)
	const card = props.data.landing.some(all3)
		? richest(props, all3)
		: richest(props, (c) => offersOf(props, c, "DE", INCLUDED).length > 0 && offersOf(props, c, "DE", PAID).length > 0)
	const cols: { h: string; sub: string; offers: Offer[] }[] = [
		{ h: "Included", sub: "with a subscription", offers: offersOf(props, card, "DE", INCLUDED) },
		{ h: "Free", sub: "with ads or on free apps", offers: offersOf(props, card, "DE", FREE) },
		{ h: "Rent or buy", sub: "pay once", offers: offersOf(props, card, "DE", PAID) },
	]
	return (
		<Frame>
			<div className="lpc-ss-ways-poster lpc-ss-deal-r" style={at(300)}>
				<img src={poster(card.poster_path)} alt="" />
			</div>
			<div className="lpc-ss-top" style={{ right: "26cqw" }}>
				<div className="lpc-ss-kick lpc-ss-fade" style={at(100)}>
					{card.title}
				</div>
				<div className="lpc-ss-h" style={{ fontSize: "7.5cqw" }}>
					<Words text="Every way to watch." from={300} accent="watch." />
				</div>
			</div>
			<div className="lpc-ss-ways">
				{cols.map((col, ci) => (
					<div key={col.h} className="lpc-ss-way">
						<div className="lpc-ss-way-h lpc-ss-rise" style={at(1500 + ci * 700)}>
							{col.h}
							<small>{col.sub}</small>
						</div>
						<div className="lpc-ss-way-logos">
							{col.offers.slice(0, 6).map((o, i) => (
								<div key={o.id} className="lpc-ss-deal" style={at(1800 + ci * 700 + i * 130)}>
									<img src={logo(o.logo)} alt={o.name} />
								</div>
							))}
							{!col.offers.length && (
								<div className="lpc-ss-way-none lpc-ss-fade" style={at(1800 + ci * 700)}>
									Not here right now
								</div>
							)}
						</div>
					</div>
				))}
			</div>
		</Frame>
	)
}

const COUNTRIES = [
	{ code: "DE", name: "Germany" },
	{ code: "US", name: "United States" },
	{ code: "GB", name: "United Kingdom" },
]

/** (c) The same title streams in different places in different countries; the light settles on "where you live". */
export function StreamingCountries(props: ClipProps) {
	const differs = (c: LandingCard) => {
		const sets = COUNTRIES.map((k) => offersOf(props, c, k.code, INCLUDED).map((o) => o.id).sort().join(","))
		return sets.every(Boolean) && new Set(sets).size > 1
	}
	const card = bestKnown(props.data.landing.slice(0, 8), differs)
	return (
		<Frame>
			<div className="lpc-ss-top">
				<div className="lpc-ss-kick lpc-ss-fade" style={at(100)}>
					{card.title}
				</div>
				<div className="lpc-ss-h">
					<Words text="Where you live." from={300} accent="live." />
				</div>
			</div>
			<div className="lpc-ss-rows">
				{COUNTRIES.map((k, ri) => {
					const offers = offersOf(props, card, k.code, INCLUDED)
					const last = ri === 0
					return (
						<div key={k.code} className="lpc-ss-row lpc-ss-rise" style={at(1100 + ri * 250)}>
							{/* The light visits the US and Britain, then settles on Germany: the visitor's country. */}
							{last ? (
								<div className="lpc-ss-row-bg lpc-ss-here-last" style={at(4700)} />
							) : (
								<div className="lpc-ss-row-bg lpc-ss-here" style={at(2300 + (ri - 1) * 1200, 1300)} />
							)}
							<div className="lpc-ss-row-name">{k.name}</div>
							<div className="lpc-ss-row-logos">
								{offers.slice(0, 5).map((o, i) => (
									<div key={o.id} className="lpc-ss-deal" style={at(1400 + ri * 250 + i * 110)}>
										<img src={logo(o.logo)} alt={o.name} />
									</div>
								))}
								{!offers.length && <div className="lpc-ss-row-none">Not streaming</div>}
							</div>
						</div>
					)
				})}
			</div>
		</Frame>
	)
}

/** (d) Illustrative: the alert a member gets when a Wishlist title lands on one of their services. */
export function StreamingAlert(props: ClipProps) {
	const card = richest(props, (c) => offersOf(props, c, "DE", INCLUDED).length > 0 && Boolean(c.poster_path))
	const service = offersOf(props, card, "DE", INCLUDED)[0]
	return (
		<Frame>
			<div className="lpc-ss-top">
				<div className="lpc-ss-h">
					<Words text="Know when it lands." from={150} accent="lands." />
				</div>
			</div>
			<div className="lpc-ss-alert-wrap">
				<div className="lpc-ss-alert lpc-ss-drop" style={at(1600)}>
					<div className="lpc-ss-alert-p">
						<img src={poster(card.poster_path, "w185")} alt="" />
					</div>
					<div className="lpc-ss-alert-txt">
						<div className="lpc-ss-alert-app">
							<span>GoodWatch</span>
							<span>now</span>
						</div>
						<div className="lpc-ss-alert-h">Now on {service?.name ?? "your service"}</div>
						<div className="lpc-ss-alert-s">{card.title}, from your Wishlist</div>
					</div>
					{service && <img className="lpc-ss-alert-logo lpc-ss-pop" style={at(2300)} src={logo(service.logo)} alt="" />}
				</div>
			</div>
			<div className="lpc-ss-caption lpc-ss-rise" style={{ ...at(3200), bottom: "13cqh" }}>
				On your services, in your country. Nothing to check.
			</div>
			<div className="lpc-ss-note lpc-ss-fade" style={{ ...at(3200), left: 0, right: 0, textAlign: "center" }}>
				Illustration of a member's alert
			</div>
		</Frame>
	)
}
