// PROTOTYPE - throwaway. Variant C, "Calibrate": a one-line-per-title list you walk through with the keyboard,
// and a panel for the title in focus. The panel shows your titles of the same genre one score above, at the same
// score, and one below, so the question becomes "is this more like my 7s or my 8s?". Keys: up/down or j/k move,
// 1-9 and 0 (= 10) give a score and move on, Enter keeps the score and moves on.
import { Link } from "@remix-run/react"
import { memo, useEffect, useMemo, useRef, useState } from "react"
import type { RatedTitle } from "~/server/prototype-my-library-rescore.server"
import { Poster } from "~/ui/my-pages/bits"
import { ChangeBar, GROUP_LABEL, KindTabs, SORT_LABEL, ScoreKeys, Search, Select, gwOnTen, kindCounts, titleHref, useView } from "../shared"

const Line = memo(function Line({
	t,
	score,
	focused,
	reviewed,
	changed,
	onFocus,
}: {
	t: RatedTitle
	score: number
	focused: boolean
	reviewed: boolean
	changed: boolean
	onFocus: (key: string) => void
}) {
	return (
		<li>
			<button
				type="button"
				data-line={t.key}
				onClick={() => onFocus(t.key)}
				className={`flex h-9 w-full cursor-pointer items-center gap-3 rounded-md px-2 text-left text-sm ${focused ? "bg-amber-400/15 ring-1 ring-amber-400/60" : "hover:bg-white/[0.04]"}`}
			>
				<span
					className={`w-6 shrink-0 text-center font-black tabular-nums ${changed ? "text-amber-300" : reviewed ? "text-gray-200" : "text-gray-500"}`}
				>
					{score}
				</span>
				<span className={`min-w-0 flex-1 truncate ${reviewed ? "text-gray-400" : "text-white"}`}>{t.title}</span>
				<span className="shrink-0 text-xs tabular-nums text-gray-500">{t.release_year}</span>
				<span className="w-4 shrink-0 text-xs text-gray-500">{reviewed ? "✓" : ""}</span>
			</button>
		</li>
	)
})

function Neighbors({ label, list }: { label: string; list: RatedTitle[] }) {
	return (
		<div className="flex flex-col gap-1">
			<span className="text-xs font-semibold text-gray-400">{label}</span>
			{list.length ? (
				<ul className="flex gap-1.5 overflow-hidden">
					{list.map((n) => (
						<li key={n.key} title={`${n.title} (${n.release_year ?? "?"})`} className="w-10 shrink-0">
							<Link to={titleHref(n)}>
								<Poster path={n.poster_path} className="aspect-[2/3] w-full rounded" />
							</Link>
						</li>
					))}
				</ul>
			) : (
				<span className="h-[60px] text-xs leading-[60px] text-gray-600">None</span>
			)}
		</div>
	)
}

