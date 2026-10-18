// Matching a wishlist preview's entries by hand, loaded on first use. The server groups the entries and lists the
// ones a member can match. The member searches the GoodWatch catalog for each one and picks the title; nothing is
// ever picked for them. Choices stay in this preview's memory until Update preview sends them, and the answer is a
// new preview. Leaving or reloading the page loses choices that weren't sent. A Change from the preview's lists asks
// the server for that row's entry, so it opens even when the row repeats an entry or sits on a page not loaded yet.
import { type FormEvent, useEffect, useId, useRef, useState } from "react"
import {
	WISHLIST_MATCH_ERROR_MESSAGES,
	WISHLIST_MATCH_RESTART_CODES,
} from "~/domain/wishlist-match-copy"
import { Spinner } from "~/ui/wait/Spinner"
import { tmdbFixedImage } from "~/utils/tmdb-image"
import {
	type ImportRequestError,
	WISHLIST_MATCH_MAX_CHANGES,
	type WishlistMatchCandidate,
	type WishlistMatchGroup,
	type WishlistMatchSearch,
	useWishlistMatchCandidates,
	useWishlistMatchEntry,
	useWishlistMatchGroups,
} from "./SourceImportHooks"
import {
	errorBox,
	formatCount,
	primaryButton,
	secondaryButton,
	textLink,
} from "./shared"

/** A title shown as a match: the member's pending pick, or the one the preview already holds. */
export type MatchTitle = WishlistMatchCandidate
/** Pending changes by representative row: a title, or null to clear the preview's match. */
export type MatchDraft = ReadonlyMap<number, MatchTitle | null>

const FULL =
	"That's the most changes for one update. Update the preview to keep them, then match more."

/** The search answers at most this many titles. */
const MAX_CANDIDATES = 20
const POSTER_WIDTH = 46

const typeName = (mediaType: MatchTitle["mediaType"]) =>
	mediaType === "show" ? "Show" : "Movie"
const describe = (title: MatchTitle) =>
	`${title.title}${title.year ? ` (${title.year})` : ""}`
const sameTitle = (a: MatchTitle | null, b: MatchTitle | null) =>
	a?.mediaType === b?.mediaType && a?.tmdbId === b?.tmdbId
const titleKey = (title: MatchTitle) => `${title.mediaType}:${title.tmdbId}`

/** The file's title for an entry, never the chosen catalog title. */
export const fileTitle = (group: WishlistMatchGroup) =>
	(group.item.wishlistOriginal?.title ?? group.item.title).trim()
const evidenceOf = (group: WishlistMatchGroup) =>
	group.item.wishlistOriginal?.wishlistEvidence ?? group.item.wishlistEvidence

/** The match this preview holds for an entry, from the server. */
export function savedMatch(group: WishlistMatchGroup): MatchTitle | null {
	const saved = group.item.wishlistResolution
	return saved
		? {
				mediaType: saved.mediaType,
				tmdbId: saved.tmdbId,
				title: saved.title,
				year: saved.year,
				posterPath: null,
			}
		: null
}

const httpsHost = (url: string | undefined) => {
	if (!url) return null
	try {
		const parsed = new URL(url)
		return parsed.protocol === "https:" ? parsed.host : null
	} catch {
		return null
	}
}

const isRestart = (error: ImportRequestError | null) =>
	!!error?.code &&
	(WISHLIST_MATCH_RESTART_CODES as readonly string[]).includes(error.code)

type Focus = { index: number; on: "toggle" | "search" } | null

