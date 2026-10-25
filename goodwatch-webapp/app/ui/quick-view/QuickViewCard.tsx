// The quick view's content, one layout for every place: a head (backdrop, the poster on phones, the place's eyebrow,
// title, year and kind, the score pill and the taste match, Details and close), the place's reason line with its
// chips, the viewer's own services, the story, and the title's own control as the footer (TitleControl, the title
// page's). Every part keeps its height whatever the title has, so a step never moves anything.
import { ArrowsPointingOutIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import { DISPLAY } from "~/ui/my-pages/bits"
import { TitleScorePill } from "~/ui/poster-card/ScorePill"
import {
	ServiceLogos,
	type ServiceOffer,
	useYourServices,
} from "~/ui/poster-card/services"
import {
	type ControlMedia,
	type TitleChange,
	TitleControl,
} from "~/ui/title-actions/TitleControl"
import { ReasonChips } from "~/ui/title-card/ReasonChips"
import { HeaderSteps, useQuickViewFrame } from "./QuickView"

const TMDB = "https://image.tmdb.org/t/p"

/** What a place says about one title. Undefined: still loading (its room stays); null: there is none. */
export interface QuickViewTitle {
	media: ControlMedia
	/** The title page. */
	href: string
	/** "2019 · Movie · 112 min". */
	meta: string
	/** The title's language, for its name. */
	lang?: string
	poster: string | null
	backdrop?: string | null
	/** GoodWatch score, 0 to 100. */
	goodwatch: number | null
	/** Above the title: "#3 for you", the explorer's island. */
	eyebrow?: ReactNode
	/** Taste match, 50 to 99. */
	match?: number | null
	/** The place's reason line, up to two lines. */
	reason?: ReactNode
	/** Fingerprint keys as chips under the reason. */
	chips?: string[]
	/** The services that carry it; null while that loads. */
	services?: readonly ServiceOffer[] | null
	story?: string | null
	/** Under the reason in place of the chips (the explorer's sign-up prompt for a guest). */
	note?: ReactNode
	/** What the title page link says. */
	details?: string
	/** What the person changed with the footer's control. */
	onChange?: (change: TitleChange) => void
}

function Label({ children }: { children: ReactNode }) {
	return (
		<p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-gray-500 uppercase">
			{children}
		</p>
	)
}

/** Details and close as one control. */
function Tools({ href, label }: { href: string; label: string }) {
	const { close } = useQuickViewFrame()
	return (
		<div className="flex h-10 items-stretch overflow-hidden rounded-xl border border-white/25 bg-gray-950/85">
			<Link
				to={href}
				className="inline-flex items-center gap-1.5 px-3 text-sm font-extrabold text-white hover:bg-gray-100 hover:text-gray-950"
				data-quick-view-details=""
			>
				<ArrowsPointingOutIcon className="h-4 w-4" aria-hidden="true" />
				{label}
			</Link>
			<button
				type="button"
				onClick={close}
				aria-label="Close"
				className="grid w-10 cursor-pointer place-items-center border-l border-white/20 text-white hover:bg-white/15"
			>
				<XMarkIcon className="h-5 w-5" />
			</button>
		</div>
	)
}

function Services({ offers }: { offers: readonly ServiceOffer[] | null }) {
	const { applies, yours } = useYourServices(offers)
	// Nothing for a guest or a member without saved services.
	if (!applies) return null
	return (
		<section className="py-3" aria-label="On your services">
			<Label>On your services</Label>
			<div className="flex h-8 items-center">
				{offers === null ? (
					<span className="h-6 w-24 animate-pulse rounded-md bg-white/[0.06]" />
				) : yours.length ? (
					<ServiceLogos services={yours} size="L" />
				) : (
					<span className="text-[13px] text-gray-500">
						Not on your services
					</span>
				)}
			</div>
		</section>
	)
}

export function QuickViewCard({ title: t }: { title: QuickViewTitle }) {
	const { form, steps } = useQuickViewFrame()
	const card = form === "card"
	const name = t.media.details.title
	return (
		<>
			<div className="relative shrink-0 select-none">
				<div
					className={`relative overflow-hidden ${card ? "h-32" : "h-[4.5rem]"}`}
				>
					{t.backdrop && (
						<img
							src={`${TMDB}/w780${t.backdrop}`}
							alt=""
							draggable={false}
							className="size-full object-cover opacity-50"
						/>
					)}
					<span className="absolute inset-0 bg-linear-to-b from-gray-900/0 via-gray-900/55 to-gray-900" />
				</div>
				<div
					className={`relative flex items-end gap-3.5 px-4 ${card ? "-mt-16" : "-mt-12"}`}
				>
					{!card && (
						<div className="aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-lg bg-gray-800 shadow-xl ring-1 ring-white/15">
							{t.poster && (
								<img
									src={`${TMDB}/w185${t.poster}`}
									alt={name}
									draggable={false}
									className="size-full object-cover"
								/>
							)}
						</div>
					)}
					<div
						className={`flex min-w-0 flex-1 flex-col justify-end ${card ? "h-[8.25rem]" : "h-36"}`}
					>
						<p className="h-4 shrink-0 truncate text-[11px] font-bold tracking-[0.14em] text-amber-400/85 uppercase">
							{t.eyebrow}
						</p>
						<h2
							lang={t.lang}
							className={`${DISPLAY} mt-0.5 line-clamp-2 shrink-0 leading-tight text-white ${card ? "text-[1.45rem]" : "text-[1.25rem]"}`}
						>
							{name}
						</h2>
						<p className="mt-1 shrink-0 truncate text-xs text-gray-400">
							{t.meta}
						</p>
						<div className="mt-1.5 flex h-7 shrink-0 items-center gap-2">
							<TitleScorePill
								mediaType={t.media.mediaType}
								tmdbId={t.media.details.tmdb_id}
								goodwatch={t.goodwatch}
								size="L"
							/>
							{t.match != null && (
								<span className="text-[12.5px] font-semibold whitespace-nowrap text-amber-300/90">
									{t.match}% your taste
								</span>
							)}
						</div>
					</div>
				</div>
				<div className="absolute top-2 right-2 z-10 flex gap-1.5">
					{steps && !card && <HeaderSteps {...steps} />}
					<Tools href={t.href} label={t.details ?? "Details"} />
				</div>
			</div>
			<div className="min-h-0 flex-1 divide-y divide-white/[0.07] overflow-hidden px-4">
				<section className="py-3">
					<div className="flex min-h-8 items-center">
						{typeof t.reason === "string" ? (
							<p className="line-clamp-2 text-[14px] leading-5 text-gray-300">
								{t.reason}
							</p>
						) : (
							t.reason
						)}
					</div>
					{t.note ? (
						<div className="mt-2">{t.note}</div>
					) : (
						<div className="mt-2 h-5 overflow-hidden">
							<ReasonChips reasons={t.chips ?? []} />
						</div>
					)}
				</section>
				{t.services !== undefined && <Services offers={t.services} />}
				<section className="py-3">
					<Label>Story</Label>
					{t.story === undefined ? (
						<div className="h-10 space-y-2 pt-1" aria-hidden="true">
							<span className="block h-3 w-full animate-pulse rounded bg-white/[0.05]" />
							<span className="block h-3 w-2/3 animate-pulse rounded bg-white/[0.05]" />
						</div>
					) : (
						<p
							className={`line-clamp-2 h-10 text-[13px] leading-5 ${t.story ? "text-gray-400" : "text-gray-600"}`}
						>
							{t.story || "No overview yet."}
						</p>
					)}
				</section>
			</div>
			<div
				data-up=""
				className="group/menus flex shrink-0 flex-col gap-2 border-t border-white/10 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
			>
				<TitleControl
					media={t.media}
					place="view"
					layer="z-[1300]"
					onChange={t.onChange}
				/>
			</div>
		</>
	)
}
