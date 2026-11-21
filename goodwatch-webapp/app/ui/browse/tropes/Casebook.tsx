// A trope's examples as a casebook: the three strongest cases large (number, wide still, title, twist, the write-up
// as a quote), then every other example as a compact row, eight to a page with Prev and Next. Every title once, every
// write-up whole, its spoilers held back.
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react"
import type { Example } from "~/domain/tropes/pages"
import { poster } from "~/ui/browse/base"
import { FOCUS, GLIDE_T, QUICK_T } from "~/ui/browse/motion"
import { TwistTag } from "~/ui/browse/tropes/parts"
import { WriteUp } from "~/ui/browse/tropes/Spoiler"
import { StepButton } from "~/ui/row-arrows"

const LEAD = 3
const PER = 8

const still = (e: Example) => {
	const c = e.title.card
	return c.backdrop_path ? poster(c.backdrop_path, "w780") : poster(c.poster_path, "w342")
}

function TitleLine({ e, big = false }: { e: Example; big?: boolean }) {
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

/** A big case: number, wide still, title, twist, the write-up as a quote. */
function Case({ e, n, tint }: { e: Example; n: number; tint: string }) {
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
				tabIndex={-1}
				aria-hidden
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

/** A compact row: small poster, title and year, twist, the whole write-up. */
function Row({ e, n, tint }: { e: Example; n: number; tint: string }) {
	const src = poster(e.title.card.poster_path, "w154")
	return (
		<article className="group grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3.5 py-4">
			<Link
				to={e.title.to}
				prefetch="intent"
				tabIndex={-1}
				aria-hidden
				className="relative block aspect-[2/3] overflow-hidden rounded-md bg-gray-800 ring-1 ring-white/10"
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
				<span className="absolute top-0 left-0 rounded-br-md bg-black/70 px-1 text-[10px] font-bold text-white tabular-nums">
					{n}
				</span>
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

/** Pages over a list in the browser: the slice in view and the controls. Paging keeps the list's top in view. */
function usePaged<T>(items: T[], per: number) {
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

/** "9–16 of 74" with the round Prev and Next buttons. */
function Paging({
	paged,
	total,
}: {
	paged: { page: number; pages: number; go: (p: number) => void }
	total: number
}) {
	if (paged.pages <= 1) return null
	const from = paged.page * PER + 1
	const to = Math.min(total, from + PER - 1)
	return (
		<div className="flex flex-wrap items-center gap-3">
			<span className="text-sm text-gray-400 tabular-nums">
				{from}–{to} of {total}
			</span>
			<div className="flex items-center gap-1.5">
				<StepButton
					label="Previous cases"
					disabled={paged.page === 0}
					onClick={() => paged.go(paged.page - 1)}
				>
					<ChevronLeftIcon className="h-5 w-5" />
				</StepButton>
				<StepButton
					label="Next cases"
					disabled={paged.page >= paged.pages - 1}
					onClick={() => paged.go(paged.page + 1)}
				>
					<ChevronRightIcon className="h-5 w-5" />
				</StepButton>
			</div>
		</div>
	)
}

const FADE =
	"@keyframes trope-page{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}"

/** A page of cases fading in when the page changes. */
function PageFade({ k, children }: { k: number; children: ReactNode }) {
	return (
		<div
			key={k}
			className="animate-[trope-page_240ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none"
		>
			{/* oxlint-disable-next-line react/no-danger -- our own constant CSS, set raw so it hydrates the same */}
			<style dangerouslySetInnerHTML={{ __html: FADE }} />
			{children}
		</div>
	)
}

export function Casebook({
	cases,
	noun,
	tint,
	tools,
}: {
	/** The examples, strongest first. */
	cases: Example[]
	/** "movies", "shows", "movies and shows". */
	noun: string
	tint: string
	/** The page-level spoiler switch, by the heading. */
	tools?: ReactNode
}) {
	const lead = cases.slice(0, LEAD)
	const rest = cases.slice(LEAD)
	const paged = usePaged(rest, PER)
	if (!cases.length)
		return <p className="py-10 text-gray-400">No write-ups for these {noun} yet.</p>
	return (
		<div>
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="font-display text-2xl font-bold text-white">The strongest cases</h2>
					<p className="mt-1 text-[15px] text-gray-400">The {noun} where it's clearest.</p>
				</div>
				{tools}
			</div>
			<ol className="mt-4 divide-y divide-white/[0.07] border-y border-white/[0.07]">
				{lead.map((e, i) => (
					<li key={e.title.card.key}>
						<Case e={e} n={i + 1} tint={tint} />
					</li>
				))}
			</ol>
			{rest.length > 0 && (
				<section className="mt-10" aria-labelledby="more-cases">
					<div
						ref={paged.top}
						className="flex scroll-mt-32 flex-wrap items-center justify-between gap-3"
					>
						<h3 id="more-cases" className="font-display text-xl font-bold text-white">
							More cases
						</h3>
						<Paging paged={paged} total={rest.length} />
					</div>
					<PageFade k={paged.page}>
						<ol className="mt-2 divide-y divide-white/[0.07]">
							{paged.slice.map((e, i) => (
								<li key={e.title.card.key}>
									<Row e={e} n={LEAD + paged.from + i + 1} tint={tint} />
								</li>
							))}
						</ol>
					</PageFade>
					<div className="mt-3 flex justify-end border-t border-white/[0.07] pt-4">
						<Paging paged={paged} total={rest.length} />
					</div>
				</section>
			)}
		</div>
	)
}
