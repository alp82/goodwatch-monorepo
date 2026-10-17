// PROTOTYPE - throwaway. Fingerprint clips: what title analysis reads from every movie and show.
import type { FeelTitle } from "~/server/prototype-intro/feel.server"
import type { ClipProps } from "../../clip"
import { NoData, PILLAR_EMOJI, PILLAR_HEX, Root, TIER_WORD, at, feelOf, img, word } from "./common"

const PILLARS = ["Energy", "Heart", "Humor", "World", "Craft", "Style"] as const

/** The four dials a viewer feels; Craft and Style are about the making. */
const FELT = ["Energy", "Heart", "Humor", "World"] as const

/** The title whose felt dials differ most, with a picture; a peak of 4 wins ties. */
function mostShaped(titles: FeelTitle[]) {
	const spread = (t: FeelTitle) => {
		const v = FELT.map((p) => t.pillars[p])
		return Math.max(...v) - Math.min(...v) + (Math.max(...v) === 4 ? 0.5 : 0)
	}
	return [...titles].filter((t) => t.poster_path).sort((a, b) => spread(b) - spread(a))[0]
}

/** "Big on humor and heart." from the two highest dials. */
function verdict(t: FeelTitle) {
	const top = [...FELT].sort((a, b) => t.pillars[b] - t.pillars[a]).slice(0, 2)
	const say: Record<string, string> = { Energy: "energy", Heart: "heart", Humor: "laughs", World: "world-building" }
	return `Big on ${say[top[0]]} and ${say[top[1]]}.`
}

// (a) Six dials fill in, one by one, beside the poster.
export function FingerprintDials({ data }: ClipProps) {
	const feel = feelOf(data)
	const t = feel && mostShaped(feel.titles)
	if (!t) return <NoData />
	return (
		<Root>
			<div className="absolute left-[6cqw] top-[11cqh] w-[22cqw]">
				<div className="lpc-fe-poster lpc-fe-deal" style={at(0)}>
					<img src={img(t.poster_path, "w342")} alt="" />
				</div>
				<div className="lpc-fe-rise mt-[1.4cqw] text-[max(11px,2.2cqw)] font-bold leading-tight" style={at(500)}>
					{t.title}
				</div>
			</div>
			<div className="absolute left-[34cqw] right-[5cqw] top-[10cqh]">
				<div className="lpc-fe-kicker lpc-fe-rise" style={at(300)}>
					Title analysis
				</div>
				<div className="lpc-fe-head lpc-fe-rise mt-[1cqw]" style={{ ...at(450), fontSize: "max(18px, 4.8cqw)" }}>
					Every title, read for <em>how it feels.</em>
				</div>
				<div className="mt-[4.5cqh] grid grid-cols-2 gap-x-[4cqw] gap-y-[3.4cqh]">
					{PILLARS.map((p, i) => {
						const tier = t.pillars[p]
						const start = 1500 + i * 260
						return (
							<div key={p} className="lpc-fe-rise flex items-center justify-between gap-[1.5cqw]" style={at(start)}>
								<div className="flex items-center gap-[1cqw] text-[max(11px,2.6cqw)] font-bold">
									<span aria-hidden="true">{PILLAR_EMOJI[p]}</span>
									{p}
								</div>
								<div className="lpc-fe-meter" style={{ "--c": PILLAR_HEX[p] } as React.CSSProperties} aria-label={`${p}: ${TIER_WORD[tier]}`}>
									{[0, 1, 2, 3].map((n) => (
										<i key={n}>{n < tier && <b className="lpc-fe-fill" style={at(start + 250 + n * 140)} />}</i>
									))}
								</div>
							</div>
						)
					})}
				</div>
				<div className="lpc-fe-rise mt-[5cqh] text-[max(14px,3.6cqw)] font-extrabold text-amber-300" style={at(3700)}>
					{verdict(t)}
				</div>
			</div>
		</Root>
	)
}

