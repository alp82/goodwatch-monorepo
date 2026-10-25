// A pick's detail, one component for the phone title drawer (TitleDrawer.tsx) and the desktop pop-out card
// (PopOutCard.tsx). It has a fixed size: every section reserves its height, so next / previous never makes it jump.
// - head: backdrop; poster (inline, an empty slot, or none when the poster sits beside the card); "#3 for you", title,
//   year · kind · runtime, the GoodWatch score.
// - why: "Because you loved X" with its tiny poster (or the steer it answers), then one row of reason chips.
// - what it's like: the title's three most distinctive traits, never repeating a reason chip.
// - where to watch: service logos with short names, "+2" when there are more.
// - footer: Want to See, Seen and the score as one split button, Not interested as its icon, and "Details" (the
//   title page). Marking it Seen asks for the score, as everywhere. The previous / next arrows sit under
//   the poster: under the small one here on phones (DetailHead), under the big one beside the card on desktop.
// Runtime, backdrop, services and overview load on demand (the details query); until then their room stays reserved.
import { Link } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import { Suspense, forwardRef, lazy, useMemo, useRef, useState } from "react"
import {
	type CardService,
	FP_KEYS,
	type ForYouDetail,
} from "~/domain/for-you-page/contract"
import type { Ranked } from "~/domain/for-you-page/rank"
import gwLogo from "~/img/goodwatch-logo.webp?no-inline"
import UserAction from "~/ui/auth/UserAction"
import { EyeIcon } from "~/ui/details/hero/seen-score-faces"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { DISPLAY } from "~/ui/my-pages/bits"
import { ActionButton } from "~/ui/title-actions/ActionButton"
import {
	SEEN_INSTRUCTIONS,
	SEEN_SO_NOT_HIDEABLE,
	useTitleActions,
} from "~/ui/title-actions/useTitleActions"
import { useUndoToast, warmUndoToast } from "~/ui/title-actions/useUndoToast"
import { ReasonChips } from "~/ui/title-card/ReasonChips"
import { warmWatchLog } from "~/ui/watch-log/WatchLogHost"
import { assetUrl } from "~/utils/asset-url"
import { useAuthHref } from "~/utils/auth-href"
import {
	goodwatchScoreDisplay,
	goodwatchVibeIndex,
	scoreLabels,
	selectedScoreStyle,
} from "~/utils/ratings"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import {
	type PoolTitle,
	backdropSrc,
	detailQuery,
	isSignedOut,
	posterSrc,
	titleAt,
	useForYou,
} from "./context"

const N = FP_KEYS.length

const loadScoreDialog = reloadOnStaleChunk(
	() => import("~/ui/scoring/TitleScoreDialog"),
)
const TitleScoreDialog = lazy(loadScoreDialog)
const warmScoreDialog = () => {
	void loadScoreDialog().catch(() => {})
}

/** One title's detail from the details query; `detail` is undefined while it loads or after it failed. */
export function useDetail(key: string): {
	detail: ForYouDetail | null | undefined
	status: "pending" | "error" | "success"
	signedOut: boolean
	retry: () => void
} {
	const { loadDetail } = useForYou()
	const query = useQuery(detailQuery(key, loadDetail))
	return {
		detail: query.data,
		// Asking again after a failure shows the loading state again.
		status:
			query.status === "error" && query.isFetching ? "pending" : query.status,
		signedOut: isSignedOut(query.error),
		retry: () => void query.refetch(),
	}
}

export const metaOf = (t: PoolTitle, runtime: number | null | undefined) =>
	[
		t.year,
		t.kind === "show" ? "Show" : "Movie",
		t.kind === "movie" && runtime ? `${runtime} min` : null,
	]
		.filter(Boolean)
		.join(" · ")

