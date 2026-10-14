// PROTOTYPE - throwaway. Small pieces the three variants of /prototype/media-language share: images, the pick list
// (one keyboard model for countries and languages), buttons, and the miniature of a title that the previews of
// variants A and C are made of. No layout lives here: each variant arranges these its own way.
import { CheckIcon, MagnifyingGlassIcon } from "@heroicons/react/24/solid"
import {
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useId,
	useRef,
	useState,
} from "react"
import { countryFlagUrl } from "~/utils/country-flag"
import {
	COUNTRIES,
	type Country,
	LANGS,
	LANG_NAME,
	type Lang,
	type OfferKind,
	type TitleFixture,
	countryName,
	logoOf,
} from "./fixtures"
import {
	type Field,
	type LangChoice,
	type Shown,
	langLabel,
	useStore,
} from "./model"

const TMDB = "https://image.tmdb.org/t/p"
export const tmdb = (path: string, size: string) => `${TMDB}/${size}${path}`

export function Flag({
	code,
	className = "h-3",
}: { code: string; className?: string }) {
	return (
		<img
			src={countryFlagUrl(code)}
			alt=""
			className={`shrink-0 rounded-[1px] ${className}`}
		/>
	)
}

/** A poster in the language it really is in. The lettering on it is what makes a language change visible. */
export function Poster({
	field,
	title,
	className = "",
}: { field: Field; title: string; className?: string }) {
	return (
		<span
			className={`relative block aspect-[2/3] shrink-0 overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10 ${className}`}
		>
			<span className="absolute inset-0 flex items-center justify-center p-1 text-center text-[10px] leading-tight text-gray-500">
				{title}
			</span>
			<img
				key={field.value}
				src={tmdb(field.value, "w342")}
				alt=""
				lang={field.lang}
				className="absolute inset-0 h-full w-full object-cover"
				draggable={false}
			/>
		</span>
	)
}

export function Logos({
	services,
	size = "h-6 w-6",
}: { services: string[]; size?: string }) {
	return (
		<span className="flex shrink-0 -space-x-1">
			{services.map((s) => (
				<img
					key={s}
					src={tmdb(logoOf(s), "w92")}
					alt={s}
					title={s}
					className={`${size} rounded-md bg-stone-800 ring-2 ring-stone-950`}
				/>
			))}
		</span>
	)
}

/** One line on where a title streams in a country. */
export function OfferLine({
	title,
	country,
	kind = "stream",
}: { title: TitleFixture; country: Country; kind?: OfferKind }) {
	const services = title.offers[country][kind]
	const rent = title.offers[country].rent
	if (services.length > 0)
		return (
			<span className="flex min-w-0 items-center gap-2">
				<Logos services={services} />
				<span className="min-w-0 truncate">{services.join(", ")}</span>
			</span>
		)
	return (
		<span className="text-gray-400">
			Not streaming in {countryName(country)}
			{rent.length > 0
				? `, to rent on ${rent.length} ${rent.length === 1 ? "service" : "services"}`
				: ""}
		</span>
	)
}

export function Spinner() {
	return (
		<span
			aria-hidden="true"
			className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
		/>
	)
}

const BUTTON = {
	primary:
		"bg-white text-black hover:bg-gray-200 disabled:bg-white/20 disabled:text-gray-400",
	quiet: "bg-white/10 text-white hover:bg-white/20 disabled:text-gray-500",
	ghost:
		"text-gray-300 hover:bg-white/10 hover:text-white disabled:text-gray-600",
	look: "bg-amber-300 text-black hover:bg-amber-200 disabled:bg-amber-300/30 disabled:text-gray-400",
}

