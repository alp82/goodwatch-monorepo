// The start page's scene with the new TV: the room (TvRoom.tsx), the TV's state (use-tv.ts), what is on the TV
// (TvScreen.tsx), the data behind it and the effects the machine names. The route hands it the loader's data.
import { useLocation } from "@remix-run/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTonightsPick } from "~/ui/navigation/useTonightsPick"
import { useContinueWithGoogle } from "~/ui/taste-quiz/continue-with-google"
import { onFirstInteraction } from "~/utils/first-interaction"
import { useLeaveThroughTv, useReturnIntoTv } from "../tv-transition"
import { TvRoom } from "./TvRoom"
import {
	DiscoverCode,
	DiscoverData,
	ExplorerData,
	QuizCode,
	RateCode,
	SearchData,
	TasteCode,
	TasteData,
	TitleCode,
	TitleData,
	TonightCode,
	type TvDiscoverScreens,
	TvScreen,
	type TvSearchScreens,
	loadFirstScreens,
} from "./TvScreen"
import { useReport } from "./kit"
import type { TvCanvas } from "./room-tv"
import {
	type TvHomeData,
	homeApps,
	tonightPicks,
	tvContextOf,
	tvTitleKey,
} from "./tv-home"
import { type TvEffect, readTvState } from "./tv-machine"
import type { TvKnownTitle, TvTitleScreens } from "./tv-title"
import { useTv } from "./use-tv"
import type { TvDiscoverReport } from "./use-tv-discover"
import type { TvExplorerReport } from "./use-tv-explorer"
import { useTvPoolState } from "./use-tv-pool"
import type { TvSearchReport } from "./use-tv-search"
import type { TvTasteReport } from "./use-tv-taste"
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

/**
 * Slice 8. Tells the scene which edition the measured room draws its TV in: the rating strip has its exact scores
 * on the desktop only, and the machine's context says so. Draws nothing; before the window is measured, when both
 * editions are in the HTML, it says nothing.
 */