/** The GoodWatch score as the poster card shows it: the logo over the number, on its vibe color. */
export function GwBadge({ gw }: { gw: number | null }) {
	if (gw == null) return <span className="block w-12" aria-hidden />
	return (
		<span
			className={`flex shrink-0 flex-col items-center rounded-t-full rounded-b-lg px-2.5 pt-1.5 pb-1 text-white bg-vibe-${goodwatchVibeIndex(gw)}`}
			title="GoodWatch score"
		>
			<img src={assetUrl(gwLogo)} alt="GoodWatch" className="h-4 w-auto" />
			<span className="text-base leading-5 font-bold tabular-nums">
				{goodwatchScoreDisplay(gw)}
			</span>
		</span>
	)
}

/** A loved title that carries one of the pick's reasons ("Because you loved X"). */
function useLoved(r: Ranked) {
	const { taste, attr } = useForYou()
	return useMemo(() => {
		for (const reason of r.reasons) {
			const best = (attr(reason.key)?.carriers ?? [])
				.map((k) => taste.loved[k])
				.filter((s) => s && s.score >= 8)
				.sort((a, b) => b.score - a.score)[0]
			if (best) return best
		}
		return undefined
	}, [r, taste.loved, attr])
}

/** The title's three most distinctive traits: scored 6+ of 10 and furthest above the pool's average. */
function useTraits(r: Ranked, skip: string[]) {
	const { pool, stats } = useForYou()
	return useMemo(() => {
		const i = r.index
		const order = FP_KEYS.map((k, j) => ({
			k,
			v: pool.fingerprints[i * N + j],
			z: stats.z[i * N + j],
		}))
			.filter((x) => x.v !== 255 && x.v >= 6 && !skip.includes(x.k))
			.sort((a, b) => b.z - a.z)
			.slice(0, 3)
		return order.map((x) => {
			const meta = getFingerprintMeta(x.k)
			return { key: x.k, label: meta.label, emoji: meta.emoji }
		})
	}, [r, pool, stats, skip])
}

const CHANNEL =
	/\s+(Amazon Channel|Apple TV Channel|Roku Premium Channel|Standard with Ads|Basic with Ads|with Ads)$/i

function servicesOf(list: CardService[] | null | undefined) {
	const seen = new Map<string, CardService>()
	for (const p of list ?? []) {
		const name = p.name.replace(CHANNEL, "")
		if (!seen.has(name)) seen.set(name, { ...p, name })
	}
	return [...seen.values()]
}

/** The image URLs a detail shows, for decoding the neighbours ahead. */
export function detailImages(
	t: PoolTitle,
	detail: ForYouDetail | null | undefined,
	big: "w342" | "w500",
): string[] {
	return [
		posterSrc(t.poster, "w185"),
		posterSrc(t.poster, big),
		detail?.backdrop ? backdropSrc(detail.backdrop, "w780") : undefined,
	].filter((x): x is string => !!x)
}

export type PosterMode = "inline" | "slot" | "none"

/** Backdrop, poster (or its slot), rank, title, meta, score. Always the same height for a given mode. */
export const DetailHead = forwardRef<
	HTMLDivElement,
	{
		r: Ranked
		rank: number
		poster: PosterMode
		headProps?: React.HTMLAttributes<HTMLDivElement>
		/** Previous / next under the inline poster (phones). */
		steps?: Steps
	}