export function Btn({
	kind = "quiet",
	busy = false,
	className = "",
	children,
	...rest
}: {
	kind?: keyof typeof BUTTON
	busy?: boolean
	children: ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
	// A busy button stays focusable: a button that turns disabled under the keyboard's focus drops that focus.
	return (
		<button
			type="button"
			{...rest}
			aria-disabled={busy || undefined}
			aria-busy={busy || undefined}
			onClick={busy ? undefined : rest.onClick}
			className={`inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-default aria-disabled:cursor-default aria-disabled:opacity-70 ${BUTTON[kind]} ${className}`}
		>
			{busy && <Spinner />}
			{children}
		</button>
	)
}

/**
 * Gives the focus back to the control that opened a list or a line once that has closed and left the focus on
 * nothing: after a pick with the keyboard the list is gone, and the focus would fall to the page's start.
 */
export function useReturnFocus(open: boolean) {
	const ref = useRef<HTMLButtonElement>(null)
	const was = useRef(open)
	useEffect(() => {
		if (
			was.current &&
			!open &&
			(!document.activeElement || document.activeElement === document.body)
		)
			ref.current?.focus({ preventScroll: true })
		was.current = open
	}, [open])
	return ref
}

/** Moves the focus to an element that has just appeared (a result line), when the control that led to it is gone. */
export function focusSoon(selector: string) {
	requestAnimationFrame(() => {
		if (!document.activeElement || document.activeElement === document.body)
			document
				.querySelector<HTMLElement>(selector)
				?.focus({ preventScroll: true })
	})
}

export interface PickItem<K extends string> {
	key: K
	label: string
	/** A second, smaller line: a language's own name, "follows your browser". */
	hint?: string
	icon?: ReactNode
	right?: ReactNode
}

// A list to pick one of: a search field (optional) over a listbox. Arrow keys, Home, End, Enter and typing all stay
// inside it; the variant switcher never sees them.
export function PickList<K extends string>({
	label,
	items,
	value,
	onChoose,
	search = false,
	autoFocus = false,
	className = "max-h-64",
	onEscape,
}: {
	label: string
	items: PickItem<K>[]
	value: K | null
	onChoose: (key: K) => void
	search?: boolean
	autoFocus?: boolean
	className?: string
	/** Escape closes this list only: the popover or dialog around it stays open. */
	onEscape?: () => void
}) {
	const id = useId()
	const [query, setQuery] = useState("")
	const q = query.trim().toLowerCase()
	const shown = q
		? items.filter((i) =>
				`${i.label} ${i.hint ?? ""} ${i.key}`.toLowerCase().includes(q),
			)
		: items
	const [active, setActive] = useState(() =>
		Math.max(
			0,
			items.findIndex((i) => i.key === value),
		),
	)
	const at = Math.min(active, Math.max(0, shown.length - 1))
	const inputRef = useRef<HTMLInputElement>(null)
	const listRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (autoFocus)
			(inputRef.current ?? listRef.current)?.focus({ preventScroll: true })
	}, [autoFocus])
	// Scrolls the list only. scrollIntoView would also scroll the page under an overlay.
	useEffect(() => {
		const list = listRef.current
		const row = list?.querySelector<HTMLElement>(`[data-at="${at}"]`)
		if (!list || !row) return
		if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop
		else if (
			row.offsetTop + row.offsetHeight >
			list.scrollTop + list.clientHeight
		)
			list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight
	}, [at])

	const onKey = (e: KeyboardEvent) => {
		const move = (to: number) => {
			e.preventDefault()
			setActive(Math.max(0, Math.min(shown.length - 1, to)))
		}
		if (e.key === "Escape" && onEscape) {
			e.preventDefault()
			e.stopPropagation()
			e.nativeEvent.stopImmediatePropagation()
			onEscape()
			return
		}
		if (e.key === "ArrowDown") move(at + 1)
		else if (e.key === "ArrowUp") move(at - 1)
		else if (e.key === "Home" && !search) move(0)
		else if (e.key === "End" && !search) move(shown.length - 1)
		else if ((e.key === "Enter" || (e.key === " " && !search)) && shown[at]) {
			e.preventDefault()
			onChoose(shown[at].key)
		}
	}
	const activeId = shown[at] ? `${id}-${shown[at].key}` : undefined

	return (
		<div>
			{search && (
				<label className="mb-2 flex h-9 items-center gap-2 rounded-lg bg-white/[0.07] px-2 ring-1 ring-white/10 focus-within:ring-white/40">
					<MagnifyingGlassIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
					<input
						ref={inputRef}
						value={query}
						onChange={(e) => {
							setQuery(e.target.value)
							setActive(0)
						}}
						onKeyDown={onKey}
						role="combobox"
						aria-expanded="true"
						aria-controls={id}
						aria-activedescendant={activeId}
						aria-label={label}
						placeholder={label}
						className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
					/>
				</label>
			)}
			<div
				ref={listRef}
				id={id}
				// biome-ignore lint/a11y/useSemanticElements: a select cannot show flags, logos or a second line
				role="listbox"
				aria-label={label}
				tabIndex={search ? -1 : 0}
				aria-activedescendant={search ? undefined : activeId}
				onKeyDown={search ? undefined : onKey}
				className={`overflow-y-auto overscroll-contain rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${className}`}
			>
				{shown.map((item, i) => {
					const selected = item.key === value
					return (
						// biome-ignore lint/a11y/useKeyWithClickEvents: the listbox handles the keys
						<div
							tabIndex={-1}
							key={item.key}
							id={`${id}-${item.key}`}
							data-at={i}
							// biome-ignore lint/a11y/useSemanticElements: see the listbox
							role="option"
							aria-selected={selected}
							onClick={() => onChoose(item.key)}
							onPointerMove={() => setActive(i)}
							className={`flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 text-sm text-white ${i === at ? "bg-white/[0.1]" : ""} ${selected ? "ring-1 ring-inset ring-white/25" : ""}`}
						>
							{item.icon}
							<span className="min-w-0 flex-1">
								<span className="block truncate">{item.label}</span>
								{item.hint && (
									<span className="block truncate text-xs text-gray-400">
										{item.hint}
									</span>
								)}
							</span>
							{item.right}
							{selected && (
								<CheckIcon
									className="h-4 w-4 shrink-0 text-white"
									aria-hidden="true"
								/>
							)}
						</div>
					)
				})}
				{shown.length === 0 && (
					<p className="px-2 py-2 text-sm text-gray-500">Nothing matches.</p>
				)}
			</div>
		</div>
	)
}

