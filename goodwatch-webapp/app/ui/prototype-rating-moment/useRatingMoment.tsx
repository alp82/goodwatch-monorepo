// PROTOTYPE - throwaway (#662, map #652). Sides of you at the rating moment, on the real title page.
//
// Four variants, switchable with ?variant= on any /movie/… or /tv/… page in dev:
// toast (one line after rating), sheet (the score sheet answers), hero (sides stay on the title), shape (bolder: only
// when the shape of the sides changes). ?as=owner|m1..m5 picks the member (at runtime by rating count; no member data
// in files); ?names=1 shows side names (they wait on the words gate, #656). Each variant also shows the #526 why row
// after a score of 5 or less, which shares the moment.
//
// Rating here writes nothing: the score lives in this page, and the server replays the member's sides without and
// with it (see server/prototype-rating-moment).
import { useSearchParams } from "@remix-run/react"
import { type ReactNode, useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import type { ScoredMedia } from "~/ui/user/actions/ScoreAction"
import { titleKey } from "~/utils/title-key"
import { DataBar } from "./DataBar"
import { HeroBand } from "./HeroBand"
import { type MomentView, type VariantKey, isVariant } from "./model"
import { ShapeTakeover } from "./ShapeTakeover"
import { SheetResult } from "./SheetResult"
import { MomentToast } from "./MomentToast"

export interface RatingMoment {
	variant: VariantKey
	names: boolean
	score: number | null
	rate: (score: number) => void
	clear: () => void
	/** The sheet variant keeps the score sheet open to answer in it (not after 5 or less: #526 never blocks). */
	keepOpen: (score: number) => boolean
	/** What the sheet shows under the score control (sheet variant). */
	sheet: (close: () => void) => ReactNode
	/** Everything else: data bar, toast, hero band, takeover. */
	node: ReactNode
}

function useSlot(name: string) {
	const [el, setEl] = useState<Element | null>(null)
	useEffect(() => setEl(document.querySelector(`[data-proto-moment="${name}"]`)), [name])
	return el
}

export function useRatingMoment(media: ScoredMedia): RatingMoment | null {
	const [params] = useSearchParams()
	const variant = params.get("variant")
	const active = process.env.NODE_ENV !== "production" && isVariant(variant)
	const slot = params.get("as") ?? "owner"
	const names = params.get("names") === "1"
	const place = params.get("place") === "rebuild" ? "rebuild" : "nearest"
	const key = titleKey(media.mediaType, media.details.tmdb_id)

	const [base, setBase] = useState<MomentView | null>(null)
	const [moment, setMoment] = useState<MomentView | null>(null)
	const [score, setScore] = useState<number | null>(null)
	const [loading, setLoading] = useState(false)
	// Each rating gets a new id, so the reaction to it shows once.
	const [id, setId] = useState(0)
	// #526 asks once per title: the rating that first went to 5 or less.
	const [whyId, setWhyId] = useState<number | null>(null)
	const barSlot = useSlot("bar")
	const heroSlot = useSlot("hero")

	useEffect(() => {
		if (!active) return
		setScore(null)
		setMoment(null)
		setBase(null)
		setWhyId(null)
		const controller = new AbortController()
		fetch(`/prototype/rating-moment/api?as=${slot}&key=${key}`, { signal: controller.signal })
			.then((r) => r.json())
			.then((d) => setBase(d.view))
			.catch(() => {})
		return () => controller.abort()
	}, [active, slot, key, place])

	const rate = useCallback(
		(value: number) => {
			setScore(value)
			setMoment(null)
			setLoading(true)
			setId((i) => {
				if (value <= 5) setWhyId((w) => w ?? i + 1)
				return i + 1
			})
			fetch(`/prototype/rating-moment/api?as=${slot}&key=${key}&score=${value}&place=${place}`)
				.then((r) => r.json())
				.then((d) => setMoment(d.view))
				.catch(() => {})
				.finally(() => setLoading(false))
		},
		[slot, key, place],
	)
	const clear = useCallback(() => {
		setScore(null)
		setMoment(null)
	}, [])

	if (!active || !isVariant(variant)) return null
	const ready = moment && moment.score === score ? moment : null
	// The why row shows for the first low rating of this title only; a later low score is quiet.
	const why = score !== null && score <= 5 && whyId === id
	return {
		variant,
		names,
		score,
		rate,
		clear,
		keepOpen: (value) => variant === "sheet" && value > 5,
		sheet: (close) => <SheetResult view={ready} loading={loading} score={score} names={names} close={close} />,
		node: (
			<>
				{barSlot && createPortal(<DataBar base={base} moment={ready} loading={loading} variant={variant} names={names} />, barSlot)}
				{/* The toast and the takeover go to the body: the overview card is its own stacking context. */}
				{variant === "toast" && createPortal(<MomentToast key={id} view={ready} score={score} names={names} why={why} />, document.body)}
				{variant === "sheet" && why && createPortal(<MomentToast key={id} view={null} score={score} names={names} why />, document.body)}
				{variant === "hero" && heroSlot && createPortal(<HeroBand key={id} view={ready} score={score} names={names} why={why} />, heroSlot)}
				{variant === "shape" && createPortal(<ShapeTakeover key={id} view={ready} score={score} names={names} why={why} />, document.body)}
			</>
		),
	}
}
