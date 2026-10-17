// PROTOTYPE - throwaway. Recommendation clips: picks made from what a person loved, by how titles feel.
import type { CSSProperties } from "react"
import type { FeelRec } from "~/server/prototype-intro/feel.server"
import type { ClipProps } from "../../clip"
import { NoData, Ring, Root, at, feelOf, img, useStageWidth, word } from "./common"

const names = (titles: { title: string }[]) =>
	titles.length < 2 ? (titles[0]?.title ?? "") : `${titles.slice(0, -1).map((t) => t.title).join(", ")} and ${titles[titles.length - 1].title}`

// (a) Because you loved these, you'll love this: three posters, a line, the pick.
export function RecsBecause({ data }: ClipProps) {
	const feel = feelOf(data)
	const pick = feel?.recs[0]
	if (!feel || !pick || feel.loved.length < 3) return <NoData />
	return (
		<Root>
			<div className="absolute left-[6cqw] top-[9cqh] w-[34cqw]">
				<div className="lpc-fe-head lpc-fe-rise" style={{ ...at(300), fontSize: "max(17px, 4.4cqw)" }}>
					Because you loved these,
				</div>
				<div className="relative mt-[5cqh] h-[34cqh]">
					{feel.loved.map((t, i) => (
						<div
							key={t.tmdb_id}
							className="lpc-fe-poster lpc-fe-deal absolute top-0 w-[13cqw]"
							style={at(800 + i * 260, { left: `${i * 10}cqw`, "--r": `${(i - 1) * 6}deg`, "--r0": `${(i - 1) * 6}deg`, zIndex: i, transform: `rotate(${(i - 1) * 6}deg)` })}
						>
							<img src={img(t.poster_path, "w342")} alt={t.title} />
						</div>
					))}
				</div>
			</div>
			{/* The line from the three to the pick. */}
			<div className="lpc-fe-phone-hide absolute left-[39cqw] top-[49cqh] h-[0.5cqw] w-[8cqw] overflow-hidden rounded-full">
				<div className="lpc-fe-fill h-full w-full bg-amber-400" style={at(2100)} />
			</div>
			<div className="absolute right-[5cqw] top-[9cqh] w-[46cqw]">
				<div className="lpc-fe-head lpc-fe-rise text-right" style={{ ...at(2300), fontSize: "max(17px, 4.4cqw)" }}>
					<em>you'll love this.</em>
				</div>
				<div className="lpc-fe-deal relative mt-[4cqh] overflow-hidden rounded-[1.2cqw] shadow-[0_1.5cqw_4cqw_rgba(0,0,0,.6)]" style={at(2500, { "--dx": "12%", "--dy": "-8%" })}>
					<img src={img(pick.backdrop_path, "w780")} alt="" className="aspect-video w-full object-cover" />
					<div className="lpc-fe-shade-b" />
					<div className="absolute bottom-[1.6cqw] left-[1.8cqw] right-[1.8cqw]">
						<div className="text-[max(14px,3.6cqw)] font-extrabold leading-none">{pick.title}</div>
						<div className="mt-[1cqw] flex flex-wrap items-center gap-[0.8cqw]">
							<span className="lpc-fe-match lpc-fe-pop" style={at(3200)}>
								{pick.match}% your taste
							</span>
							{pick.shared.slice(0, 2).map((k, i) => (
								<span key={k.key} className="lpc-fe-chip lpc-fe-pop lpc-fe-phone-hide" style={{ ...at(3450 + i * 180), fontSize: "max(9px,1.5cqw)" }}>
									{word(k.adjective)}
								</span>
							))}
						</div>
					</div>
				</div>
			</div>
			<div className="lpc-fe-sub lpc-fe-rise absolute bottom-[7cqh] left-[6cqw] right-[6cqw]" style={at(4100)}>
				{names(feel.loved)}: three ratings, and GoodWatch knows where to go next.
			</div>
		</Root>
	)
}