// (b) Same genre, different evening: two titles that share a genre and feel nothing alike.
export function FingerprintPair({ data }: ClipProps) {
	const pair = feelOf(data)?.pair
	if (!pair) return <NoData />
	const half = (t: FeelTitle, side: "l" | "r", d: number) => (
		<div className={`absolute top-0 h-full w-1/2 overflow-hidden ${side === "l" ? "left-0" : "right-0"}`}>
			<div className="lpc-fe-deal absolute inset-0" style={at(d, { "--dx": side === "l" ? "-10%" : "10%", "--dy": "0%" })}>
				<img src={img(t.backdrop_path, "w780")} alt="" className="h-full w-full object-cover" />
			</div>
			<div className="lpc-fe-shade-b" />
			<div className={`absolute bottom-[22cqh] ${side === "l" ? "left-[4cqw]" : "left-[4cqw]"} right-[3cqw]`}>
				<div className="lpc-fe-rise text-[max(14px,3.4cqw)] font-extrabold leading-none" style={at(d + 900)}>
					{t.title}
				</div>
				<div className="mt-[1.2cqw] flex flex-wrap gap-[0.8cqw]">
					{t.top.slice(0, 3).map((k, i) => (
						<span key={k.key} className="lpc-fe-chip lpc-fe-pop" style={at(d + 1500 + i * 200)}>
							<span aria-hidden="true">{k.emoji}</span>
							{word(k.adjective)}
						</span>
					))}
				</div>
			</div>
		</div>
	)
	return (
		<Root>
			{half(pair.a, "l", 0)}
			{half(pair.b, "r", 250)}
			<div className="absolute left-1/2 top-[7cqh] -translate-x-1/2 text-center">
				<div className="lpc-fe-pop inline-flex flex-col items-center rounded-[1.4cqw] bg-black/70 px-[2.4cqw] py-[1.2cqw]" style={at(900)}>
					<span className="lpc-fe-kicker">Both</span>
					<span className="text-[max(13px,2.8cqw)] font-extrabold">{pair.genre}</span>
				</div>
			</div>
			<div className="absolute inset-x-0 bottom-[6cqh] text-center">
				<div className="lpc-fe-head lpc-fe-rise" style={{ ...at(3300), fontSize: "max(18px, 5.6cqw)" }}>
					Same genre. <em>Different evening.</em>
				</div>
			</div>
		</Root>
	)
}

// (c) The feel, attribute by attribute: big chips with their strength, over the title's picture.
export function FingerprintAttributes({ data }: ClipProps) {
	const feel = feelOf(data)
	const t = feel?.titles.find((x) => x.backdrop_path && x.title.startsWith("Spider-Man")) ?? feel?.titles.find((x) => x.backdrop_path)
	if (!t) return <NoData />
	const keys = t.top.slice(0, 4)
	return (
		<Root>
			<div className="absolute inset-0 overflow-hidden">
				<img src={img(t.backdrop_path, "w1280")} alt="" className="lpc-fe-kb h-full w-full object-cover" style={{ "--len": "7000ms" } as React.CSSProperties} />
			</div>
			<div className="lpc-fe-shade-l" />
			<div className="absolute left-[6cqw] top-[9cqh] w-[60cqw]">
				<div className="lpc-fe-kicker lpc-fe-rise" style={at(300)}>
					How it feels
				</div>
				<div className="lpc-fe-rise mt-[0.6cqw] text-[max(13px,2.8cqw)] font-bold text-white/85" style={at(450)}>
					{t.title}
				</div>
				<div className="mt-[3cqh] flex flex-col gap-[2.2cqh]">
					{keys.map((k, i) => (
						<div key={k.key} className="lpc-fe-deal" style={at(1000 + i * 520, { "--dx": "-8%", "--dy": "0%" })}>
							<div className={`flex items-baseline gap-[1.4cqw] font-extrabold leading-none ${i === keys.length - 1 ? "text-amber-300" : ""}`} style={{ fontSize: "max(17px, 5cqw)" }}>
								<span aria-hidden="true" style={{ fontSize: "0.75em" }}>
									{k.emoji}
								</span>
								{k.label}
							</div>
							<div className="lpc-fe-phone-hide mt-[0.8cqh] h-[0.7cqw] w-[30cqw] overflow-hidden rounded-full bg-white/10">
								<div className="lpc-fe-fill h-full rounded-full" style={{ ...at(1300 + i * 520), width: `${Math.min(100, k.value * 10)}%`, background: k.color.replace(/0\.6\)$/, "1)") }} />
							</div>
						</div>
					))}
				</div>
			</div>
			<div className="lpc-fe-sub lpc-fe-rise absolute bottom-[7cqh] left-[6cqw]" style={at(3400)}>
				Read from the story itself, for every movie and show.
			</div>
		</Root>
	)
}

