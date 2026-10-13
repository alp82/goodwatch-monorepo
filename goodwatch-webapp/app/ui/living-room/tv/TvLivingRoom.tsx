// The start page's scene with the new TV: the room (TvRoom.tsx), the TV's state (use-tv.ts), what is on the TV
// (TvScreen.tsx), the data behind it and the effects the machine names. The route hands it the loader's data.
import { useLocation } from "@remix-run/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTonightsPick } from "~/ui/navigation/useTonightsPick"
import { useContinueWithGoogle } from "~/ui/taste-quiz/continue-with-google"
import { onFirstInteraction } from "~/utils/first-interaction"
import { useReturnIntoTv } from "../tv-transition"
import { TvRoom } from "./TvRoom"
import { TvScreen } from "./TvScreen"
import { RateCode, TonightCode, loadFirstScreens } from "./screen-code"
import {
	type TvHomeData,
	homeApps,
	tonightPicks,
	tvContextOf,
	tvTitleKey,
} from "./tv-home"
import { type TvEffect, readTvState } from "./tv-machine"
import type { TvTitleScreens } from "./tv-title"
import { useTv } from "./use-tv"
import { useTvPoolState } from "./use-tv-pool"
import { useTvTitle } from "./use-tv-title"

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
	const { pool, failed } = useTvPoolState(
		data.member,
		own ? discoverSeen : interacted || screen.name === "tonight",
	)
	// A guest's own Tonight's pick, the last title on the Wishlist in their browser, leads the pool's best. The
	// site's navigation reads it on every page, so this is the same request.
	const { pick } = useTonightsPick()
	const wished = data.member ? null : (pick?.title ?? null)
	const tonight = useMemo(
		() => tonightPicks(data, pool, wished),
		[data, pool, wished],
	)
	const apps = useMemo(
		() => homeApps(data, pool, false, wished),
		[data, pool, wished],
	)

	const [toast, say] = useTvToast()
	// What the lists on the page know of a title before its card is there. SEAM (slices 6 to 10): each app's list
	// adds its titles here.
	const known = useCallback(
		(key: string) =>
			tonight.find((one) => tvTitleKey(one.card) === key)?.card ?? null,
		[tonight],
	)
	const one = useTvTitle({ screen, member: data.member, known, say })
	const ctx = useMemo(
		() => ({ ...tvContextOf(data, pool, wished), titleName: one.titleName }),
		[data, pool, wished, one.titleName],
	)
	const titles: TvTitleScreens = useMemo(
		() => ({ tonight, waiting: !pool && !failed, title: one.title }),
		[tonight, pool, failed, one.title],
	)

	const google = useContinueWithGoogle()
	const titleEffect = one.onEffect
	const onEffect = useCallback(
		(effect: TvEffect) => {
			// The title's own effects, and leaving through the TV.
			if (titleEffect(effect)) return
			switch (effect.type) {
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
		[google, say, titleEffect],
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
	}, [interacted, tv.screen.name, tv.focused])

	return (
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
				/>
			)}
		/>
	)
}