export default function WishlistMatchPanel({
	importId,
	visible,
	draft,
	request,
	updating,
	locked,
	error,
	onChoose,
	onDiscard,
	onUpdate,
	onBack,
}: {
	importId: string
	visible: boolean
	draft: MatchDraft
	/** An entry the member asked to change from the preview's lists. */
	request: { index: number; seq: number } | null
	updating: boolean
	/** True while this preview is being imported or updated. Nothing in the panel can change then. */
	locked: boolean
	error: ImportRequestError | null
	/** Returns false when the choice can't be kept: while locked, or past the per-update limit. */
	onChoose: (group: WishlistMatchGroup, title: MatchTitle | null) => boolean
	onDiscard: () => void
	onUpdate: () => void
	onBack: () => void
}) {
	const query = useWishlistMatchGroups(importId, true)
	const loaded = query.data?.pages.flatMap((page) => page.groups) ?? []
	const total = query.data?.pages.at(-1)?.total ?? 0
	// Entries opened by a Change before their page loaded. A page that brings one in takes its place.
	const [extras, setExtras] = useState<WishlistMatchGroup[]>([])
	const groups = [
		...loaded,
		...extras.filter(
			(extra) =>
				!loaded.some(
					(group) => group.representativeIndex === extra.representativeIndex,
				),
		),
	]
	// The row a Change asked for while the server finds its entry.
	const [lookup, setLookup] = useState<number | null>(null)
	const entry = useWishlistMatchEntry(importId, lookup)
	const headingRef = useRef<HTMLHeadingElement>(null)
	const listRef = useRef<HTMLDivElement>(null)
	const [openIndex, setOpenIndex] = useState<number | null>(null)
	const [focus, setFocus] = useState<Focus>(null)
	const [said, setSaid] = useState("")
	const handled = useRef(0)
	const id = useId()

	useEffect(() => {
		if (visible && !request) headingRef.current?.focus()
	}, [visible, request])
	// A Change from the preview's lists opens the row's entry: at once when it's shown, otherwise after the server
	// names it. Until then, the request stays open and shows its progress or its error with Try again.
	const shownIndexes = groups.map((group) => group.representativeIndex).join()
	useEffect(() => {
		if (!request || handled.current === request.seq) return
		handled.current = request.seq
		if (shownIndexes.split(",").includes(String(request.index))) {
			setLookup(null)
			setOpenIndex(request.index)
			setFocus({ index: request.index, on: "search" })
		} else setLookup(request.index)
	}, [request, shownIndexes])
	const found = lookup !== null && entry.isSuccess ? entry.data.group : null
	useEffect(() => {
		if (!found) return
		setExtras((current) =>
			current.some(
				(group) => group.representativeIndex === found.representativeIndex,
			)
				? current
				: [...current, found],
		)
		setOpenIndex(found.representativeIndex)
		setFocus({ index: found.representativeIndex, on: "search" })
		setLookup(null)
	}, [found])
	const lookupFailed = lookup !== null && entry.isError
	useEffect(() => {
		if (lookupFailed) headingRef.current?.focus()
	}, [lookupFailed])
	useEffect(() => {
		if (!focus) return
		const target = listRef.current?.querySelector<HTMLElement>(
			`[data-focus="${focus.on}-${focus.index}"]`,
		)
		if (target) {
			target.focus()
			setFocus(null)
		}
	})

	const current = (group: WishlistMatchGroup) =>
		draft.has(group.representativeIndex)
			? (draft.get(group.representativeIndex) ?? null)
			: savedMatch(group)
	const chosenBy = new Map<string, string[]>()
	for (const group of groups) {
		const title = current(group)
		if (title)
			chosenBy.set(titleKey(title), [
				...(chosenBy.get(titleKey(title)) ?? []),
				fileTitle(group) || "an entry without a title",
			])
	}
	const full = draft.size >= WISHLIST_MATCH_MAX_CHANGES
	const changes = draft.size
	const fullId = `${id}-full`

	return (
		<div className="flex flex-col gap-4 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
			<h4
				ref={headingRef}
				tabIndex={-1}
				className="font-semibold text-gray-100 outline-none"
			>
				Match titles
			</h4>
			<p className="sr-only" aria-live="polite">
				{said}
			</p>
			{query.isPending && (
				<div className="flex items-center gap-2 text-sm text-gray-400">
					<Spinner size="small" /> Loading entries
				</div>
			)}
			{query.isError && (
				<div className="space-y-3">
					<p className={errorBox}>{query.error.message}</p>
					<div className="flex flex-wrap gap-3">
						{isRestart(query.error as ImportRequestError) ? (
							<button
								type="button"
								className={secondaryButton}
								onClick={onBack}
							>
								Choose the file again
							</button>
						) : (
							<button
								type="button"
								className={secondaryButton}
								onClick={() =>
									groups.length ? query.fetchNextPage() : query.refetch()
								}
							>
								Try again
							</button>
						)}
					</div>
				</div>
			)}
			{lookup !== null && entry.isPending && (
				<div className="flex items-center gap-2 text-sm text-gray-400">
					<Spinner size="small" /> Opening the entry
				</div>
			)}
			<div aria-live="assertive">
				{lookupFailed && (
					<div className="space-y-3">
						<p className={errorBox}>{entry.error.message}</p>
						{isRestart(entry.error as ImportRequestError) ? (
							<button
								type="button"
								className={secondaryButton}
								onClick={onBack}
							>
								Choose the file again
							</button>
						) : (
							<button
								type="button"
								className={secondaryButton}
								onClick={() => entry.refetch()}
							>
								Try again
							</button>
						)}
					</div>
				)}
			</div>
			{query.isSuccess && groups.length === 0 && lookup === null && (
				<div className="space-y-3">
					<p className="text-gray-300">
						There's nothing to match in this preview. To start over, choose the
						file again.
					</p>
					<button type="button" className={secondaryButton} onClick={onBack}>
						Choose the file again
					</button>
				</div>
			)}
			{groups.length > 0 && (
				<div ref={listRef}>
					<ul aria-label="Entries to match" className="flex flex-col gap-3">
						{groups.map((group) => {
							const index = group.representativeIndex
							const title = current(group)
							const others = title
								? (chosenBy.get(titleKey(title)) ?? []).length - 1
								: 0
							const otherName = title
								? chosenBy
										.get(titleKey(title))
										?.find(
											(name) =>
												name !==
												(fileTitle(group) || "an entry without a title"),
										)
								: undefined
							return (
								<Entry
									key={index}
									importId={importId}
									group={group}
									title={title}
									pending={draft.has(index)}
									hadMatch={savedMatch(group) !== null}
									alsoChosen={
										others === 1 && otherName
											? `You also chose this title for "${otherName}".`
											: others > 1
												? `You also chose this title for ${formatCount(others)} other entries.`
												: null
									}
									open={openIndex === index}
									disabled={locked}
									canChoose={!full || draft.has(index)}
									fullId={fullId}
									panelId={`${id}-${index}`}
									onOpen={() => {
										setOpenIndex(index)
										setFocus({ index, on: "search" })
									}}
									onCancel={() => {
										setOpenIndex(null)
										setFocus({ index, on: "toggle" })
									}}
									onUse={(chosen) => {
										if (!onChoose(group, chosen)) {
											setSaid(locked ? "" : FULL)
											return
										}
										setOpenIndex(null)
										setFocus({ index, on: "toggle" })
										setSaid(
											`Matched to ${describe(chosen)}, ${typeName(chosen.mediaType).toLowerCase()}.`,
										)
									}}
									onClear={() => {
										if (!onChoose(group, null)) {
											setSaid(locked ? "" : FULL)
											return
										}
										if (openIndex === index) setOpenIndex(null)
										setFocus({ index, on: "toggle" })
										setSaid("Match cleared.")
									}}
								/>
							)
						})}
					</ul>
					<div className="mt-3 flex flex-wrap items-center gap-3">
						{query.hasNextPage && !query.isError && (
							<button
								type="button"
								className={`${textLink} min-h-11 text-sm`}
								disabled={query.isFetchingNextPage}
								onClick={() => query.fetchNextPage()}
							>
								{query.isFetchingNextPage ? "Loading more" : "Show more"}
							</button>
						)}
						{query.isSuccess && (
							<span className="text-sm text-gray-500">
								Showing {formatCount(groups.length)} of{" "}
								{formatCount(Math.max(total, groups.length))}
							</span>
						)}
					</div>
				</div>
			)}
			{(groups.length > 0 || changes > 0) && (
				<div className="flex flex-col gap-3 border-t border-slate-700 pt-4">
					{changes > 0 && (
						<p className="text-sm text-gray-300">
							{changes === 1
								? "1 change isn't in this preview yet. Update the preview to count it."
								: `${formatCount(changes)} changes aren't in this preview yet. Update the preview to count them.`}
						</p>
					)}
					{full && (
						<p id={fullId} className="text-sm text-gray-300">
							{FULL}
						</p>
					)}
					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							className={primaryButton}
							disabled={changes === 0 || locked}
							onClick={onUpdate}
						>
							{updating ? "Updating preview" : "Update preview"}
						</button>
						{changes > 0 && (
							<button
								type="button"
								className={secondaryButton}
								disabled={locked}
								onClick={() => {
									onDiscard()
									setSaid("Changes discarded.")
								}}
							>
								Discard changes
							</button>
						)}
					</div>
					<div aria-live="assertive">
						{error && (
							<div className="space-y-3">
								<p className={errorBox}>{error.message}</p>
								{isRestart(error) && (
									<button
										type="button"
										className={secondaryButton}
										onClick={onBack}
									>
										Choose the file again
									</button>
								)}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	)
}

function Entry({
	importId,
	group,
	title,
	pending,
	hadMatch,
	alsoChosen,
	open,
	disabled,
	canChoose,
	fullId,
	panelId,
	onOpen,
	onCancel,
	onUse,
	onClear,
}: {
	importId: string
	group: WishlistMatchGroup
	title: MatchTitle | null
	pending: boolean
	hadMatch: boolean
	alsoChosen: string | null
	open: boolean
	disabled: boolean
	/** False when this entry has no pending change and the update already holds the most changes. */
	canChoose: boolean
	fullId: string
	panelId: string
	onOpen: () => void
	onCancel: () => void
	onUse: (title: MatchTitle) => void
	onClear: () => void
}) {
	const index = group.representativeIndex
	const name = fileTitle(group)
	const evidence = evidenceOf(group)
	const year = group.item.wishlistOriginal?.year ?? group.item.year
	const line = [
		year,
		"Type unknown",
		evidence?.sourceId ? `ID ${evidence.sourceId}` : null,
		group.entryCount > 1
			? `Listed ${formatCount(group.entryCount)} times`
			: null,
	]
		.filter(Boolean)
		.join(" · ")
	const label = name || "this entry"
	return (
		<li className="rounded-lg border border-slate-700 bg-gray-950/50 p-3 text-sm">
			<p className="break-words font-semibold text-gray-100">
				{name || "No title in your file"}
			</p>
			<p className="break-words text-gray-400">{line}</p>
			<p className="mt-1 break-words text-gray-200">
				{title ? (
					<>
						<span className="font-semibold">Your match:</span> {describe(title)}{" "}
						· {typeName(title.mediaType)}
					</>
				) : hadMatch ? (
					"Match removed"
				) : (
					"Not matched"
				)}
				{pending && (
					<span className="text-gray-400"> · Not in this preview yet</span>
				)}
			</p>
			{alsoChosen && <p className="text-gray-400">{alsoChosen}</p>}
			{!open && (
				<div className="mt-2 flex flex-wrap gap-3">
					<button
						type="button"
						className={secondaryButton}
						data-focus={`toggle-${index}`}
						aria-expanded={false}
						aria-controls={panelId}
						disabled={disabled}
						onClick={onOpen}
					>
						{title ? "Change" : "Find a match"}
						<span className="sr-only">
							{title ? ` the match for ${label}` : ` for ${label}`}
						</span>
					</button>
					{title && (
						<button
							type="button"
							className={secondaryButton}
							disabled={disabled || !canChoose}
							aria-describedby={canChoose ? undefined : fullId}
							onClick={onClear}
						>
							Clear<span className="sr-only"> the match for {label}</span>
						</button>
					)}
				</div>
			)}
			<div id={panelId} hidden={!open}>
				{open && (
					<Editor
						importId={importId}
						group={group}
						current={title}
						disabled={disabled}
						canChoose={canChoose}
						onCancel={onCancel}
						onUse={onUse}
					/>
				)}
			</div>
		</li>
	)
}

const TYPES = [
	{ value: null, label: "Movies and shows" },
	{ value: "movie", label: "Movies" },
	{ value: "show", label: "Shows" },
] as const

function Editor({
	importId,
	group,
	current,
	disabled,
	canChoose,
	onCancel,
	onUse,
}: {
	importId: string
	group: WishlistMatchGroup
	current: MatchTitle | null
	disabled: boolean
	canChoose: boolean
	onCancel: () => void
	onUse: (title: MatchTitle) => void
}) {
	const index = group.representativeIndex
	const name = fileTitle(group)
	const evidence = evidenceOf(group)
	const original = group.item.wishlistOriginal ?? group.item
	const host = httpsHost(evidence?.sourceUrl)
	const id = useId()
	const [text, setText] = useState(name)
	const [mediaType, setMediaType] =
		useState<WishlistMatchSearch["mediaType"]>(null)
	const [tooShort, setTooShort] = useState(false)
	// The file's title is searched once when the entry opens; after that, only when the member sends a search.
	const [search, setSearch] = useState<WishlistMatchSearch | null>(() =>
		name.length >= 2
			? { index, query: name.slice(0, 100), mediaType: null }
			: null,
	)
	const [picked, setPicked] = useState<string | null>(null)
	const query = useWishlistMatchCandidates(importId, search)
	const candidates = query.data?.candidates ?? []
	const run = (next: WishlistMatchSearch["mediaType"]) => {
		const value = text.trim()
		if (value.length < 2) {
			setTooShort(true)
			setSearch(null)
			return
		}
		setTooShort(false)
		setPicked(null)
		setSearch({ index, query: value.slice(0, 100), mediaType: next })
	}
	const submit = (event: FormEvent) => {
		event.preventDefault()
		run(mediaType)
	}
	const chosen = candidates.find((item) => titleKey(item) === picked) ?? null
	const question = name
		? `Which GoodWatch title is "${name}"?`
		: "Which GoodWatch title is this?"
	return (
		<div
			className="mt-3 flex flex-col gap-4"
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					event.stopPropagation()
					onCancel()
				}
			}}
		>
			<div>
				<p className="font-semibold text-gray-100">From your file</p>
				<dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
					<dt className="text-gray-400">Title</dt>
					<dd className="break-words">{name || "Not in your file"}</dd>
					<dt className="text-gray-400">Year</dt>
					<dd>{original.year ?? "Not in your file"}</dd>
					<dt className="text-gray-400">Type</dt>
					<dd>Not in your file</dd>
					{evidence?.sourceId && (
						<>
							<dt className="text-gray-400">ID</dt>
							<dd className="break-words">
								{evidence.sourceId} ({evidence.source})
							</dd>
						</>
					)}
				</dl>
				{group.entryCount > 1 && (
					<div className="mt-2">
						<p>
							Listed {formatCount(group.entryCount)} times in your file. Your
							match applies to every one.
						</p>
						{group.evidenceVariants.length > 1 && (
							<ul className="mt-1 list-disc pl-5 text-gray-300">
								{group.evidenceVariants.map((variant, at) => (
									<li
										// biome-ignore lint/suspicious/noArrayIndexKey: variants have no ID and never reorder
										key={at}
										className="break-words"
									>
										{variant.title ? `"${variant.title}"` : "No title"}
										{variant.year ? ` (${variant.year})` : ""}
									</li>
								))}
								{group.hasMoreEvidence && <li>Other spellings too</li>}
							</ul>
						)}
					</div>
				)}
				{host && evidence?.sourceUrl && (
					<a
						href={evidence.sourceUrl}
						target="_blank"
						rel="noopener noreferrer"
						className={`${textLink} mt-2 inline-flex min-h-11 items-center break-all`}
					>
						Open on {host} (new tab)
					</a>
				)}
			</div>
			<form
				// biome-ignore lint/a11y/useSemanticElements: the search landmark holds the field, the type choice, and the button
				role="search"
				className="flex flex-col gap-3"
				onSubmit={submit}
				aria-label={`Search for ${name || "this entry"}`}
			>
				<label className="flex flex-col gap-1">
					<span className="font-semibold text-gray-100">Search GoodWatch</span>
					<input
						type="search"
						data-focus={`search-${index}`}
						value={text}
						maxLength={100}
						disabled={disabled}
						onChange={(event) => setText(event.target.value)}
						className="min-h-11 rounded-md border border-slate-600 bg-slate-950 px-3 text-base text-gray-100"
					/>
				</label>
				<fieldset disabled={disabled}>
					<legend className="mb-1 text-gray-400">Show</legend>
					<div className="grid grid-cols-3 gap-2 max-[340px]:grid-cols-1">
						{TYPES.map((type) => (
							<label
								key={type.label}
								className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-2 ${mediaType === type.value ? "border-indigo-500 bg-indigo-950/50" : "border-slate-700"}`}
							>
								<input
									type="radio"
									name={`${id}-type`}
									checked={mediaType === type.value}
									onChange={() => setMediaType(type.value)}
									className="size-4 accent-indigo-500"
								/>
								{type.label}
							</label>
						))}
					</div>
				</fieldset>
				<button
					type="submit"
					className={`${secondaryButton} self-start`}
					disabled={disabled}
				>
					Search
				</button>
			</form>
			<div aria-live="polite" className="text-gray-300">
				{tooShort && (
					<p>{WISHLIST_MATCH_ERROR_MESSAGES.wishlist_search_invalid}</p>
				)}
				{!search && !tooShort && !name && (
					<p>
						Your file has no title for this entry. Search by name
						{host ? ", or open the link from your file to see what it is" : ""}.
					</p>
				)}
				{search && query.isFetching && (
					<p className="flex items-center gap-2">
						<Spinner size="small" /> Searching
					</p>
				)}
				{search && query.isSuccess && !query.isFetching && (
					<p>
						{candidates.length === 0
							? `No GoodWatch titles match "${search.query}". Try the original title, another spelling, or fewer words. If you can't find it, leave it unmatched. It won't be added.`
							: candidates.length >= MAX_CANDIDATES
								? `Showing the first ${formatCount(candidates.length)}. Add more words from the title to narrow the search.`
								: `${formatCount(candidates.length)} ${candidates.length === 1 ? "result" : "results"}.`}
					</p>
				)}
			</div>
			{search &&
				query.isSuccess &&
				candidates.length === 0 &&
				search.mediaType && (
					<button
						type="button"
						className={`${textLink} min-h-11 self-start`}
						disabled={disabled}
						onClick={() => {
							setMediaType(null)
							run(null)
						}}
					>
						Search movies and shows
					</button>
				)}
			{search && query.isError && (
				<div className="space-y-2">
					<p className={errorBox}>{query.error.message}</p>
					<button
						type="button"
						className={secondaryButton}
						onClick={() => query.refetch()}
					>
						Try again
					</button>
				</div>
			)}
			{candidates.length > 0 && (
				<fieldset disabled={disabled}>
					<legend className="mb-2 break-words font-semibold text-gray-100">
						{question}
					</legend>
					<div className="grid gap-2 sm:grid-cols-2">
						{candidates.map((candidate) => {
							const key = titleKey(candidate)
							const poster = candidate.posterPath
								? tmdbFixedImage("poster", candidate.posterPath, POSTER_WIDTH)
								: null
							return (
								<label
									key={key}
									className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-2 ${picked === key ? "border-indigo-500 bg-indigo-950/50" : "border-slate-700"}`}
								>
									<input
										type="radio"
										name={`${id}-title`}
										checked={picked === key}
										onChange={() => setPicked(key)}
										className="mt-1 size-4 shrink-0 accent-indigo-500"
									/>
									{poster ? (
										<img
											src={poster.src}
											srcSet={poster.srcSet}
											alt=""
											width={POSTER_WIDTH}
											height={69}
											loading="lazy"
											className="h-[69px] w-[46px] shrink-0 rounded bg-slate-800 object-cover"
										/>
									) : (
										<span
											aria-hidden
											className="h-[69px] w-[46px] shrink-0 rounded bg-slate-800"
										/>
									)}
									<span className="min-w-0">
										<span className="block break-words font-semibold text-gray-100">
											{candidate.title}
										</span>
										<span className="block text-gray-400">
											{[candidate.year, typeName(candidate.mediaType)]
												.filter(Boolean)
												.join(" · ")}
										</span>
										{sameTitle(candidate, current) && (
											<span className="block text-gray-300">Your match</span>
										)}
									</span>
								</label>
							)
						})}
					</div>
				</fieldset>
			)}
			{!canChoose && <p className="text-gray-300">{FULL}</p>}
			<div className="flex flex-wrap gap-3">
				<button
					type="button"
					className={primaryButton}
					disabled={!chosen || disabled || !canChoose}
					onClick={() => chosen && onUse(chosen)}
				>
					Use this match
				</button>
				<button type="button" className={secondaryButton} onClick={onCancel}>
					Cancel
				</button>
			</div>
		</div>
	)
}
