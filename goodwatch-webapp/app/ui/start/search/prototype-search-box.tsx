// PROTOTYPE (prototype/start-search-box): simpler start page search box, ?variant=0|A|B|C. Never merge.
// 0 today's composer. A Discover's field (one line, one rotating example inside). B a pill that echoes the Choose
// button (amber icon disc, Gabarito, same height). C a compact pill: the example is the placeholder (an empty Search
// runs it) and the mood picker sits inside the pill. A, B and C show an OR between the search and the ledge.
import {
	ArrowRightIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { useSearchParams } from "@remix-run/react"
import {
	lazy,
	type ReactNode,
	Suspense,
	useEffect,
	useMemo,
	useRef,
	useState,
	type FocusEvent,
} from "react"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import { TRY } from "~/ui/discover-bar/DescribeField"
import { preloadSearchRequest } from "~/ui/search/search-client"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import type { StartQuery, StartResults } from "../stage/start-query"
import { createFieldCommit } from "./field-commit"
import { SEARCH_LABEL } from "./presets"

const SearchInterpretation = lazy(
	reloadOnStaleChunk(() => import("./SearchInterpretation")),
)

export type BoxVariant = "0" | "A" | "B" | "C"
const VARIANTS: { key: BoxVariant; name: string }[] = [
	{ key: "0", name: "Today" },
	{ key: "A", name: "Discover field" },
	{ key: "B", name: "Choose pill" },
	{ key: "C", name: "Compact pill, moods inside" },
]
const PLACEHOLDER = "Describe what you want to watch"
const TRY_MS = 3200

export function useBoxVariant(): BoxVariant {
	const [params] = useSearchParams()
	const v = params.get("variant")
	return VARIANTS.some((x) => x.key === v) ? (v as BoxVariant) : "A"
}

/** The example on show, rotating while the field is empty and nothing hovers it. */
function useExample(paused: boolean) {
	const [index, setIndex] = useState(0)
	const [hovered, setHovered] = useState(false)
	useEffect(() => setIndex(Math.floor(Math.random() * TRY.length)), [])
	const still = paused || hovered
	useEffect(() => {
		if (still || matchMedia("(prefers-reduced-motion: reduce)").matches) return
		const timer = setInterval(
			() => setIndex((i) => (i + 1) % TRY.length),
			TRY_MS,
		)
		return () => clearInterval(timer)
	}, [still])
	return { index, example: TRY[index], setHovered }
}

/** Every example stacked in one box, the current one shown (Discover's OneExample). */
function Examples({
	index,
	run,
	setHovered,
	className,
	clickable,
}: {
	index: number
	run: (text: string) => void
	setHovered: (on: boolean) => void
	className: string
	clickable: boolean
}) {
	return (
		<div
			className="relative h-5"
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			{TRY.map((example, position) => (
				<button
					key={example}
					type="button"
					tabIndex={clickable && position === index ? 0 : -1}
					aria-hidden={position !== index}
					onMouseDown={(e) => e.preventDefault()}
					onClick={() => run(example)}
					className={`absolute left-0 whitespace-nowrap text-left outline-none transition duration-500 ${clickable ? "cursor-pointer hover:text-amber-300 focus-visible:text-amber-300" : "pointer-events-none"} ${className} ${position === index ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0"}`}
				>
					Try “{example}”
				</button>
			))}
		</div>
	)
}

export function PrototypeSearchBox({
	variant,
	query,
	results,
	setDraft,
	search,
	clearSearch,
	onAsk,
	moods,
}: {
	variant: Exclude<BoxVariant, "0">
	query: StartQuery
	results: Pick<
		StartResults,
		"signature" | "status" | "reading" | "interpretation"
	>
	setDraft: (draft: string) => void
	search: (text: string) => void
	clearSearch: () => void
	onAsk?: () => void
	/** C only: the mood picker inside the pill. */
	moods?: ReactNode
}) {
	const field = useRef<HTMLInputElement>(null),
		latest = useRef({ query, search, clearSearch })
	latest.current = { query, search, clearSearch }
	const commit = useMemo(
		() =>
			createFieldCommit({
				searched: () => latest.current.query.text,
				search: (text) => latest.current.search(text),
				clear: () => latest.current.clearSearch(),
			}),
		[],
	)
	useEffect(() => commit.cancel, [commit])
	const filled = query.draft.trim().length > 0
	const { index, example, setHovered } = useExample(filled)
	const own = JSON.parse(results.signature)[0] === query.text
	const run = (phrase: string) => {
		commit.preset(phrase)
		onAsk?.()
	}
	const clear = () => {
		commit.cancel()
		clearSearch()
		field.current?.focus()
	}
	const onBlur = (event: FocusEvent<HTMLFormElement>) => {
		if (
			!event.currentTarget.contains(event.relatedTarget as Node | null) &&
			latest.current.query.text
		)
			onAsk?.()
	}
	const input = (className: string, placeholder: string) => (
		<input
			ref={field}
			id="start-search-input"
			type="search"
			aria-label={SEARCH_LABEL}
			value={query.draft}
			placeholder={placeholder}
			maxLength={SEARCH_MAX_CHARS}
			autoComplete="off"
			enterKeyHint="search"
			data-ph-no-capture
			onFocus={preloadSearchRequest}
			onChange={(e) => {
				setDraft(e.target.value)
				commit.type(e.target.value)
			}}
			className={`w-full min-w-0 border-0 bg-transparent p-0 text-white outline-none focus:ring-0 [&::-webkit-search-cancel-button]:hidden search-private ph-no-capture sentry-mask ${className}`}
		/>
	)
	const clearButton = filled ? (
		<button
			type="button"
			aria-label="Clear the search"
			onClick={clear}
			className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white"
		>
			<XMarkIcon className="h-5 w-5" aria-hidden />
		</button>
	) : null
	const reading = query.text ? (
		<div className="mt-2 overflow-hidden rounded-2xl bg-gray-950/90 ring-1 ring-white/15 backdrop-blur sm:rounded-[22px]">
			<Suspense
				fallback={
					<div className="px-6 py-3 text-sm text-gray-400">
						Reading your search…
					</div>
				}
			>
				<SearchInterpretation
					query={query.text}
					interpretation={own ? results.interpretation : undefined}
					reading={own ? results.reading : null}
					loading={!own || results.status === "loading"}
				/>
			</Suspense>
		</div>
	) : null

	const submit = (event: React.FormEvent) => {
		event.preventDefault()
		// C: an empty Search runs the example on show.
		if (!filled && variant === "C") {
			setDraft(example)
			run(example)
			return
		}
		if (!commit.submit(query.draft)) return
		field.current?.blur()
		onAsk?.()
	}

	return (
		<form
			role="search"
			data-search-composer=""
			data-proto-box={variant}
			className="start-bar relative mx-auto w-full"
			onBlur={onBlur}
			onSubmit={submit}
		>
			{variant === "A" && (
				<>
					<span aria-hidden className="start-bar-shadow psb-a-round" />
					<span aria-hidden className="start-bar-glow psb-a-round" />
					<div className="psb-a-round relative flex items-stretch bg-gray-950/90 pl-4 ring-1 ring-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-md lg:pl-8">
						<div className="relative flex min-h-[84px] min-w-0 flex-1 items-center gap-2 pr-2 lg:min-h-[100px] lg:pr-3">
							<div className="relative flex min-w-0 flex-1 flex-col justify-center self-stretch">
								{input(
									`brand-header text-[20px] leading-tight placeholder:text-[18px] placeholder:text-gray-400 lg:text-[25px] lg:placeholder:text-[25px] transition-transform duration-200 ${filled ? "translate-y-0" : "-translate-y-[11px]"}`,
									PLACEHOLDER,
								)}
								<div
									className={`absolute inset-x-0 bottom-3 transition-opacity duration-150 lg:bottom-4 ${filled ? "pointer-events-none opacity-0" : "opacity-100"}`}
								>
									<Examples
										index={index}
										run={run}
										setHovered={setHovered}
										clickable={!filled}
										className="text-[13px] text-gray-400"
									/>
								</div>
							</div>
							{clearButton}
						</div>
						<span
							className="hidden w-px shrink-0 self-stretch bg-white/12 lg:block"
							aria-hidden
						/>
						<div className="flex shrink-0 items-center pr-2.5 lg:pr-3 lg:pl-3">
							<button
								type="submit"
								aria-label="Search"
								className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-amber-400 font-bold text-gray-950 outline-none hover:bg-amber-300 focus-visible:ring-2 focus-visible:ring-white lg:h-auto lg:w-auto lg:px-6 lg:py-3.5"
							>
								<ArrowRightIcon className="h-5 w-5 lg:hidden" aria-hidden />
								<span className="hidden lg:inline">Search</span>
							</button>
						</div>
					</div>
				</>
			)}

			{variant === "B" && (
				<>
					<span aria-hidden className="psb-pill-glow" />
					<span aria-hidden className="start-bar-shadow psb-pill-round" />
					<span aria-hidden className="start-bar-glow psb-pill-round" />
					<div className="psb-pill psb-pill-round relative flex items-center gap-3 pr-2.5 pl-2.5 sm:gap-4 sm:pr-3.5 sm:pl-3.5">
						<span aria-hidden className="psb-disc">
							<MagnifyingGlassIcon className="h-5 w-5 sm:h-[26px] sm:w-[26px]" />
						</span>
						<div className="relative flex min-w-0 flex-1 flex-col justify-center self-stretch">
							{input(
								`psb-pill-text transition-transform duration-200 ${filled ? "translate-y-0" : "-translate-y-[10px] sm:-translate-y-[12px]"}`,
								PLACEHOLDER,
							)}
							<div
								className={`absolute inset-x-0 bottom-[10px] transition-opacity duration-150 sm:bottom-[14px] lg:bottom-[16px] ${filled ? "pointer-events-none opacity-0" : "opacity-100"}`}
							>
								<Examples
									index={index}
									run={run}
									setHovered={setHovered}
									clickable={!filled}
									className="text-[12px] font-semibold text-gray-400 sm:text-[14px]"
								/>
							</div>
						</div>
						{clearButton}
						<button type="submit" aria-label="Search" className="psb-go">
							<ArrowRightIcon className="h-5 w-5 sm:hidden" aria-hidden />
							<span className="hidden sm:inline">Search</span>
						</button>
					</div>
				</>
			)}

			{variant === "C" && (
				<>
					<span aria-hidden className="psb-pill-glow" />
					<span aria-hidden className="start-bar-shadow psb-pill-round" />
					<span aria-hidden className="start-bar-glow psb-pill-round" />
					<div className="psb-pill psb-pill-c psb-pill-round relative flex items-center gap-2 pr-2 pl-5 sm:gap-3 sm:pr-2.5 sm:pl-7">
						<MagnifyingGlassIcon
							aria-hidden
							className="h-5 w-5 shrink-0 text-amber-400 sm:h-6 sm:w-6"
						/>
						<div className="relative min-w-0 flex-1">
							{input("psb-pill-text psb-pill-text-c", "")}
							{!filled && (
								<div
									aria-hidden
									className="pointer-events-none absolute inset-0 flex items-center"
								>
									<Examples
										index={index}
										run={run}
										setHovered={setHovered}
										clickable={false}
										className="psb-pill-text psb-pill-text-c !text-gray-400"
									/>
								</div>
							)}
						</div>
						{clearButton}
						{moods ? (
							<div className="hidden shrink-0 sm:block">{moods}</div>
						) : null}
						<button type="submit" aria-label="Search" className="psb-go">
							<ArrowRightIcon className="h-5 w-5 sm:hidden" aria-hidden />
							<span className="hidden sm:inline">Search</span>
						</button>
					</div>
					{/* Phones: the pill is too narrow, so the moods stay under it. */}
					{moods ? (
						<div className="mt-2.5 flex justify-center sm:hidden">{moods}</div>
					) : null}
				</>
			)}
			{reading}
		</form>
	)
}

/** The OR between the search block and the ledge. */
export function SearchOr({ variant }: { variant: BoxVariant }) {
	if (variant === "0") return null
	return (
		<div className="start-or" data-variant={variant} aria-hidden>
			<i />
			<span>or</span>
			<i />
		</div>
	)
}

/** Floating variant switcher, dev builds only. */
export function SearchBoxSwitcher() {
	const [params, setParams] = useSearchParams()
	const current = useBoxVariant()
	const at = VARIANTS.findIndex((v) => v.key === current)
	const go = (step: number) => {
		const next = VARIANTS[(at + step + VARIANTS.length) % VARIANTS.length]
		const p = new URLSearchParams(params)
		p.set("variant", next.key)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	const goRef = useRef(go)
	goRef.current = go
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement | null
			if (
				t?.closest("input, textarea, [contenteditable]") ||
				e.metaKey ||
				e.ctrlKey ||
				e.altKey
			)
				return
			if (e.key === "ArrowLeft") goRef.current(-1)
			if (e.key === "ArrowRight") goRef.current(1)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [])
	if (!import.meta.env.DEV) return null
	return (
		<div className="fixed bottom-4 left-1/2 z-[2000] flex -translate-x-1/2 items-center gap-1 rounded-full bg-fuchsia-600 p-1 text-sm font-bold text-white shadow-[0_8px_30px_rgba(0,0,0,.6)] ring-2 ring-white">
			<button
				type="button"
				aria-label="Previous variant"
				onClick={() => go(-1)}
				className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full hover:bg-white/20"
			>
				<ChevronLeftIcon className="h-5 w-5" />
			</button>
			<span className="min-w-[200px] text-center">
				{VARIANTS[at].key} · {VARIANTS[at].name}
			</span>
			<button
				type="button"
				aria-label="Next variant"
				onClick={() => go(1)}
				className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full hover:bg-white/20"
			>
				<ChevronRightIcon className="h-5 w-5" />
			</button>
		</div>
	)
}
