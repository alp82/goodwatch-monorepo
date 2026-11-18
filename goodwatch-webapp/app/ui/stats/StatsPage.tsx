// /stats, "GoodWatch in numbers": one long scroll in chapters, after Letterboxd's Year in Review. A giant hero number
// with a roll control, a sticky chapter index lit by scroll, then ten chapters, each with a numbered kicker, a
// sentence heading with its number in amber, and its own layout built from the site's existing parts. The numbers are
// a daily snapshot (app/server/stats/). Pixel effects play on hover and tap, with teasers as spots come into view;
// their code loads at the first interaction, and nothing moves with reduced motion.
import { useRevalidator } from "@remix-run/react"
import { useEffect, useRef } from "react"
import type { StatsSnapshot } from "~/domain/stats/snapshot"
import { Kicker, MoreLink } from "~/ui/info-page"
import { WRAP } from "~/ui/my-pages/style"
import { Awards } from "./chapters/awards"
import { Catalog } from "./chapters/catalog"
import { Crowd } from "./chapters/crowd"
import { Disagreements } from "./chapters/disagreements"
import { Extremes } from "./chapters/extremes"
import { MembersChapter } from "./chapters/members"
import { OutLoud } from "./chapters/out-loud"
import { Streaming } from "./chapters/streaming"
import { TriviaChapter } from "./chapters/trivia"
import { Tropes } from "./chapters/tropes"
import { usePageEffects } from "./effects/load"
import { asOfDate } from "./format"
import { Hero } from "./hero"
import { ChapterNav, StatsStyles, useRise } from "./parts"

const CHAPTERS = [
	{ id: "catalog", label: "Catalog" },
	{ id: "crowd", label: "Crowd" },
	{ id: "out-loud", label: "Out loud" },
	{ id: "extremes", label: "Extremes" },
	{ id: "disagree", label: "Disagreements" },
	{ id: "tropes", label: "Tropes" },
	{ id: "streaming", label: "Streaming" },
	{ id: "awards", label: "Awards" },
	{ id: "trivia", label: "Trivia" },
	{ id: "members", label: "Members" },
]

export function StatsPage({ snapshot }: { snapshot: StatsSnapshot | null }) {
	return snapshot ? <Story s={snapshot} /> : <Counting />
}

function Story({ s }: { s: StatsSnapshot }) {
	useRise()
	usePageEffects()
	const asOf = asOfDate(s.generatedAt)
	return (
		<div className="overflow-x-clip pb-32 text-white [&_.flex>*]:min-w-0 [&_.grid>*]:min-w-0">
			<StatsStyles />
			<Hero s={s} asOf={asOf} />
			<ChapterNav items={CHAPTERS} />
			<div className={`${WRAP} mt-12 flex flex-col gap-24 sm:mt-16 sm:gap-32`}>
				<Catalog s={s} />
				<Crowd s={s} />
				<OutLoud s={s} />
				<Extremes s={s} />
				<Disagreements s={s} />
				<Tropes s={s} />
				<Streaming s={s} />
				<Awards s={s} />
				<TriviaChapter s={s} />
				<MembersChapter s={s} />
				<footer className="stats-rise flex flex-col gap-4 border-t border-white/10 pt-10">
					<p className="text-sm text-gray-400">Numbers as of {asOf}.</p>
					<div className="flex flex-wrap gap-x-6 gap-y-2">
						<MoreLink to="/how-it-works">How GoodWatch works</MoreLink>
						<MoreLink to="/about">About GoodWatch</MoreLink>
					</div>
				</footer>
			</div>
		</div>
	)
}

/** How often the page asks again while the first snapshot is counted (ms). */
const RECHECK_MS = 15_000

/**
 * Before the first snapshot exists (a new deploy with no stored copy): say so, and look again every few seconds, so the
 * page fills in by itself once the numbers are in.
 */
function Counting() {
	const revalidator = useRevalidator()
	const latest = useRef(revalidator)
	latest.current = revalidator
	useEffect(() => {
		const id = window.setInterval(() => {
			if (latest.current.state === "idle") latest.current.revalidate()
		}, RECHECK_MS)
		return () => window.clearInterval(id)
	}, [])
	return (
		<div className={`${WRAP} flex min-h-[60vh] flex-col justify-center gap-6 py-20 text-white`}>
			<Kicker>GoodWatch in numbers</Kicker>
			<h1 className="max-w-3xl font-display font-bold text-4xl sm:text-6xl">
				The numbers are being counted.
			</h1>
			<p className="max-w-2xl text-lg text-gray-300" aria-live="polite">
				Every movie, show, score and streaming offer, added up. This page fills in by itself in a
				minute or so.
			</p>
			<div className="flex flex-wrap gap-x-6 gap-y-2">
				<MoreLink to="/how-it-works">How GoodWatch works</MoreLink>
				<MoreLink to="/about">About GoodWatch</MoreLink>
			</div>
		</div>
	)
}