>(function DetailHead({ r, rank, poster, headProps, steps }, slotRef) {
	const { pool } = useForYou()
	const t = titleAt(pool, r.index)
	const { detail } = useDetail(t.key)
	const side = poster === "none"
	const inlineSteps = poster === "inline" && !!steps
	return (
		<div {...headProps} className="relative shrink-0 select-none">
			<div
				className={`relative overflow-hidden ${side ? "h-32" : "h-[4.5rem]"}`}
			>
				{detail?.backdrop && (
					<img
						src={backdropSrc(detail.backdrop, "w780")}
						alt=""
						draggable={false}
						className="size-full object-cover opacity-50"
					/>
				)}
				<span className="absolute inset-0 bg-linear-to-b from-gray-900/0 via-gray-900/55 to-gray-900" />
			</div>
			<div
				className={`relative flex items-end gap-3.5 ${side ? "-mt-16 px-6" : "-mt-12 px-4"}`}
			>
				{poster === "inline" && (
					<div className="flex w-[5.25rem] shrink-0 flex-col gap-2">
						<div className="overflow-hidden rounded-lg bg-gray-800 shadow-xl ring-1 ring-white/15">
							{t.poster ? (
								<img
									src={posterSrc(t.poster, "w185")}
									alt={t.name}
									draggable={false}
									className="aspect-[2/3] w-full object-cover"
								/>
							) : (
								<div className="aspect-[2/3] w-full" />
							)}
						</div>
						{steps && <StepButtons {...steps} small />}
					</div>
				)}
				{poster === "slot" && (
					<div
						ref={slotRef}
						className="aspect-[2/3] w-[5.25rem] shrink-0 rounded-lg"
					/>
				)}
				{/* Room for a two-line title whatever the title is. */}
				<div
					className={`flex min-w-0 flex-1 flex-col justify-end ${side ? "h-[6rem]" : "h-[5.5rem]"} ${inlineSteps ? "mb-11" : ""}`}
				>
					<p className="text-[11px] font-bold tracking-[0.14em] text-amber-400/85 uppercase">
						#{rank} for you
					</p>
					<h2
						className={`${DISPLAY} mt-0.5 line-clamp-2 leading-tight text-white ${side ? "text-[1.45rem]" : "text-[1.25rem]"}`}
					>
						{detail?.title || t.name}
					</h2>
					<p className="mt-1 truncate text-xs text-gray-400">
						{metaOf(t, detail?.runtime)}
					</p>
				</div>
				<div className={`shrink-0 pb-1 ${inlineSteps ? "mb-11" : ""}`}>
					<GwBadge gw={t.score} />
				</div>
			</div>
		</div>
	)
})

function Label({ children }: { children: React.ReactNode }) {
	return (
		<p className="mb-2.5 hidden text-[10px] font-bold tracking-[0.16em] text-gray-500 uppercase md:block">
			{children}
		</p>
	)
}

const SECTION = "py-3 md:py-4"

