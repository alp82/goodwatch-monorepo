// The start page's scene with the new TV: the room (TvRoom.tsx), the TV's state (use-tv.ts), what is on the TV
// (TvScreen.tsx), the data behind it and the effects the machine names. The route hands it the loader's data.
import { useLocation, useRevalidator } from "@remix-run/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTonightsPick } from "~/ui/navigation/useTonightsPick"
import { useContinueWithGoogle } from "~/ui/taste-quiz/continue-with-google"
import { onFirstInteraction } from "~/utils/first-interaction"
import { useLeaveThroughTv, useReturnIntoTv } from "../tv-transition"
import { TvRoom } from "./TvRoom"
import {
	DiscoverCode,
	DiscoverData,
	EpisodeCode,
	EpisodeData,
	RateCode,
	ShowsCode,
	ShowsData,
	TitleCode,
	TitleData,
	TonightCode,
	type TvDiscoverScreens,
	TvScreen,
	type TvShowsScreens,
	loadFirstScreens,
} from "./TvScreen"
import {
	type TvHomeData,
	homeApps,
	knownShow,
	tonightPicks,
	tvContextOf,
	tvTitleKey,
} from "./tv-home"
import { type TvEffect, readTvState } from "./tv-machine"
import type { TvKnownTitle, TvTitleScreens } from "./tv-title"
import { useTv } from "./use-tv"
import type { TvDiscoverReport } from "./use-tv-discover"
import type { TvEpisodeReport } from "./use-tv-episode"
import { useTvPoolState } from "./use-tv-pool"
import type { TvShowsReport } from "./use-tv-shows"
import type { TvTitleReport } from "./use-tv-title"

/** How long the TV's toast stays. */
const TOAST_MS = 2400

/** The TV's own toast: one line for a moment ("On your Wishlist"). */
function useTvToast() {
	const [text, setText] = useState<string | null>(null)
	const timer = useRef<ReturnType<typeof setTimeout>>()
	useEffect(() => () => clearTimeout(timer.current), [])
	const say = useCallback((next: string) => {
		setText(next)
		clearTimeout(timer.current)
		timer.current = setTimeout(() => setText(null), TOAST_MS)
	}, [])
	return [text, say] as const
}

