// PROTOTYPE - throwaway (#659). How the groups of titles a member loves (production's Sides of you) appear on Watch
// next, on one member's real list (My movies, or the whole Wishlist), ordered by their personal order. Round 3: the
// member's taste and the moods are one picker, one way of choosing. Words (label.ts): "In your taste", "Close to your
// taste"; a group is shown by its loved posters, and by its trait name only with the names on (words gate, #656).
//
// - today:  production, for reference (personal order, no groups).
// - moods:  round 2, for reference: "Your taste" tiles after the eleven moods, under a heading of their own.
// - beside: each group a tile right after the mood it is mostly made of, in that mood's color.
// - inside: no group tiles: a mood the member's taste is mostly made of carries its loved posters and is picked as
//           that mood in your taste; "In your taste" on the picked tile widens it to the whole mood.
// - first:  the groups' tiles first, then the moods, in one grid with no heading between.
// A picked group is one more choice among the moods (up to three in all; a title fits when it is in any of them).
// With your taste narrowing, titles close to it that fit everything else follow the fits as "Close to your taste".
import { useEffect, useState } from "react"
import {
	MAX_MOODS,
	MOOD_BY_KEY,
	type MoodKey,
	toggleMood,
} from "~/domain/moods"
import type { WatchNextTitle } from "~/server/watch-next.server"
import { MOVIES_PAGE } from "~/ui/my-movies/parts"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { DockedStrip } from "~/ui/watch-next/DockedStrip"
import type { MoodControl } from "~/ui/watch-next/MoodPicker"
import { PhoneControls } from "~/ui/watch-next/PhoneControls"
import {
	HeroLabelContext,
	MoviesPageContext,
	WatchNextHero,
} from "~/ui/watch-next/WatchNextHero"
import { moodWords, timeLabel } from "~/ui/watch-next/labels"
import { WRAP } from "~/ui/watch-next/style"
import { AfterThat, Tiers, useParam } from "./bits"
import {
	GroupChips,
	GroupTiles,
	GroupsAfter,
	GroupsFirst,
	InsideAction,
	InsideFoot,
	groupsShort,
	insideChip,
	tasteOf,
} from "./groups"
import { TASTE } from "./label"
import { type SwnView, VARIANTS } from "./model"