/** The why line and chips, the traits, where to watch, the story. Every section has a fixed height. */
export function DetailBody({
	r,
	answer,
}: { r: Ranked; answer: string | null }) {
	const { pool } = useForYou()
	const t = titleAt(pool, r.index)
	const { detail, status, signedOut, retry } = useDetail(t.key)
	const loading = status === "pending"
	const failed = status === "error"
	const signIn = useAuthHref()("sign-in")
	const loved = useLoved(r)
	const reasonKeys = useMemo(
		() => r.reasons.slice(0, 3).map((x) => x.key),
		[r.reasons],
	)
	const traits = useTraits(r, reasonKeys)
	const services = servicesOf(detail?.services)
	const room = 5
	const shown = services.slice(0, services.length > room ? room - 1 : room)
	const extra = services.length - shown.length
	return (
		<div className="divide-y divide-white/[0.07] px-4 md:px-6">
			<section className={`${SECTION} pt-3.5 md:pt-5`}>
				<div className="flex h-9 items-center">
					{loved ? (
						<p className="flex min-w-0 items-center gap-2.5 text-[15px] leading-snug text-gray-300">
							{loved.poster && (
								<img
									src={posterSrc(loved.poster, "w92")}
									alt=""
									className="h-9 w-6 shrink-0 rounded-[3px] object-cover ring-1 ring-white/15"
								/>
							)}
							<span className="min-w-0 truncate">
								Because you loved{" "}
								<span className="font-bold text-white">{loved.title}</span>
							</span>
						</p>
					) : answer ? (
						<p className="truncate text-[15px] leading-snug font-semibold text-amber-300">
							{answer}
						</p>
					) : null}
				</div>
				<div className="mt-2.5 h-5 overflow-hidden">
					<ReasonChips reasons={reasonKeys} />
				</div>
			</section>

			<section className={SECTION}>
				<Label>What it's like</Label>
				<ul className="flex h-[3.25rem] flex-wrap content-start items-center gap-x-4 gap-y-1.5 overflow-hidden">
					{traits.map((x) => (
						<li
							key={x.key}
							className="flex h-6 min-w-0 items-center gap-1.5 text-[13.5px] leading-none text-gray-200"
						>
							<span className="text-[15px] leading-none" aria-hidden="true">
								{x.emoji}
							</span>
							<span className="truncate">{x.label}</span>
						</li>
					))}
				</ul>
			</section>

			<section className={SECTION} aria-label="Where to watch">
				<Label>Where to watch</Label>
				<div className="flex h-14 items-start gap-2.5">
					{loading &&
						[0, 1, 2].map((k) => (
							<span
								key={k}
								className="flex w-[3.4rem] flex-col items-center gap-1"
								aria-hidden="true"
							>
								<span className="size-10 animate-pulse rounded-xl bg-white/[0.06]" />
								<span className="h-2.5 w-8 animate-pulse rounded bg-white/[0.05]" />
							</span>
						))}
					{failed && (
						<p
							className="flex min-w-0 items-center gap-1 self-center text-[13px] text-gray-500"
							data-detail-error={signedOut ? "signed-out" : "failed"}
						>
							{signedOut ? (
								<>
									<span className="truncate">You're signed out.</span>
									<Link
										to={signIn}
										className="flex min-h-11 shrink-0 items-center px-1.5 font-semibold text-gray-300 underline-offset-2 hover:text-white hover:underline"
									>
										Sign in
									</Link>
								</>
							) : (
								<>
									<span className="truncate">Couldn't load the details.</span>
									<button
										type="button"
										onClick={retry}
										className="min-h-11 shrink-0 px-1.5 font-semibold text-gray-300 underline-offset-2 hover:text-white hover:underline"
										data-detail-retry=""
									>
										Try again
									</button>
								</>
							)}
						</p>
					)}
					{status === "success" && shown.length === 0 && (
						<p className="self-center text-[13px] text-gray-500">
							Not streaming right now
						</p>
					)}
					{shown.map((p) => (
						<span
							key={p.id}
							className="flex w-[3.4rem] min-w-0 flex-col items-center gap-1"
							title={p.name}
						>
							{p.logo_path ? (
								<img
									src={posterSrc(p.logo_path, "w92")}
									alt=""
									className="size-10 rounded-xl object-cover ring-1 ring-white/10"
								/>
							) : (
								<span className="grid size-10 place-items-center rounded-xl bg-white/[0.06] text-sm font-bold text-gray-300 ring-1 ring-white/10">
									{p.name.charAt(0)}
								</span>
							)}
							<span className="w-full truncate text-center text-[10.5px] leading-tight text-gray-400">
								{p.name}
							</span>
						</span>
					))}
					{extra > 0 && (
						<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-[12px] font-bold text-gray-300 ring-1 ring-white/10">
							+{extra}
						</span>
					)}
				</div>
			</section>

			<section className={`${SECTION} pb-4 md:pb-5`}>
				<Label>Story</Label>
				{loading ? (
					<div
						className="h-[3.75rem] space-y-2 pt-1 md:h-20"
						aria-hidden="true"
					>
						<span className="block h-3 w-full animate-pulse rounded bg-white/[0.05]" />
						<span className="block h-3 w-11/12 animate-pulse rounded bg-white/[0.05]" />
						<span className="block h-3 w-2/3 animate-pulse rounded bg-white/[0.05]" />
					</div>
				) : failed ? (
					<div className="h-[3.75rem] md:h-20" aria-hidden="true" />
				) : detail?.overview ? (
					<p className="line-clamp-3 h-[3.75rem] text-[13px] leading-5 text-gray-400 md:line-clamp-4 md:h-20">
						{detail.overview}
					</p>
				) : (
					<p className="h-[3.75rem] text-[13px] leading-5 text-gray-600 md:h-20">
						No overview yet.
					</p>
				)}
			</section>
		</div>
	)
}