// (b) Rate three, and the list sorts itself: ratings land on three posters, then the picks reorder by match.
const SLOT = 14.5 // cqw per poster in the row
export function RecsResort({ data }: ClipProps) {
	const feel = feelOf(data)
	if (!feel || feel.loved.length < 3 || feel.recs.length < 6) return <NoData />
	const final = feel.recs.slice(0, 6) // by match, as the recommender ranked them
	// Where each stood before: by plain score, the way a chart would list them.
	const before = [...final].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
	return (
		<Root>
			<div className="absolute left-[6cqw] right-[6cqw] top-[6cqh] flex items-start justify-between gap-[3cqw]">
				<div>
					<div className="lpc-fe-kicker lpc-fe-rise" style={at(250)}>
						Picks for you
					</div>
					<div className="lpc-fe-head lpc-fe-rise mt-[0.8cqw]" style={{ ...at(400), fontSize: "max(17px, 4.6cqw)" }}>
						Rate three. <em>Your list sorts itself.</em>
					</div>
				</div>
				<div className="lpc-fe-phone-hide flex gap-[1.2cqw]">
					{feel.loved.map((t, i) => (
						<div key={t.tmdb_id} className="relative w-[6.5cqw]">
							<div className="lpc-fe-poster lpc-fe-deal" style={at(700 + i * 180)}>
								<img src={img(t.poster_path, "w185")} alt={t.title} />
							</div>
							<span className="lpc-fe-pop absolute -right-[1cqw] -top-[1cqw] flex h-[3.4cqw] w-[3.4cqw] items-center justify-center rounded-full bg-amber-400 text-[max(9px,1.7cqw)] font-extrabold text-black" style={at(1300 + i * 300)}>
								10
							</span>
						</div>
					))}
				</div>
			</div>
			<div className="absolute left-[6cqw] top-[33cqh]" style={{ width: `${SLOT * 6}cqw`, height: "48cqh" }}>
				{final.map((r: FeelRec, i) => {
					const from = before.indexOf(r)
					return (
						<div
							key={r.tmdb_id}
							className="lpc-fe-move absolute top-0"
							style={{ left: `${i * SLOT}cqw`, width: `${SLOT - 1.8}cqw`, ...at(2600 + Math.abs(from - i) * 40, { "--off": `${(from - i) * SLOT}cqw` }) } as CSSProperties}
						>
							<div className="lpc-fe-poster lpc-fe-rise" style={at(1600 + from * 120)}>
								<img src={img(r.poster_path, "w342")} alt={r.title} />
							</div>
							<div className="mt-[1cqw] flex justify-center">
								<span className="lpc-fe-match lpc-fe-pop" style={at(3800 + i * 140)}>
									{r.match}%
								</span>
							</div>
						</div>
					)
				})}
			</div>
			<div className="lpc-fe-sub lpc-fe-rise absolute bottom-[5cqh] left-[6cqw]" style={at(4700)}>
				Ordered by how close each one is to what you love, not by what's trending.
			</div>
		</Root>
	)
}

