// PROTOTYPE - throwaway (#662). Variant "sheet": the score sheet stays open after a score and answers under the
// score strip. A loved title shows the side it joins: the side's posters with this one added, its share before and
// after, the next unseen titles from it in personal order, and Watch next for it. A score of 5 or less shows only the
// #526 why row. Anything that doesn't touch the sides closes the sheet as today.
import { Link } from "@remix-run/react"
import { useEffect } from "react"
import { Poster, SideRef, WatchNextLink, WhyRow, pct, sideById, sideTitles, titlesOf } from "./bits"
import type { MomentView } from "./model"

export function SheetResult({ view, loading, score, names, close }: { view: MomentView | null; loading: boolean; score: number | null; names: boolean; close: () => void }) {
	const o = view?.outcome
	const quiet = o && (o.kind === "middle" || o.kind === "loose")
	useEffect(() => {
		if (!quiet) return
		const timer = setTimeout(close, 500)
		return () => clearTimeout(timer)
	}, [quiet, close])
	if (score === null) return null
	if (score <= 5)
		return (
			<Section>
				<WhyRow score={score} onDone={close} />
			</Section>
		)
	if (loading || !view || !o) return <Section><p className="h-24 animate-pulse text-sm text-gray-500">…</p></Section>
	if (o.kind === "joins" || o.kind === "new") {
		const side = sideById(view.after?.sides, o.side)
		const was = o.kind === "joins" ? sideById(view.before.sides, o.was) : null
		const me = view.titles[view.key]
		if (!side) return null
		return (
			<Section>
				<p className="text-sm font-semibold" style={{ color: side.hue }}>
					{o.kind === "new" ? "A new side" : "Joins a side"}
				</p>
				<h3 className="mt-0.5 text-lg font-bold leading-snug">
					{o.kind === "new" ? "It starts " : "It goes with "}
					<SideRef view={view} side={side} names={names} />
				</h3>
				<div className="mt-3 grid grid-cols-5 gap-1.5">
					{me && <Poster t={me} ring={side.hue} className="animate-[protoIn_.35s_ease-out]" />}
					{sideTitles(view, side, 4).map((t) => (
						<Poster key={t.key} t={t} />
					))}
				</div>
				<style>{"@keyframes protoIn{from{transform:translateY(-10px) scale(1.08);opacity:0}to{transform:none;opacity:1}}"}</style>
				<ShareBar before={was?.share ?? 0} after={side.share} count={side.count} hue={side.hue} />
				{view.more.length > 0 && (
					<>
						<p className="mt-4 text-sm font-semibold text-gray-300">Next from this side</p>
						<div className="mt-2 grid grid-cols-6 gap-1.5">
							{titlesOf(view, view.more).slice(0, 6).map((t) => (
								<Poster key={t.key} t={t} />
							))}
						</div>
					</>
				)}
				<div className="mt-4 flex flex-wrap items-center gap-2">
					<WatchNextLink side={side} names={names} />
					<Link to="/taste" className="rounded-full px-3 py-2 text-sm font-semibold text-gray-300 hover:bg-white/10 hover:text-white">
						All your sides
					</Link>
					<button type="button" onClick={close} className="ml-auto cursor-pointer rounded-full px-3 py-2 text-sm font-semibold text-gray-400 hover:bg-white/10 hover:text-white">
						Done
					</button>
				</div>
			</Section>
		)
	}
	if (o.kind === "forming") {
		const me = view.titles[view.key]
		return (
			<Section>
				<p className="text-sm font-semibold text-gray-300">Fits none of your sides yet</p>
				<h3 className="mt-0.5 text-lg font-bold leading-snug">But it goes with these, which don't either</h3>
				<div className="mt-3 grid grid-cols-5 gap-1.5">
					{me && <Poster t={me} ring="#fff" />}
					{titlesOf(view, o.with).slice(0, 4).map((t) => (
						<Poster key={t.key} t={t} className="opacity-90" />
					))}
				</div>
				<p className="mt-3 text-sm text-gray-400">
					{o.needs > 0 ? `Love ${o.needs} more like them and they become a side of their own.` : "Together they could already be a side; it shows on your Taste page when your sides are next built."}
				</p>
				<div className="mt-3 flex justify-end">
					<button type="button" onClick={close} className="cursor-pointer rounded-full px-3 py-2 text-sm font-semibold text-gray-400 hover:bg-white/10 hover:text-white">
						Done
					</button>
				</div>
			</Section>
		)
	}
	return null
}

function Section({ children }: { children: React.ReactNode }) {
	return <div className="mt-4 border-t border-white/10 pt-4">{children}</div>
}

export function ShareBar({ before, after, count, hue }: { before: number; after: number; count: number; hue: string }) {
	return (
		<div className="mt-3">
			<div className="relative h-2 overflow-hidden rounded-full bg-white/10">
				<div className="absolute inset-y-0 left-0 w-full origin-left rounded-full opacity-40" style={{ background: hue, transform: `scaleX(${before})` }} />
				<div className="absolute inset-y-0 left-0 w-full origin-left animate-[protoGrow_.6s_ease-out_.2s_both] rounded-full" style={{ background: hue, transform: `scaleX(${after})`, ["--from" as never]: before }} />
			</div>
			<style>{"@keyframes protoGrow{from{transform:scaleX(var(--from))}}"}</style>
			<p className="mt-1.5 text-sm text-gray-300">
				{before > 0 && pct(before) !== pct(after) ? (
					<>
						{pct(before)} → <b className="text-white">{pct(after)}</b> of what you love
					</>
				) : (
					<>
						<b className="text-white">{pct(after)}</b> of what you love, <span className="text-gray-400">now {count} titles</span>
					</>
				)}
			</p>
		</div>
	)
}
