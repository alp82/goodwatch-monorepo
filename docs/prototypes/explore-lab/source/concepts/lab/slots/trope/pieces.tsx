// PROTOTYPE - throwaway (prototype/explore-r9). Pieces the trope page bodies share: the big case, the compact row, and
// paging with the site's round Prev / Next buttons (`~/ui/row-arrows` StepButton). Every write-up is drawn whole by
// the picked spoiler treatment (`<Part slot="trope-spoiler">`), never cut.
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react"
import { StepButton } from "~/ui/row-arrows"
import { FOCUS, poster } from "../../../../kit/ui"
import { GLIDE_T, QUICK_T } from "../../../../kit/ui/motion"
import type { Example } from "../tropes/model"
import { TwistTag } from "../tropes/parts"
import { Part } from "../../lab"

/** A write-up in the picked spoiler treatment. */
export function WriteUp({ e, tint, className }: { e: Example; tint: string; className?: string }) {
	return <Part slot="trope-spoiler" e={e} tint={tint} className={className} />
}

const still = (e: Example) => {
	const c = e.title.card
	return c.backdrop_path ? poster(c.backdrop_path, "w780") : poster(c.poster_path, "w342")
}

/** A big case: number, wide still, title, twist, the write-up as a quote. */
export function Case({ e, n, tint }: { e: Example; n: number; tint: string }) {
	const src = still(e)
	return (
		<article
			className="group grid gap-4 py-6 sm:grid-cols-[3rem_minmax(0,14rem)_minmax(0,1fr)] sm:gap-6"
			style={{ "--tint": tint } as CSSProperties}
		>
			<span
				aria-hidden
				className="font-display text-3xl leading-none font-bold text-[color-mix(in_oklab,var(--tint)_70%,white)] tabular-nums max-sm:hidden"
			>
				{String(n).padStart(2, "0")}
			</span>
			<Link
				to={e.title.to}
				prefetch="intent"
				className={`relative block aspect-video overflow-hidden rounded-xl bg-gray-800 ring-1 ring-white/10 ${FOCUS}`}
			>
				{src && (
					<img
						src={src}
						alt=""
						loading="lazy"
						decoding="async"
						className={`h-full w-full object-cover ${GLIDE_T} group-hover:scale-[1.03]`}
					/>
				)}
			</Link>
			<div className="min-w-0">
				<TitleLine e={e} big />
				<TwistTag example={e} className="mt-2" />
				<blockquote className="mt-3 border-l-2 border-[color-mix(in_oklab,var(--tint)_55%,transparent)] pl-4">
					<WriteUp e={e} tint={tint} className="text-[16px] leading-relaxed text-gray-200" />
				</blockquote>
			</div>
		</article>
	)
}

export function TitleLine({ e, big = false }: { e: Example; big?: boolean }) {
	const c = e.title.card
	return (
		<div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
			<Link
				to={e.title.to}
				prefetch="intent"
				className={`rounded-sm font-display font-bold text-white ${big ? "text-xl" : "text-[16px]"} ${QUICK_T} hover:text-amber-300 ${FOCUS}`}
			>
				{c.title}
			</Link>
			{c.release_year && (
				<span className="text-sm text-gray-500 tabular-nums">{c.release_year}</span>
			)}
		</div>
	)
}

/** A compact row: small poster, title and year, twist, the whole write-up. */
export function Row({ e, n, tint }: { e: Example; n?: number; tint: string }) {
	const c = e.title.card
	const src = poster(c.poster_path, "w154")
	return (
		<article className="group grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3.5 py-4">
			<Link
				to={e.title.to}
				prefetch="intent"
				className={`relative block aspect-[2/3] overflow-hidden rounded-md bg-gray-800 ring-1 ring-white/10 ${FOCUS}`}
			>
				{src && (
					<img
						src={src}
						alt=""
						loading="lazy"
						decoding="async"
						className="h-full w-full object-cover"
					/>
				)}
				{n !== undefined && (
					<span className="absolute top-0 left-0 rounded-br-md bg-black/70 px-1 text-[10px] font-bold text-white tabular-nums">
						{n}
					</span>
				)}
			</Link>
			<div className="min-w-0">
				<div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
					<TitleLine e={e} />
					<TwistTag example={e} />
				</div>
				<WriteUp e={e} tint={tint} className="mt-1.5 text-[14.5px] leading-relaxed text-gray-300" />
			</div>
		</article>
	)
}

/** Client-side pages over a list: the slice in view and the controls. Paging keeps the list's top in view. */
export function usePaged<T>(items: T[], per: number) {
	const [page, setPage] = useState(0)
	const top = useRef<HTMLDivElement>(null)
	const pages = Math.max(1, Math.ceil(items.length / per))
	const go = (p: number) => {
		setPage(Math.min(pages - 1, Math.max(0, p)))
		const el = top.current
		if (el && el.getBoundingClientRect().top < 80)
			el.scrollIntoView({
				block: "start",
				behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
			})
	}
	useEffect(() => setPage(0), [items])
	return {
		page,
		pages,
		go,
		top,
		slice: items.slice(page * per, page * per + per),
		from: page * per,
	}
}

/** "9–16 of 74" with the round Prev / Next buttons. */
export function Paging({
	paged,
	total,
	per,
	label,
	extra,
}: {
	paged: { page: number; pages: number; go: (p: number) => void }
	total: number
	per: number
	label: string
	extra?: ReactNode
}) {
	if (paged.pages <= 1) return extra ? <div className="flex items-center gap-3">{extra}</div> : null
	const from = paged.page * per + 1
	const to = Math.min(total, from + per - 1)
	return (
		<div className="flex flex-wrap items-center gap-3">
			{extra}
			<span className="text-sm text-gray-400 tabular-nums">
				{from}–{to} of {total}
			</span>
			<div className="flex items-center gap-1.5">
				<StepButton
					label={`Previous ${label}`}
					disabled={paged.page === 0}
					onClick={() => paged.go(paged.page - 1)}
				>
					<ChevronLeftIcon className="h-5 w-5" />
				</StepButton>
				<StepButton
					label={`Next ${label}`}
					disabled={paged.page >= paged.pages - 1}
					onClick={() => paged.go(paged.page + 1)}
				>
					<ChevronRightIcon className="h-5 w-5" />
				</StepButton>
			</div>
		</div>
	)
}

/** A page of items fading in when the page changes. */
export function PageFade({ k, children }: { k: number; children: ReactNode }) {
	return (
		<div
			key={k}
			className="animate-[trope-page_240ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none"
		>
			<style>
				{
					"@keyframes trope-page{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}"
				}
			</style>
			{children}
		</div>
	)
}