/** Previous / next: what the arrows need. */
export type Steps = {
	onStep: (d: -1 | 1) => void
	canPrev: boolean
	canNext: boolean
}

/**
 * Want to See, then Seen and the score as one split button, then Not interested (its icon) and the title page link.
 * Marking it Seen asks for the score; the score picker opens above the For you overlay. Not interested answers with
 * a toast that can undo it. Labels stay whole down to a 360px phone: short words, and no arrow on Details there.
 */
export function DetailFooter({ r }: { r: Ranked }) {
	const { pool } = useForYou()
	const t = titleAt(pool, r.index)
	const media = {
		mediaType: t.kind,
		details: { tmdb_id: t.tmdbId, title: t.name },
	}
	const a = useTitleActions(media)
	const toast = useUndoToast()
	// The button that opened the score picker: it opens beside it, and focus returns there.
	const opener = useRef<HTMLButtonElement | null>(null)
	const [scoring, setScoring] = useState(false)
	const scoreButton = useRef<HTMLButtonElement>(null)
	const askScore = (from: HTMLButtonElement | null) => {
		opener.current = from
		warmScoreDialog()
		setScoring(true)
	}
	const hideTitle = a.hidden
		? "Hidden from your recommendations. Press to bring it back."
		: a.canHide
			? "Hide it from your recommendations"
			: SEEN_SO_NOT_HIDEABLE
	const pressHide = () => {
		if (a.hidden) return a.unhide()
		toast.say(`${t.name} is hidden from your recommendations`, a.hide())
	}
	const warm = () => {
		warmUndoToast()
		warmScoreDialog()
		if (t.kind === "movie") warmWatchLog()
	}
	return (
		<div
			className="flex shrink-0 items-center gap-1.5 border-t border-white/10 px-4 pt-2.5 pb-3 sm:gap-2 md:px-6 md:pt-3 md:pb-4"
			onPointerEnter={warm}
			onPointerDown={warm}
			onFocus={warm}
			data-title-actions=""
		>
			<ActionButton
				kind="want"
				label="short"
				size="sm"
				className="flex-1 max-sm:!gap-1.5 max-sm:!px-1.5"
				rewatch={a.seen}
				active={a.want}
				disabled={a.wantPending}
				onClick={a.toggleWant}
			/>
			<div
				className={`flex h-9 shrink-0 items-stretch overflow-hidden rounded-lg ${a.score ? "" : "ring-1 ring-white/15"}`}
			>
				<UserAction instructions={SEEN_INSTRUCTIONS}>
					<button
						type="button"
						aria-pressed={a.seen}
						aria-haspopup={a.seenLog?.opensLog ? "dialog" : undefined}
						aria-label={`Seen${a.seenLog?.count ? `, watched ${a.seenLog.count}` : ""}${a.seenLog?.opensLog ? ". Open your watches" : ""}`}
						disabled={a.seenPending}
						onPointerEnter={a.seenLog?.onPointerEnter}
						onFocus={a.seenLog?.onFocus}
						// The picker opens from the score half: Seen is disabled while its request runs, so focus couldn't
						// return to it.
						onClick={(event) =>
							a.toggleSeen(event, () => askScore(scoreButton.current))
						}
						className={`flex shrink-0 cursor-pointer items-center gap-1 px-2 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80 disabled:cursor-wait sm:gap-1.5 sm:px-2.5 ${a.seen ? "bg-green-500 text-black" : "bg-white/10 text-gray-100 hover:bg-white/20"}`}
					>
						<EyeIcon className={`h-4 w-4 ${a.seen ? "" : "text-green-300"}`} />
						{a.seen ? "Seen" : "Seen?"}
						{a.seenLog?.count && (
							<span className="tabular-nums opacity-70">{a.seenLog.count}</span>
						)}
					</button>
				</UserAction>
				<button
					ref={scoreButton}
					type="button"
					aria-haspopup="dialog"
					aria-expanded={scoring}
					aria-label={
						a.score
							? `Your score: ${a.score}, ${scoreLabels[a.score]}. Change it`
							: `Rate this ${t.kind}`
					}
					title={a.score ? `Your score: ${scoreLabels[a.score]}` : "Rate it"}
					onClick={(event) => askScore(event.currentTarget)}
					className="flex min-w-9 cursor-pointer items-center justify-center px-2 text-xs font-bold tabular-nums text-white outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80"
					style={
						a.score
							? selectedScoreStyle(a.score)
							: { background: "rgba(255,255,255,.06)" }
					}
				>
					{a.score ?? (
						<svg
							viewBox="0 0 20 20"
							fill="currentColor"
							className="h-4 w-4 shrink-0 text-amber-300"
							aria-hidden="true"
						>
							<path d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" />
						</svg>
					)}
				</button>
			</div>
			<ActionButton
				kind="hide"
				label="none"
				size="sm"
				className="!w-9 flex-none"
				active={a.hidden}
				disabled={!a.canHide || a.hidePending}
				title={hideTitle}
				onClick={pressHide}
			/>
			<Link
				to={t.href}
				className="flex h-9 shrink-0 items-center gap-1 rounded-lg bg-amber-400 px-2.5 text-[13px] font-black text-gray-950 hover:bg-amber-300 sm:px-3"
			>
				Details
				<span aria-hidden="true" className="max-sm:hidden">
					→
				</span>
			</Link>
			{scoring && (
				<Suspense fallback={null}>
					<TitleScoreDialog
						media={media}
						open
						opener={opener}
						layer="z-[1300]"
						onClose={() => setScoring(false)}
						onRated={() => setScoring(false)}
					/>
				</Suspense>
			)}
			{toast.node}
		</div>
	)
}