export function TvLivingRoom({ data }: { data: TvHomeData }) {
	// Back after leaving through the TV shrinks the page into the same TV screen.
	useReturnIntoTv()
	const location = useLocation()
	const here = useRef(location)
	here.current = location
	// The screen as the machine reads it from the address: what is asked for depends on it.
	const screen = useMemo(
		() => readTvState(new URLSearchParams(location.search), data).screen,
		[location.search, data],
	)

	// The first sign that a person uses the page: the screens any key can open are asked for, and a guest's pool.
	const [interacted, setInteracted] = useState(false)
	useEffect(
		() =>
			onFirstInteraction(() => {
				setInteracted(true)
				loadFirstScreens()
			}),
		[],
	)
	// A member's Tonight came with the loader; they need the pool only for the Discover tile's posters, so it waits
	// until that tile first has the focus. A member with nothing to pick from gets the pool's best, as a guest does,
	// and a link straight to Tonight asks for them without waiting for a sign of the person.
	const [discoverSeen, setDiscoverSeen] = useState(false)
	const own = data.member && data.tonight.length > 0
	// Discover's tiles take their pictures from the pool, so a member's link straight to Discover asks for it too.
	const { pool, failed } = useTvPoolState(
		data.member,
		own
			? discoverSeen || screen.name === "discover"
			: interacted || screen.name === "tonight",
	)
	// A guest's own Tonight's pick, the last title on the Wishlist in their browser, leads the pool's best. The
	// site's navigation reads it on every page, so this is the same request.
	const { pick } = useTonightsPick()
	const wished = data.member ? null : (pick?.title ?? null)
	const tonight = useMemo(
		() => tonightPicks(data, pool, wished),
		[data, pool, wished],
	)
	// My shows (slice 9): what is new for a member's shows, for home's tile and the My shows screen. A component of
	// the My shows screen's chunk holds it and reports it here (`ShowsData`, mounted below).
	const [fresh, setFresh] = useState<TvShowsReport | null>(null)
	const freshWords = fresh?.words ?? null
	const apps = useMemo(
		() => homeApps(data, pool, false, wished, freshWords),
		[data, pool, wished, freshWords],
	)
	const shows: TvShowsScreens = useMemo(
		() => ({ list: data.shows, signal: fresh }),
		[data.shows, fresh],
	)

	const [toast, say] = useTvToast()
	// Mini Discover: the titles of the choice on screen are held by a component of Discover's chunk, which reports
	// them here (`DiscoverData`, mounted below).
	const [list, setList] = useState<TvDiscoverReport | null>(null)
	// The titles a list showed stay known after the list has left, so a title's screen names it at once.
	// SEAM (slices 7 to 10): each app's list hands its titles to `setListed` as Discover's does.
	const [listed, setListed] = useState<readonly TvKnownTitle[]>([])
	const onList = useCallback((report: TvDiscoverReport | null) => {
		setList(report)
		if (report?.cards.length) setListed(report.cards)
	}, [])
	const choosing = screen.name === "discover" && Boolean(screen.choice)
	const discover: TvDiscoverScreens = useMemo(
		() => ({ art: pool?.choiceArt ?? {}, list }),
		[pool, list],
	)
	// What the lists on the page know of a title before its card is there.
	const known = useCallback(
		(key: string) =>
			tonight.find((one) => tvTitleKey(one.card) === key)?.card ??
			listed.find((one) => tvTitleKey(one) === key) ??
			// My shows (slice 9): the loader's shows name a show's title screen at once.
			knownShow(data, key),
		[tonight, listed, data],
	)
	// The title on the title screen and the rating: its card, the person's marks and its effects are held by a
	// component of the title screen's chunk, which reports them here (`TitleData`, mounted below). Until it has,
	// the screen shows its bar alone.
	const [one, setOne] = useState<TvTitleReport | null>(null)
	const onTitle = screen.name === "title" || screen.name === "rate"
	const titleName = one?.titleName ?? null
	// My shows (slice 9): on a show the member is midway through, Seen it marks the Next episode. Which one that
	// is, and the mark, are held by a component of a chunk of its own, which reports here (`EpisodeData`, mounted
	// below for a member on a show's title screen).
	const [episode, setEpisode] = useState<TvEpisodeReport | null>(null)
	const onShow =
		data.member && screen.name === "title" && screen.title.startsWith("show-")
	const nextEpisode =
		(onShow && episode?.title === screen.title && episode.next) || null
	// Once an episode is marked, the loader's My shows and Tonight are read again. A step on the TV that falls
	// into that read takes its place, and the router drops the read: it is then asked for again, twice at most,
	// until the loader's data is new.
	const revalidator = useRevalidator()
	const owed = useRef(0)
	const { revalidate } = revalidator
	const refresh = useCallback(() => {
		owed.current = 2
		revalidate()
	}, [revalidate])
	// New data from the loader is the read that was owed.
	useEffect(() => {
		owed.current = 0
	}, [data])
	// Runs when a read ends and when the address changes.
	useEffect(() => {
		if (owed.current < 1 || revalidator.state !== "idle") return
		owed.current -= 1
		revalidate()
	}, [revalidator.state, location.key, revalidate])
	// The titles of the list on screen. SEAM (slices 7 to 10): an island's, a side's and the search's follow.
	const listTitles = choosing ? list?.titles : undefined
	const ctx = useMemo(
		() => ({
			...tvContextOf(data, pool, wished),
			titleName,
			...(listTitles && { titles: listTitles }),
			nextEpisode: Boolean(nextEpisode),
		}),
		[data, pool, wished, titleName, listTitles, nextEpisode],
	)
	// The title screen's Seen it key names the episode it marks.
	const shownTitle = one?.title ?? null
	const title = useMemo(
		() =>
			shownTitle && nextEpisode
				? { ...shownTitle, episode: nextEpisode }
				: shownTitle,
		[shownTitle, nextEpisode],
	)
	const titles: TvTitleScreens = useMemo(
		() => ({ tonight, waiting: !pool && !failed, title }),
		[tonight, pool, failed, title],
	)

	const google = useContinueWithGoogle()
	const leave = useLeaveThroughTv()
	const titleEffect = one?.onEffect
	const episodeEffect = episode?.onEffect
	const onEffect = useCallback(
		(effect: TvEffect) => {
			// The title's own effects: Watch, Want to See, Seen it, the rating.
			if (titleEffect?.(effect)) return
			// My shows (slice 9): Seen it on a show the member is midway through.
			if (episodeEffect?.(effect)) return
			switch (effect.type) {
				// The Expand key: the picture grows into the page.
				case "expand":
					leave(effect.href)
					return
				// Continue with Google, back to the same TV screen.
				case "sign-in":
					google(`${here.current.pathname}${here.current.search}`).catch(() =>
						say("Sign in isn't working right now"),
					)
					return
				// SEAM (slice 8): `quiz-rate` and `quiz-skip` go to `useTasteQuiz`.
				default:
					return
			}
		},
		[google, say, leave, titleEffect, episodeEffect],
	)
	const tv = useTv(ctx, onEffect)
	useEffect(() => {
		if (tv.screen.name === "home" && tv.focused === "app:discover")
			setDiscoverSeen(true)
	}, [tv.screen.name, tv.focused])
	// A screen's code is asked for when the person is about to need it: Tonight's, which brings the title screen's,
	// while its tile has the focus; the rating's on the title screen.
	useEffect(() => {
		if (!interacted) return
		if (tv.screen.name === "home" && tv.focused === "app:tonight")
			TonightCode.load().catch(() => {})
		if (tv.screen.name === "title") RateCode.load().catch(() => {})
		// Discover's while its tile has the focus; on Discover the title screen's, which a title opens.
		if (tv.screen.name === "home" && tv.focused === "app:discover")
			DiscoverCode.load().catch(() => {})
		if (tv.screen.name === "discover") TitleCode.load().catch(() => {})
		// My shows (slice 9): its code while its tile has the focus; on it the title screen's, which a show opens,
		// and the code that marks a show's Next episode.
		if (tv.screen.name === "home" && tv.focused === "app:shows")
			ShowsCode.load().catch(() => {})
		if (tv.screen.name === "shows") {
			TitleCode.load().catch(() => {})
			EpisodeCode.load().catch(() => {})
		}
	}, [interacted, tv.screen.name, tv.focused])

	return (
		<>
			<TvRoom
				tv={tv.room}
				startTitles={data.startTitles}
				renderScreen={(canvas) => (
					<TvScreen
						tv={tv}
						canvas={canvas}
						ctx={ctx}
						apps={apps}
						toast={toast}
						titles={titles}
						discover={discover}
						shows={shows}
					/>
				)}
			/>
			{/* A screen's data, once for both editions. It draws nothing. */}
			{onTitle && (
				<TitleData
					screen={screen}
					member={data.member}
					known={known}
					say={say}
					report={setOne}
				/>
			)}
			{choosing && (
				<DiscoverData screen={screen} member={data.member} report={onList} />
			)}
			{/* My shows (slice 9): what is new for a member's shows, and the Next episode of the show on screen. */}
			{data.member && <ShowsData report={setFresh} />}
			{onShow && (
				<EpisodeData
					title={screen.title}
					say={say}
					refresh={refresh}
					report={setEpisode}
				/>
			)}
		</>
	)
}
