// A pick's detail, one component for the phone title drawer (TitleDrawer.tsx) and the desktop pop-out card
// (PopOutCard.tsx). It has a fixed size: every section reserves its height, so next / previous never makes it jump.
// - head: backdrop; poster (inline, an empty slot, or none when the poster sits beside the card); "#3 for you", title,
//   year · kind · runtime, the GoodWatch score.
// - why: "Because you loved X" with its tiny poster (or the steer it answers), then one row of reason chips.
// - what it's like: the title's three most distinctive traits, never repeating a reason chip.
// - where to watch: service logos with short names, "+2" when there are more.
// - footer: previous / next arrows and "Open title page".
// Runtime, backdrop, services and overview load on demand (the details query); until then their room stays reserved.
import { Link } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import { forwardRef, useMemo } from "react"
import {
	type CardService,
	FP_KEYS,
	type ForYouDetail,
} from "~/domain/for-you-page/contract"
import type { Ranked } from "~/domain/for-you-page/rank"
import gwLogo from "~/img/goodwatch-logo.webp?no-inline"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { DISPLAY } from "~/ui/my-pages/bits"
import { ReasonChips } from "~/ui/title-card/ReasonChips"
import { assetUrl } from "~/utils/asset-url"
import { useAuthHref } from "~/utils/auth-href"
import { goodwatchScoreDisplay, goodwatchVibeIndex } from "~/utils/ratings"
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
	}
>(function DetailHead({ r, rank, poster, headProps }, slotRef) {
	const { pool } = useForYou()
	const t = titleAt(pool, r.index)
	const { detail } = useDetail(t.key)
	const side = poster === "none"
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
					<div className="w-[5.25rem] shrink-0 overflow-hidden rounded-lg bg-gray-800 shadow-xl ring-1 ring-white/15">
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
				)}
				{poster === "slot" && (
					<div
						ref={slotRef}
						className="aspect-[2/3] w-[5.25rem] shrink-0 rounded-lg"
					/>
				)}
				{/* Room for a two-line title whatever the title is. */}
				<div
					className={`flex min-w-0 flex-1 flex-col justify-end ${side ? "h-[6rem]" : "h-[5.5rem]"}`}
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
				<div className="shrink-0 pb-1">
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

/** Previous / next (arrows only) and the title page link. */
export function DetailFooter({
	r,
	onStep,
	canPrev,
	canNext,
}: {
	r: Ranked
	onStep: (d: -1 | 1) => void
	canPrev: boolean
	canNext: boolean
}) {
	const { pool } = useForYou()
	return (
		<div className="flex shrink-0 items-center gap-2 border-t border-white/10 px-4 pt-2.5 pb-3 md:px-6 md:pt-3 md:pb-4">
			<StepButton dir={-1} disabled={!canPrev} onClick={() => onStep(-1)} />
			<StepButton dir={1} disabled={!canNext} onClick={() => onStep(1)} />
			<Link
				to={titleAt(pool, r.index).href}
				className="ml-auto flex min-h-11 items-center gap-1.5 rounded-full bg-amber-400 px-4 text-[14px] font-black text-gray-950 hover:bg-amber-300"
			>
				Open title page
				<span aria-hidden="true">→</span>
			</Link>
		</div>
	)
}

function StepButton({
	dir,
	disabled,
	onClick,
}: { dir: -1 | 1; disabled: boolean; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-label={dir < 0 ? "Previous pick" : "Next pick"}
			className="grid size-11 shrink-0 place-items-center rounded-full text-gray-200 ring-1 ring-white/15 hover:bg-white/5 disabled:opacity-25"
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
