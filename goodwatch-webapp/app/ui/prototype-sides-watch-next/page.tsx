// PROTOTYPE - throwaway (#659). How the groups of titles a member loves (production's Sides of you) appear on Watch
// next, on one member's real list (My movies, or the whole Wishlist), ordered by their personal order. Round 2: the
// groups live inside Watch next's own controls. Words (label.ts): "In your taste", "Close to your taste"; a group is
// shown by its loved posters, and by its trait name only with the names on (words gate, #656).
//
// - today:   production, for reference (personal order, no groups).
// - moods:   "Your taste" tiles after the eleven moods in the mood picker; a picked group is one more choice among the
//            moods (up to three in all; a title fits when it is in any of them).
// - filter:  one more choice next to How long? (a short list on desktop, a fifth button and drawer on phones); a group
//            is its own condition, and what fits everything else follows in its own step.
// - because: no grouping: "In your taste" or "Close to your taste" with the group's posters under the hero and each
//            Then title; tapping it narrows as a picked group does in the mood picker.
// With a group picked, titles close to it that fit everything else follow the fits as "Close to your taste".
import { useEffect, useState } from "react"
import { MAX_MOODS, MOOD_BY_KEY, type MoodKey, toggleMood } from "~/domain/moods"
import type { WatchNextTitle } from "~/server/watch-next.server"
import { MOVIES_PAGE } from "~/ui/my-movies/parts"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { DockedStrip } from "~/ui/watch-next/DockedStrip"
import type { MoodControl } from "~/ui/watch-next/MoodPicker"
import { type ExtraDrawer, PhoneControls } from "~/ui/watch-next/PhoneControls"
import { HeroLabelContext, MoviesPageContext, TitleAsideContext, WatchNextHero } from "~/ui/watch-next/WatchNextHero"
import { moodWords, timeLabel } from "~/ui/watch-next/labels"
import { WRAP } from "~/ui/watch-next/style"
import { AfterThat, Tiers, useParam } from "./bits"
import { GroupChips, GroupDrawer, GroupMenu, GroupTiles, TasteLine, groupButtonIcon, groupsShort } from "./groups"
import { TASTE } from "./label"
import { VARIANTS, type SwnView } from "./model"

function DataBar({ view }: { view: SwnView }) {
	const set = useParam()
	const pill = (on: boolean) =>
		`cursor-pointer rounded-full border px-2.5 py-0.5 font-semibold ${on ? "border-fuchsia-400 bg-fuchsia-900/60 text-white" : "border-white/15 text-gray-300 hover:border-fuchsia-400/60"}`
	return (
		<div className="border-b border-fuchsia-500/30 bg-fuchsia-950/20">
			<div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2 text-xs md:px-8">
				<span className="font-semibold text-fuchsia-300">Prototype data:</span>
				{view.members.map((m) => (
					<button key={m.slot} type="button" onClick={() => set({ as: m.slot, like: null, nt: null })} aria-pressed={m.slot === view.member.slot} className={pill(m.slot === view.member.slot)}>
						{m.label}
						{m.ratings > 0 && <span className="ml-1 text-gray-400">{m.ratings.toLocaleString("en-US")}</span>}
					</button>
				))}
				<span className="mx-1 text-gray-500">|</span>
				<button type="button" onClick={() => set({ list: null, time: null })} aria-pressed={view.list === "movies"} className={pill(view.list === "movies")}>
					My movies
				</button>
				<button type="button" onClick={() => set({ list: "all", time: null })} aria-pressed={view.list === "all"} className={pill(view.list === "all")}>
					Whole Wishlist
				</button>
				<span className="mx-1 text-gray-500">|</span>
				<button type="button" onClick={() => set({ names: view.names ? null : "1" })} aria-pressed={view.names} className={pill(view.names)}>
					Trait names {view.names ? "on" : "off"}
				</button>
				<span className="text-gray-400">
					· {view.member.listed} listed, {view.groups.length} groups · personal order {view.personalOrder.on ? "ranks the list" : `not loaded (${view.personalOrder.note ?? "none"})`} · {view.computedMs} ms
				</span>
				{view.notes.length > 0 && (
					<details className="w-full text-gray-400">
						<summary className="cursor-pointer">How the groups were found</summary>
						<ul className="mt-1 list-disc pl-5">
							{view.notes.map((n) => (
								<li key={n}>{n}</li>
							))}
						</ul>
					</details>
				)}
			</div>
		</div>
	)
}