/** The countries as pick items, with what the current title has in each, the ones that stream it first. */
export function countryItems(title: TitleFixture): PickItem<Country>[] {
	return [...COUNTRIES]
		.sort(
			(a, b) =>
				Number(title.offers[b.code].stream.length > 0) -
				Number(title.offers[a.code].stream.length > 0),
		)
		.map((c) => {
			const stream = title.offers[c.code].stream
			return {
				key: c.code,
				label: c.name,
				icon: <Flag code={c.code} />,
				right: stream.length ? (
					<Logos services={stream} size="h-5 w-5" />
				) : (
					<span className="text-xs text-gray-500">not streaming</span>
				),
			}
		})
}

/** The languages as pick items. The first entry follows the browser and says where that ends today. */
export function langItems(browserLang: Lang): PickItem<LangChoice>[] {
	return [
		{
			key: "browser",
			label: "Browser default",
			hint: `Follows your browser: ${langLabel(browserLang)} right now`,
		},
		...LANGS.map((l) => ({
			key: l as LangChoice,
			label: LANG_NAME[l].name,
			hint:
				LANG_NAME[l].own === LANG_NAME[l].name ? undefined : LANG_NAME[l].own,
		})),
	]
}

/** "English, no Turkish yet": the honest mark on a field that is not in the selected language. */
export function FallbackTag({
	field,
	wanted,
	className = "",
}: { field: Field; wanted: Lang; className?: string }) {
	if (!field.fallback) return null
	return (
		<span
			className={`inline-flex items-center whitespace-nowrap rounded bg-white/10 px-1.5 py-1 text-[10px] font-semibold leading-none text-gray-300 ${className}`}
		>
			{langLabel(field.lang)} · no {langLabel(wanted)} yet
		</span>
	)
}