function DataBar({ view }: { view: SwnView }) {
	const set = useParam()
	const pill = (on: boolean) =>
		`cursor-pointer rounded-full border px-2.5 py-0.5 font-semibold ${on ? "border-fuchsia-400 bg-fuchsia-900/60 text-white" : "border-white/15 text-gray-300 hover:border-fuchsia-400/60"}`
	return (
		<div className="border-b border-fuchsia-500/30 bg-fuchsia-950/20">
			<div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2 text-xs md:px-8">
				<span className="font-semibold text-fuchsia-300">Prototype data:</span>
				{view.members.map((m) => (
					<button
						key={m.slot}
						type="button"
						onClick={() => set({ as: m.slot, like: null, nt: null })}
						aria-pressed={m.slot === view.member.slot}
						className={pill(m.slot === view.member.slot)}
					>
						{m.label}
						{m.ratings > 0 && (
							<span className="ml-1 text-gray-400">
								{m.ratings.toLocaleString("en-US")}
							</span>
						)}
					</button>
				))}
				<span className="mx-1 text-gray-500">|</span>
				<button
					type="button"
					onClick={() => set({ list: null, time: null })}
					aria-pressed={view.list === "movies"}
					className={pill(view.list === "movies")}
				>
					My movies
				</button>
				<button
					type="button"
					onClick={() => set({ list: "all", time: null })}
					aria-pressed={view.list === "all"}
					className={pill(view.list === "all")}
				>
					Whole Wishlist
				</button>
				<span className="mx-1 text-gray-500">|</span>
				<button
					type="button"
					onClick={() => set({ names: view.names ? null : "1" })}
					aria-pressed={view.names}
					className={pill(view.names)}
				>
					Trait names {view.names ? "on" : "off"}
				</button>
				<span className="text-gray-400">
					· {view.member.listed} listed, {view.groups.length} groups · personal
					order{" "}
					{view.personalOrder.on
						? "ranks the list"
						: `not loaded (${view.personalOrder.note ?? "none"})`}{" "}
					· {view.computedMs} ms
				</span>
				{view.notes.length > 0 && (
					<details className="w-full text-gray-400">
						<summary className="cursor-pointer">
							How the groups were found
						</summary>
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
	const scope = data.onMyServices
		? "on your services"
		: view.list === "movies"
			? "of your movies"
			: "on your Wishlist"
	const moods: MoodControl = {
		moods: data.moods,
		counts: data.moodCounts,
		pictures: data.moodPictures,
		countScope: scope,
		open,
		setOpen,
		toggle: (mood) => {
			const full =
				among &&
				!data.moods.includes(mood) &&
				data.moods.length + view.picked.length >= MAX_MOODS
			const r = toggleMood(data.moods, mood)
			if (r.refused || full) setRefused({ mood, at: Date.now() })
			else setMoods(r.moods)
		},
		clear: () =>
			set({ moods: null, wide: null, ...(among ? { like: null } : {}) }),
		refused,
	}
	const control = moods
	if (among)
		moods.groups = {
			picked: view.picked.length,
			narrowing: view.picked.length > 0,
			chips: <GroupChips view={view} control={control} />,
			tiles:
				view.variant === "moods"
					? (dense) => (
							<GroupTiles view={view} control={control} dense={dense} />
						)
					: undefined,
			after:
				view.variant === "beside"
					? (mood, dense) => (
							<GroupsAfter
								view={view}
								control={control}
								mood={mood}
								dense={dense}
							/>
						)
					: undefined,
			before:
				view.variant === "first"
					? (dense) => (
							<GroupsFirst view={view} control={control} dense={dense} />
						)
					: undefined,
			short: groupsShort(
				view,
				data.moods.map((m) => MOOD_BY_KEY[m].name),
			),
		}
	if (view.rule === "inside") {
		// Unpicking a mood forgets that it was widened.
		const toggle = moods.toggle
		moods.toggle = (mood) => {
			if (data.moods.includes(mood) && view.wide.includes(mood))
				set({
					moods: data.moods.filter((m) => m !== mood).join(",") || null,
					wide: view.wide.filter((m) => m !== mood).join(",") || null,
				})
			else toggle(mood)
		}
		moods.groups = {
			picked: 0,
			narrowing: false,
			// Only moods that carry your taste: the rest stay production's tiles.
			tileFoot: (mood, dense) =>
				tasteOf(view, mood) ? (
					<InsideFoot view={view} control={control} mood={mood} dense={dense} />
				) : null,
			tileAction: (mood, dense) =>
				tasteOf(view, mood) && data.moods.includes(mood) ? (
					<InsideAction
						view={view}
						control={control}
						mood={mood}
						dense={dense}
					/>
				) : null,
			chipMark: (mood) => insideChip(view, mood),
		}
	}
	const setOnMyServices = (on: boolean) => set({ services: on ? null : "all" })
	const time = data.time ?? null
	const setTime = (t: number | null) => set({ time: t ? String(t) : null })
	const movies = view.list === "movies"
	const strip = !mounted ? (
		<div
			className="h-14 animate-pulse rounded-2xl bg-black/45 ring-1 ring-white/10"
			aria-hidden
		/>
	) : (
		<DockedStrip
			data={data}
			moods={moods}
			setOnMyServices={setOnMyServices}
			setSort={() => {}}
			extra={movies ? MOVIES_PAGE.timeControl(time, setTime) : undefined}
		/>
	)
	const extra = movies && {
		key: "time" as const,
		title: "How long?",
		label: MOVIES_PAGE.phoneTime.label(time),
		icon: MOVIES_PAGE.phoneTime.icon(time),
		on: time !== null,
		body: MOVIES_PAGE.phoneTime.drawer(time, setTime),
	}
	const phone = mounted && (
		<PhoneControls
			data={data}
			moods={moods}
			setOnMyServices={setOnMyServices}
			setSort={() => {}}
			extra={extra}
		/>
	)
	return { strip, phone }
}

export function SidesWatchNextPage({ view }: { view: SwnView | null }) {
	if (!view)
		return (
			<p className="mx-auto max-w-7xl px-4 py-16 text-gray-300 md:px-8">
				The title snapshot is still loading on this dev server. Reload in a
				minute.
			</p>
		)
	return <Page key={`${view.member.slot}:${view.list}`} view={view} />
}

function Page({ view }: { view: SwnView }) {
	const set = useParam()
	const { strip, phone } = useControls(view)
	const movies = view.list === "movies"
	const { data } = view
	const pass = (title: WatchNextTitle) =>
		set({
			nt: [...view.passed.filter((k) => k !== title.key), title.key].join(","),
		})
	const noop = () => {}

	// The line above the hero's title says what your taste narrowed to, as it does for moods.
	const likes = view.picked.flatMap((id) => {
		const g = view.groups.find((x) => x.id === id)
		return g ? [view.names ? `in ${g.name.toLowerCase()}` : TASTE.inline] : []
	})
	// "Inside the moods": each mood in your taste says so ("Crime & mystery in your taste").
	const insideWords = data.moods.map((m) => {
		const t = tasteOf(view, m)
		const { name } = MOOD_BY_KEY[m]
		return t?.narrowed
			? `${name} ${view.names ? `in ${t.words.toLowerCase()}` : TASTE.inline}`
			: name
	})
	const insideNarrows = data.moods.some((m) => tasteOf(view, m)?.narrowed)
	const relabel = (label: string) => {
		if (!likes.length && !insideNarrows) return label
		const prefix = movies ? "Tonight's movie · " : ""
		const limit = data.time ? `, ${timeLabel(data.time).toLowerCase()}` : ""
		const phrase = insideNarrows
			? `for ${insideWords.slice(0, -1).join(", ")}${insideWords.length > 1 ? " or " : ""}${insideWords[insideWords.length - 1]}`
			: [
					data.moods.length ? `for ${moodWords(data.moods)}` : "",
					...new Set(likes),
				]
					.filter(Boolean)
					.join(" or ")
		if (!view.fitting.length)
			return `${prefix}Nothing ${phrase} fits tonight; the closest`
		return `${prefix}Best match ${phrase} tonight${limit}`
	}

	const body = (
		<HeroLabelContext.Provider value={view.rule ? relabel : null}>
			<WatchNextHero
				data={data}
				strip={strip}
				onFinish={noop}
				onPass={pass}
				onWant={noop}
			/>
			<div className={`${WRAP} pt-8`}>
				<AfterThat view={view} />
				<Tiers view={view} />
			</div>
		</HeroLabelContext.Provider>
	)

	const page = (
		<div
			className="overflow-x-clip pb-40 text-white"
			data-watch-next
			data-my-movies={movies ? "" : undefined}
		>
			<DataBar view={view} />
			{movies ? (
				MOVIES_PAGE.head(data)
			) : (
				<h1 className="sr-only">Watch next</h1>
			)}
			{body}
			{phone}
			<PrototypeSwitcher
				position="bottom-28 left-1/2 -translate-x-1/2 lg:bottom-6"
				variants={Object.fromEntries(
					Object.entries(VARIANTS).map(([k, v]) => [
						k,
						`${v.name} (${v.style})`,
					]),
				)}
			/>
		</div>
	)
	return movies ? (
		<MoviesPageContext.Provider value>{page}</MoviesPageContext.Provider>
	) : (
		page
	)
}