/** Production's strip (desktop) and slab (phones), with every choice in the URL and the variant's groups inside. */
function useControls(view: SwnView) {
	const set = useParam()
	const [open, setOpen] = useState(false)
	const [refused, setRefused] = useState<MoodControl["refused"]>(null)
	// The strip's sort menu renders differently on the server; production shows a placeholder until its data loads.
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])
	const { data } = view
	const setMoods = (moods: MoodKey[]) => set({ moods: moods.join(",") || null })
	const among = view.rule === "any"
	const scope = data.onMyServices ? "on your services" : view.list === "movies" ? "of your movies" : "on your Wishlist"
	const moods: MoodControl = {
		moods: data.moods,
		counts: data.moodCounts,
		pictures: data.moodPictures,
		countScope: scope,
		open,
		setOpen,
		toggle: (mood) => {
			const full = among && !data.moods.includes(mood) && data.moods.length + view.picked.length >= MAX_MOODS
			const r = toggleMood(data.moods, mood)
			if (r.refused || full) setRefused({ mood, at: Date.now() })
			else setMoods(r.moods)
		},
		clear: () => set({ moods: null, ...(among ? { like: null } : {}) }),
		refused,
	}
	if (view.rule) {
		const control = moods
		moods.groups = {
			picked: among ? view.picked.length : 0,
			narrowing: view.picked.length > 0,
			chips: among ? <GroupChips view={view} control={control} /> : undefined,
			tiles: view.variant === "moods" ? (dense) => <GroupTiles view={view} control={control} dense={dense} /> : undefined,
			short: among ? groupsShort(view, data.moods.map((m) => MOOD_BY_KEY[m].name)) : null,
		}
	}
	const setOnMyServices = (on: boolean) => set({ services: on ? null : "all" })
	const time = data.time ?? null
	const setTime = (t: number | null) => set({ time: t ? String(t) : null })
	const movies = view.list === "movies"
	const filter = view.variant === "filter"
	const strip = !mounted ? (
		<div className="h-14 animate-pulse rounded-2xl bg-black/45 ring-1 ring-white/10" aria-hidden />
	) : (
		<DockedStrip
			data={data}
			moods={moods}
			setOnMyServices={setOnMyServices}
			setSort={() => {}}
			extra={
				movies || filter ? (
					<>
						{movies && MOVIES_PAGE.timeControl(time, setTime)}
						{filter && <GroupMenu view={view} scope={scope} />}
					</>
				) : undefined
			}
		/>
	)
	const extras: ExtraDrawer[] = []
	if (movies)
		extras.push({
			key: "time",
			title: "How long?",
			label: MOVIES_PAGE.phoneTime.label(time),
			icon: MOVIES_PAGE.phoneTime.icon(time),
			on: time !== null,
			body: MOVIES_PAGE.phoneTime.drawer(time, setTime),
		})
	if (filter) {
		const group = view.groups.find((g) => g.id === view.picked[0])
		extras.push({
			key: "groups",
			title: TASTE.heading,
			label: group ? (view.names ? group.name : TASTE.heading) : TASTE.heading,
			icon: groupButtonIcon(view),
			on: Boolean(group),
			body: <GroupDrawer view={view} scope={scope} />,
		})
	}
	const phone = mounted && <PhoneControls data={data} moods={moods} setOnMyServices={setOnMyServices} setSort={() => {}} extra={extras} />
	return { strip, phone }
}

export function SidesWatchNextPage({ view }: { view: SwnView | null }) {
	if (!view) return <p className="mx-auto max-w-7xl px-4 py-16 text-gray-300 md:px-8">The title snapshot is still loading on this dev server. Reload in a minute.</p>
	return <Page key={`${view.member.slot}:${view.list}`} view={view} />
}

function Page({ view }: { view: SwnView }) {
	const set = useParam()
	const { strip, phone } = useControls(view)
	const movies = view.list === "movies"
	const { data } = view
	const pass = (title: WatchNextTitle) => set({ nt: [...view.passed.filter((k) => k !== title.key), title.key].join(",") })
	const noop = () => {}

	// The line above the hero's title says what the picked groups narrowed to, as it does for moods.
	const likes = view.picked.flatMap((id) => {
		const g = view.groups.find((x) => x.id === id)
		return g ? [view.names ? `in ${g.name.toLowerCase()}` : TASTE.inline] : []
	})
	const relabel = (label: string) => {
		if (!likes.length) return label
		const prefix = movies ? "Tonight's movie · " : ""
		const limit = data.time ? `, ${timeLabel(data.time).toLowerCase()}` : ""
		if (!view.fitting.length) return `${prefix}Nothing ${[...new Set(likes)].join(" or ")} fits tonight; the closest`
		const m = moodWords(data.moods)
		const uniq = [...new Set(likes)]
		const phrase = view.rule === "also" ? (m ? `for ${m} ${uniq[0]}` : uniq[0]) : [m && `for ${m}`, ...uniq].filter(Boolean).join(" or ")
		return `${prefix}Best match ${phrase} tonight${limit}`
	}
	const because = view.variant === "because"
	const aside = because ? (title: WatchNextTitle, where: "hero" | "then") => <TasteLine view={view} title={title} where={where} /> : null
	// Under the hero and Then only: under every poster the steps read as grouped again (Fable cross-check).
	const mark = undefined

	const body = (
		<HeroLabelContext.Provider value={view.rule ? relabel : null}>
			<TitleAsideContext.Provider value={aside}>
				<WatchNextHero data={data} strip={strip} onFinish={noop} onPass={pass} onWant={noop} />
				<div className={`${WRAP} pt-8`}>
					<AfterThat view={view} />
					<Tiers view={view} mark={mark} />
				</div>
			</TitleAsideContext.Provider>
		</HeroLabelContext.Provider>
	)

	const page = (
		<div className="overflow-x-clip pb-40 text-white" data-watch-next data-my-movies={movies ? "" : undefined}>
			<DataBar view={view} />
			{movies ? MOVIES_PAGE.head(data) : <h1 className="sr-only">Watch next</h1>}
			{body}
			{phone}
			<PrototypeSwitcher
				position="bottom-28 left-1/2 -translate-x-1/2 lg:bottom-6"
				variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, `${v.name} (${v.style})`]))}
			/>
		</div>
	)
	return movies ? <MoviesPageContext.Provider value>{page}</MoviesPageContext.Provider> : page
}