// The miniature of a title page for one country and one language: the poster, the title, the tagline, the start of
// the description, where it streams, and for a show its first episode. Against `than`, the parts that differ are
// marked, so a preview says what a change does and what it leaves alone.
export function MiniTitle({
	title,
	country,
	lang,
	than,
	dense = false,
}: {
	title: TitleFixture
	country: Country
	lang: Lang
	than?: { country: Country; lang: Lang }
	dense?: boolean
}) {
	const { resolve } = useStore()
	const shown = resolve(title, lang)
	const before = than ? resolve(title, than.lang) : null
	const differs = (get: (s: Shown) => Field) =>
		before !== null && get(before).value !== get(shown).value
	const mark = (changed: boolean) =>
		changed
			? "border-l-2 border-amber-300 pl-2"
			: "border-l-2 border-transparent pl-2"
	const countryChanged = than !== undefined && than.country !== country
	const episode = shown.episodes[0]
	return (
		<div className="flex min-w-0 gap-3">
			<div
				className={`self-start ${differs((s) => s.poster) ? "rounded-lg ring-2 ring-amber-300 ring-offset-2 ring-offset-stone-950" : ""}`}
			>
				<Poster
					field={shown.poster}
					title={shown.title.value}
					className={dense ? "w-14" : "w-16 sm:w-20"}
				/>
			</div>
			<div className="min-w-0 flex-1 space-y-1.5 text-sm">
				<div className={mark(differs((s) => s.title))}>
					<p
						lang={shown.title.lang}
						className={`font-semibold leading-snug text-white ${dense ? "text-sm" : "text-base"}`}
					>
						{shown.title.value}
					</p>
					<FallbackTag field={shown.title} wanted={lang} className="mt-1" />
				</div>
				{!dense && (
					<div className={mark(differs((s) => s.tagline))}>
						<p
							lang={shown.tagline.lang}
							className="truncate italic text-gray-300"
						>
							{shown.tagline.value}
						</p>
						<FallbackTag field={shown.tagline} wanted={lang} className="mt-1" />
					</div>
				)}
				<div className={mark(differs((s) => s.overview))}>
					<p
						lang={shown.overview.lang}
						className={`text-gray-400 ${dense ? "line-clamp-2 text-xs" : "line-clamp-3 text-[13px] leading-snug"}`}
					>
						{shown.overview.value}
					</p>
					<FallbackTag field={shown.overview} wanted={lang} className="mt-1" />
				</div>
				{episode && !dense && (
					<div
						className={mark(
							before !== null &&
								before.episodes[0].overview.value !== episode.overview.value,
						)}
					>
						<p className="line-clamp-2 text-[13px] leading-snug text-gray-400">
							<span
								lang={episode.name.lang}
								className="font-semibold text-gray-300"
							>
								{episode.name.value}:
							</span>{" "}
							<span lang={episode.overview.lang}>{episode.overview.value}</span>
						</p>
						<FallbackTag
							field={episode.overview}
							wanted={lang}
							className="mt-1"
						/>
					</div>
				)}
				<div
					className={`${mark(countryChanged)} flex min-h-7 items-start gap-2 pt-1 text-[13px] leading-snug text-gray-200`}
				>
					<Flag code={country} className="mt-1 h-3" />
					<OfferLine title={title} country={country} />
				</div>
			</div>
		</div>
	)
}

/** The sentence under a miniature when not everything is in the selected language. */
export function MissingLine({ shown, lang }: { shown: Shown; lang: Lang }) {
	if (shown.missing.length === 0) return null
	const list =
		shown.missing.length > 1
			? `${shown.missing.slice(0, -1).join(", ")} and ${shown.missing.at(-1)}`
			: shown.missing[0]
	return (
		<p className="text-xs text-gray-400">
			Not in {langLabel(lang)} yet for this title: the {list}. GoodWatch shows
			what it has and says so.
		</p>
	)
}