// (c) Sides of you: what you love falls into groups, and each gets its own pick.
export function RecsSides({ data }: ClipProps) {
	const feel = feelOf(data)
	const sides = feel?.sides.filter((s) => s.pick).slice(0, 3) ?? []
	if (sides.length < 2) return <NoData />
	return (
		<Root>
			<div className="absolute left-[6cqw] right-[6cqw] top-[6cqh]">
				<div className="lpc-fe-kicker lpc-fe-rise" style={at(250)}>
					Sides of you
				</div>
				<div className="lpc-fe-head lpc-fe-rise mt-[0.8cqw]" style={{ ...at(400), fontSize: "max(17px, 4.8cqw)" }}>
					Every side of your taste, <em>its own pick.</em>
				</div>
			</div>
			<div className="absolute bottom-[5cqh] left-[6cqw] right-[6cqw] top-[29cqh] grid gap-[3cqw]" style={{ gridTemplateColumns: `repeat(${sides.length}, 1fr)` }}>
				{sides.map((s, c) => {
					const d = 1100 + c * 450
					return (
						<div key={s.name} className="flex min-w-0 flex-col">
							<div className="lpc-fe-rise flex flex-nowrap gap-[0.6cqw] overflow-hidden" style={at(d)}>
								{s.words.map((w, i) => (
									<span key={w} className={`lpc-fe-chip ${i === 0 ? "lpc-fe-amber" : ""}`} style={{ fontSize: "max(9px,1.45cqw)", padding: "0.5cqw 1.1cqw" }}>
										{word(w)}
									</span>
								))}
							</div>
							<div className="lpc-fe-phone-hide relative mt-[1.6cqh] h-[12cqw]">
								{s.titles.slice(0, 4).map((t, i) => (
									<div key={t.tmdb_id} className="lpc-fe-poster lpc-fe-deal absolute top-0 w-[7.4cqw]" style={at(d + 250 + i * 140, { left: `${i * 5}cqw`, zIndex: i })}>
										<img src={img(t.poster_path, "w185")} alt={t.title} />
									</div>
								))}
							</div>
							<div className="lpc-fe-rise mt-[1.4cqh] flex items-center gap-[0.8cqw] text-[max(9px,1.5cqw)] font-bold text-white/60" style={at(2900 + c * 300)}>
								<span className="text-amber-400">↓</span> Your pick
							</div>
							<div className="lpc-fe-deal relative mt-[1cqh] overflow-hidden rounded-[1cqw]" style={at(3200 + c * 320, { "--dx": "0%", "--dy": "-12%" })}>
								<img src={img(s.pick?.backdrop_path, "w500")} alt="" className="aspect-video w-full object-cover" />
								<div className="lpc-fe-shade-b" />
								<div className="absolute bottom-[0.8cqw] left-[1cqw] right-[1cqw] truncate text-[max(11px,2.2cqw)] font-extrabold">{s.pick?.title}</div>
							</div>
						</div>
					)
				})}
			</div>
		</Root>
	)
}

// (d) One pick for tonight, explained in one line.
export function RecsTonight({ data }: ClipProps) {
	const feel = feelOf(data)
	const pick = feel?.recs[0]
	const [ref, w] = useStageWidth()
	if (!feel || !pick) return <NoData />
	const words = pick.shared.slice(0, 3).map((k) => word(k.adjective).toLowerCase())
	return (
		<Root rootRef={ref}>
			<div className="absolute inset-0 overflow-hidden">
				<img src={img(pick.backdrop_path, "w1280")} alt="" className="lpc-fe-kb h-full w-full object-cover" style={{ "--len": "6500ms" } as CSSProperties} />
			</div>
			<div className="lpc-fe-shade-l" />
			<div className="absolute bottom-[10cqh] left-[6cqw] w-[58cqw]">
				<div className="lpc-fe-kicker lpc-fe-rise" style={at(400)}>
					Picked for you, tonight
				</div>
				<div className="lpc-fe-rise mt-[0.6cqw] font-extrabold leading-[0.95] tracking-tight" style={{ ...at(600), fontSize: "max(26px, 9cqw)" }}>
					{pick.title}
				</div>
				<div className="lpc-fe-rise mt-[2cqh] flex items-center gap-[1.6cqw]" style={at(1200)}>
					<Ring percent={pick.score} size={Math.max(34, w * 0.065)} />
					<span className="lpc-fe-match">{pick.match}% your taste</span>
				</div>
				<div className="lpc-fe-rise mt-[2.4cqh] text-[max(13px,2.8cqw)] font-bold leading-tight" style={at(1900)}>
					{words.length ? `${words[0].charAt(0).toUpperCase()}${words[0].slice(1)}${words.slice(1).map((x) => `, ${x}`).join("")}.` : ""}
				</div>
				<div className="lpc-fe-sub lpc-fe-rise mt-[1cqh]" style={at(2600)}>
					Because you loved {names(feel.loved)}.
				</div>
			</div>
		</Root>
	)
}