function Edition({
	canvas,
	report,
}: {
	canvas: TvCanvas
	report: (edition: TvCanvas["edition"] | null) => void
}) {
	useReport<TvCanvas["edition"] | null>(
		report,
		canvas.first ? null : canvas.edition,
	)
	return null
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
	// Slice 8. The person's taste and the quiz are held by a component of Taste's chunk, which reports them here
	// (`TasteData`, mounted below) while the address names Taste, a side or the quiz.
	const [mine, setMine] = useState<TvTasteReport | null>(null)
	const onTaste = screen.name === "taste" || screen.name === "quiz"
	// Once Taste has shown sides, home's tile says so for the rest of the visit.
	const [tasted, setTasted] = useState(false)
	const hasSides = mine?.ctx.taste ?? false
	useEffect(() => {
		if (hasSides) setTasted(true)
	}, [hasSides])
	// What Taste's lists knew of a title is still wanted on the title's own screen, where Taste's data is gone.
	const tasteKnown = useRef<TvTasteReport["known"] | null>(null)
	if (mine) tasteKnown.current = mine.known
	// The edition the room draws the TV in (`Edition`, drawn with the screen).
	const [edition, setEdition] = useState<TvCanvas["edition"] | null>(null)

	const apps = useMemo(
		() => homeApps(data, pool, tasted, wished),
		[data, pool, tasted, wished],
	)

	// ---- The mini Explorer (slice 7). Its map is held by a component of the Explorer's chunk, which reports it
	// here (`ExplorerData`, mounted below): from the moment its tile first has the focus, so the map is there by
	// the time it opens, and for the rest of the visit, so a title opened from an island is named at once.
	const [explorer, setExplorer] = useState<TvExplorerReport | null>(null)
	const [mapWanted, setMapWanted] = useState(false)
	const onExplorer = screen.name === "explorer"
	const explorerContext = explorer?.context
	const onMap = explorer?.known

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
	// Search (slice 10). What is typed on its line is the scene's: the machine's context needs it for the key that
	// searches for it. It starts empty every time the line is shown. The titles a search found are held by a
	// component of the search screen's chunk, which reports them here (`SearchData`, mounted below) while the
	// address names a query.
	const [draft, setDraft] = useState("")
	const asking = screen.name === "search" && !screen.query
	useEffect(() => {
		if (!asking) setDraft("")
	}, [asking])
	const [found, setFound] = useState<TvSearchReport | null>(null)
	const onFound = useCallback((report: TvSearchReport | null) => {
		setFound(report)
		if (report?.cards.length) setListed(report.cards)
	}, [])
	const searched = screen.name === "search" && Boolean(screen.query)
	const discover: TvDiscoverScreens = useMemo(
		() => ({ art: pool?.choiceArt ?? {}, list }),
		[pool, list],
	)
	// What the lists on the page know of a title before its card is there.
	const known = useCallback(
		(key: string) =>
			tonight.find((one) => tvTitleKey(one.card) === key)?.card ??
			listed.find((one) => tvTitleKey(one) === key) ??
			// The mini Explorer (slice 7): an island's titles.
			onMap?.(key) ??
			// Slice 8: a side's titles and the quiz's picks.
			tasteKnown.current?.(key) ??
			null,
		[tonight, listed, onMap],
	)
	// The title on the title screen and the rating: its card, the person's marks and its effects are held by a
	// component of the title screen's chunk, which reports them here (`TitleData`, mounted below). Until it has,
	// the screen shows its bar alone.
	const [one, setOne] = useState<TvTitleReport | null>(null)
	const onTitle = screen.name === "title" || screen.name === "rate"
	const titleName = one?.titleName ?? null
	// The titles of the list on screen. SEAM (slice 9): My shows' follow.
	const listTitles = choosing
		? list?.titles
		: searched
			? found?.titles
			: undefined
	const tasteCtx = onTaste ? mine?.ctx : undefined
	const ctx = useMemo(
		() => ({
			...tvContextOf(data, pool, wished),
			titleName,
			draft,
			...(listTitles && { titles: listTitles }),
			// The mini Explorer (slice 7): its islands, and an island's titles and hops, while it is on screen.
			...explorerContext,
			// Slice 8: Taste's sides and lists, the quiz's title and progress, and where the strip has exact scores.
			...tasteCtx,
			exactScores: edition === "desktop",
		}),
		[
			data,
			pool,
			wished,
			titleName,
			draft,
			listTitles,
			explorerContext,
			tasteCtx,
			edition,
		],
	)
	const title = one?.title ?? null
	const titles: TvTitleScreens = useMemo(
		() => ({ tonight, waiting: !pool && !failed, title }),
		[tonight, pool, failed, title],
	)

	const google = useContinueWithGoogle()
	const leave = useLeaveThroughTv()
	const titleEffect = one?.onEffect
	const tasteEffect = mine?.onEffect
	const onEffect = useCallback(
		(effect: TvEffect) => {
			// The title's own effects: Watch, Want to See, Seen it, the rating.
			if (titleEffect?.(effect)) return
			// Slice 8. The quiz's: a score and "Haven't seen it" go to `useTasteQuiz`.
			if (tasteEffect?.(effect)) return
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
				default:
					return
			}
		},
		[google, say, leave, titleEffect, tasteEffect],
	)
	const tv = useTv(ctx, onEffect)
	// Typing puts the TV's focus on the key that searches for what is typed (the machine's `typed`).
	const { dispatch } = tv
	const onDraft = useCallback(
		(text: string) => {
			setDraft(text)
			dispatch({ type: "typed" })
		},
		[dispatch],
	)
	const search: TvSearchScreens = useMemo(
		() => ({ draft, onDraft, list: searched ? found : null }),
		[draft, onDraft, searched, found],
	)
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
		// Slice 10: on search the title screen's too, which a found title opens.
		if (tv.screen.name === "search") TitleCode.load().catch(() => {})
		// Slice 8: Taste's while its tile has the focus, the quiz's on Taste.
		if (tv.screen.name === "home" && tv.focused === "app:taste")
			TasteCode.load().catch(() => {})
		if (tv.screen.name === "taste") QuizCode.load().catch(() => {})
	}, [interacted, tv.screen.name, tv.focused])

	// The mini Explorer (slice 7): its code and its map are asked for while its tile has the focus, or by a link
	// straight to it.
	useEffect(() => {
		if (
			onExplorer ||
			(interacted && tv.screen.name === "home" && tv.focused === "app:explorer")
		)
			setMapWanted(true)
	}, [onExplorer, interacted, tv.screen.name, tv.focused])

	return (
		<>
			<TvRoom
				tv={tv.room}
				startTitles={data.startTitles}
				renderScreen={(canvas) => (
					<>
						<Edition canvas={canvas} report={setEdition} />
						<TvScreen
							tv={tv}
							canvas={canvas}
							ctx={ctx}
							apps={apps}
							toast={toast}
							titles={titles}
							discover={discover}
							explorer={explorer?.view}
							taste={onTaste ? mine?.screens : undefined}
							search={search}
						/>
					</>
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
			{/* The mini Explorer (slice 7): its map, from its tile's first focus on. */}
			{(mapWanted || onExplorer) && (
				<ExplorerData
					screen={screen}
					member={data.member}
					report={setExplorer}
				/>
			)}
			{onTaste && (
				<TasteData screen={screen} member={data.member} report={setMine} />
			)}
			{/* Search (slice 10): the search for the query in the address, asked for with OK. */}
			{searched && (
				<SearchData
					screen={screen}
					member={data.member}
					scope={data.scope ?? null}
					report={onFound}
				/>
			)}
		</>
	)
}