// (d) One title's fingerprint finds its matches: its strongest attributes fly to titles that share them.
export function FingerprintMatch({ data }: ClipProps) {
	const feel = feelOf(data)
	const t = feel?.loved[0]
	const recs = feel?.recs.slice(0, 3) ?? []
	if (!t || recs.length < 3) return <NoData />
	const keys = t.top.slice(0, 4)
	return (
		<Root>
			<div className="absolute left-[6cqw] right-[6cqw] top-[7cqh]">
				<div className="lpc-fe-kicker lpc-fe-rise" style={at(250)}>
					Title analysis
				</div>
				<div className="lpc-fe-head lpc-fe-rise mt-[0.8cqw]" style={{ ...at(400), fontSize: "max(18px, 5.4cqw)" }}>
					Matched by <em>how it feels.</em>
				</div>
			</div>
			<div className="absolute left-[6cqw] top-[33cqh] w-[17cqw]">
				<div className="lpc-fe-poster lpc-fe-deal" style={at(700)}>
					<img src={img(t.poster_path, "w342")} alt="" />
				</div>
			</div>
			<div className="absolute left-[26cqw] top-[35cqh] flex flex-col items-start gap-[2.2cqh]">
				{keys.map((k, i) => (
					<span key={k.key} className={`lpc-fe-chip lpc-fe-pop ${i > 1 ? "lpc-fe-phone-hide" : ""}`} style={at(1300 + i * 240)}>
						<span aria-hidden="true">{k.emoji}</span>
						{word(k.adjective)}
					</span>
				))}
			</div>
			<div className="absolute right-[5cqw] top-[33cqh] flex gap-[2cqw]">
				{recs.map((r, i) => (
					<div key={r.tmdb_id} className="w-[14cqw]">
						<div className="lpc-fe-poster lpc-fe-deal" style={at(2500 + i * 260, { "--dx": "14%", "--dy": "-10%" })}>
							<img src={img(r.poster_path, "w342")} alt="" />
						</div>
						<div className="mt-[1.2cqw] flex justify-center">
							<span className="lpc-fe-match lpc-fe-pop" style={at(4700 + i * 220)}>
								{r.match}%<span className="lpc-fe-phone-hide">&nbsp;match</span>
							</span>
						</div>
					</div>
				))}
			</div>
			{/* The attributes travel to the matches, one to each. */}
			{keys.slice(0, 3).map((k, i) => (
				<span
					key={`fly-${k.key}`}
					aria-hidden="true"
					className="lpc-fe-chip lpc-fe-amber lpc-fe-fly lpc-fe-phone-hide absolute left-[26cqw] z-10"
					style={at(3500 + i * 300, { top: `${35 + i * 9.2}cqh`, "--tx": `${27 + i * 16}cqw`, "--ty": `${18 - i * 9.2}cqh` })}
				>
					{k.emoji} {word(k.adjective)}
				</span>
			))}
			<div className="lpc-fe-sub lpc-fe-rise absolute bottom-[5cqh] left-[6cqw]" style={at(5300)}>
				Loved {t.title}? These feel the same.
			</div>
		</Root>
	)
}