/** The previous and next arrows side by side. */
export function StepButtons({
	onStep,
	canPrev,
	canNext,
	small = false,
}: Steps & { small?: boolean }) {
	return (
		<div className={`flex justify-center ${small ? "gap-2" : "gap-3"}`}>
			<StepButton
				dir={-1}
				small={small}
				disabled={!canPrev}
				onClick={() => onStep(-1)}
			/>
			<StepButton
				dir={1}
				small={small}
				disabled={!canNext}
				onClick={() => onStep(1)}
			/>
		</div>
	)
}

function StepButton({
	dir,
	disabled,
	small,
	onClick,
}: { dir: -1 | 1; disabled: boolean; small: boolean; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-label={dir < 0 ? "Previous pick" : "Next pick"}
			className={`grid shrink-0 place-items-center rounded-full bg-gray-900/80 text-gray-200 ring-1 ring-white/15 hover:bg-white/10 disabled:opacity-25 ${small ? "size-9" : "size-11"}`}
		>
			<svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
				<path
					d={dir < 0 ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"}
					fill="none"
					stroke="currentColor"
					strokeWidth="2.2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		</button>
	)
}

export function CloseButton({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label="Close"
			className="absolute top-3 right-3 z-10 grid size-10 place-items-center rounded-full bg-gray-950/80 text-gray-200 ring-1 ring-white/15 hover:text-white"
		>
			<svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
				<path
					d="M5 5l10 10M15 5 5 15"
					stroke="currentColor"
					strokeWidth="2.2"
					strokeLinecap="round"
				/>
			</svg>
		</button>
	)
}