export function Calibrate({ titles }: { titles: RatedTitle[] }) {
	const v = useView(titles, "none", "score")
	const flat = useMemo(() => v.groups.flatMap((g) => g.titles), [v.groups])
	const [focus, setFocus] = useState<string | null>(null)
	const [reviewed, setReviewed] = useState<Set<string>>(new Set())
	const current = flat.find((t) => t.key === focus) ?? flat[0]
	const index = current ? flat.indexOf(current) : -1
	const listRef = useRef<HTMLUListElement>(null)

	const move = (step: number) => {
		const next = flat[Math.min(flat.length - 1, Math.max(0, index + step))]
		if (next) setFocus(next.key)
	}
	const done = (t: RatedTitle) => setReviewed((r) => new Set(r).add(t.key))
	// Keys work anywhere outside a field.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return
			if (!current) return
			if (e.key === "ArrowDown" || e.key === "j") {
				e.preventDefault()
				move(1)
			} else if (e.key === "ArrowUp" || e.key === "k") {
				e.preventDefault()
				move(-1)
			} else if (/^[0-9]$/.test(e.key)) {
				v.rescore(current, e.key === "0" ? 10 : Number(e.key))
				done(current)
				move(1)
			} else if (e.key === "Enter") {
				done(current)
				move(1)
			}
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
	useEffect(() => {
		if (current) listRef.current?.querySelector(`[data-line="${current.key}"]`)?.scrollIntoView({ block: "nearest" })
	}, [current])

	const score = current ? v.scoreOf(current) : 0
	const genre = current?.genres[0]
	const near = (n: number) =>
		titles
			.filter((t) => t.key !== current?.key && v.scoreOf(t) === n && (!genre || t.genres.includes(genre)))
			.sort((a, b) => (b.gw ?? 0) - (a.gw ?? 0))
			.slice(0, 8)
	const shown = flat.length
	const doneHere = flat.filter((t) => reviewed.has(t.key)).length

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<KindTabs kind={v.filters.kind} onPick={(kind) => v.set({ kind })} counts={kindCounts(titles)} />
				<Search q={v.filters.q} onChange={(q) => v.set({ q })} className="flex-1 basis-44 sm:max-w-xs" />
				<Select
					label="Genre"
					value={v.filters.genre}
					options={[["", "All"], ...v.genres.map((g) => [g, g] as [string, string])]}
					onPick={(g) => v.set({ genre: g })}
				/>
				<Select
					label="Score"
					value={v.filters.scores.length === 1 ? String(v.filters.scores[0]) : ""}
					options={[["", "All"], ...[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => [String(n), `Only ${n}s`] as [string, string])]}
					onPick={(s) => v.set({ scores: s ? [Number(s)] : [] })}
				/>
				<span className="hidden grow lg:block" />
				<Select label="Order" value={v.sortBy} options={SORT_LABEL} onPick={v.setSortBy} />
			</div>
			<div className="flex items-center gap-3 text-xs text-gray-500">
				<span className="h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
					<span className="block h-full bg-amber-400" style={{ width: `${shown ? (doneHere / shown) * 100 : 0}%` }} />
				</span>
				<span>
					{doneHere} of {shown.toLocaleString("en-US")} looked at
				</span>
				<span className="hidden md:inline">· ↑ ↓ move · 1-9, 0 = 10 score and move on · Enter keeps it</span>
			</div>
			<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
				<ul ref={listRef} className="flex max-h-[70vh] flex-col gap-0.5 overflow-y-auto pb-48 lg:pb-2">
					{flat.map((t) => (
						<Line
							key={t.key}
							t={t}
							score={v.scoreOf(t)}
							focused={t.key === current?.key}
							reviewed={reviewed.has(t.key)}
							changed={v.changed(t)}
							onFocus={setFocus}
						/>
					))}
				</ul>
				{current && (
					<aside className="fixed inset-x-2 bottom-20 z-30 flex flex-col gap-3 rounded-2xl bg-gray-950 p-3 shadow-2xl ring-1 ring-white/15 lg:sticky lg:inset-auto lg:top-[calc(var(--nav-header-height,0px)+1rem)] lg:self-start lg:bg-white/[0.03] lg:p-4 lg:shadow-none">
						<div className="flex gap-3">
							<Poster path={current.poster_path} className="hidden aspect-[2/3] w-24 shrink-0 rounded-lg lg:block" />
							<div className="min-w-0 flex-1">
								<Link to={titleHref(current)} className="block truncate text-base font-black text-white hover:text-amber-200 lg:whitespace-normal lg:text-lg">
									{current.title}
								</Link>
								<p className="text-xs text-gray-400">
									{current.mediaType === "show" ? "Show" : "Movie"} · {current.release_year} · {current.genres.slice(0, 3).join(", ")}
								</p>
								{current.gw != null && <p className="text-xs text-sky-300/80">GoodWatch {current.gw}%</p>}
								<p className="mt-1 text-xs text-gray-500">
									{index + 1} of {shown.toLocaleString("en-US")}
								</p>
							</div>
						</div>
						<ScoreKeys
							score={score}
							gw={gwOnTen(current)}
							label={`Your score for ${current.title}`}
							onPick={(n) => {
								v.rescore(current, n)
								done(current)
								move(1)
							}}
						/>
						<div className="hidden flex-col gap-2 lg:flex">
							<p className="text-xs text-gray-500">Your other {genre ?? ""} titles:</p>
							{score < 10 && <Neighbors label={`Scored ${score + 1}`} list={near(score + 1)} />}
							<Neighbors label={`Scored ${score}, like this one`} list={near(score)} />
							{score > 1 && <Neighbors label={`Scored ${score - 1}`} list={near(score - 1)} />}
						</div>
					</aside>
				)}
			</div>
			<ChangeBar changes={v.changes} onUndo={v.undo} />
		</div>
	)
}
