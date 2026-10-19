// Reviewing a wishlist preview's entries, loaded on first use. The server groups the entries and lists the ones a
// member can match. For the entries shown, GoodWatch suggests a title when the file's Netflix ID matches one; the
// member accepts a suggestion, one by one or all shown at once, or searches the GoodWatch catalog and picks the title.
// Nothing is ever picked for them, and a suggestion counts only once accepted. Choices stay in this preview's memory until Update preview sends them, and the answer is a
// new preview. Leaving or reloading the page loses choices that weren't sent. A Change from the preview's lists asks
// the server for that row's entry, so it opens even when the row repeats an entry or sits on a page not loaded yet.
import { type FormEvent, useEffect, useId, useRef, useState } from "react"
import {
	WISHLIST_MATCH_ERROR_MESSAGES,
	WISHLIST_MATCH_RESTART_CODES,
	WISHLIST_SUGGESTION_COPY,
	wishlistSuggestionNote,
} from "~/domain/wishlist-match-copy"
import { Spinner } from "~/ui/wait/Spinner"
import { tmdbFixedImage } from "~/utils/tmdb-image"
import {
	type ImportRequestError,
	WISHLIST_MATCH_MAX_CHANGES,
	type WishlistMatchCandidate,
	type WishlistMatchGroup,
	type WishlistMatchSearch,
	type WishlistRowSuggestion,
	useWishlistMatchCandidates,
	useWishlistMatchEntry,
	useWishlistMatchGroups,
	useWishlistSuggestions,
} from "./SourceImportHooks"
import {
	tvtimeIntentLine,
	tvtimeMatchEffect,
	tvtimeReleaseDate,
} from "./TvTimeMatchCopy"
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
/** Above this many entries without a suggestion, the panel doesn't list them above the entries. */
const MAX_EXCEPTION_LINKS = 10
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
const entryName = (group: WishlistMatchGroup) =>
	fileTitle(group) || "This entry"
const evidenceOf = (group: WishlistMatchGroup) =>
	group.item.wishlistOriginal?.wishlistEvidence ?? group.item.wishlistEvidence
/** An entry the server lets the member match to a movie only, such as a movie named in TV Time's own export. */
const movieOnly = (group: WishlistMatchGroup) =>
	group.allowedMediaTypes?.length === 1 &&
	group.allowedMediaTypes[0] === "movie"
/** The source's release date for an entry, as a calendar day, when it has one. */
const releaseDateOf = (group: WishlistMatchGroup) =>
	tvtimeReleaseDate(
		group.item.wishlistOriginal?.tvtimeMovie?.releaseDate ??
			group.evidenceVariants[0]?.releaseDate,
	)
const SOURCE_NAMES: Record<string, string> = { tvtime: "TV Time" }

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

type Focus = { index: number; on: "toggle" | "search" | "accept" } | null

/** The suggestion as a title the member can accept. */
const suggestedTitle = (
	suggestion: WishlistRowSuggestion | undefined,
): MatchTitle | null =>
	suggestion?.state === "suggested" ? { ...suggestion.proposal } : null

export default function WishlistMatchPanel({
	importId,
	visible,
	draft,
	request,
	updating,
	locked,
	error,
	onChoose,
	onRevert,
	onAcceptAll,
	onUndoAccepted,
	bulkAccepted,
	onDiscard,
	onUpdate,
	onBack,
	suggest = true,
	note,
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
	/** Takes back an entry's pending change. Returns false while locked. */
	onRevert: (group: WishlistMatchGroup) => boolean
	/** Accepts all the given suggestions as one change, or none: while locked, or past the per-update limit. */
	onAcceptAll: (
		accepted: readonly { group: WishlistMatchGroup; title: MatchTitle }[],
	) => boolean
	/** Takes back the bulk accepts not changed since, and returns how many. */
	onUndoAccepted: () => number
	/** How many bulk accepts are still pending as accepted. */
	bulkAccepted: number
	onDiscard: () => void
	onUpdate: () => void
	onBack: () => void
	/** False for a source GoodWatch never suggests matches for, so no suggestions are asked for. */
	suggest?: boolean
	/** A line under the heading about how this source's matches apply. */
	note?: string
}) {
	const query = useWishlistMatchGroups(importId, true)
	const loaded = query.data?.pages.flatMap((page) => page.groups) ?? []
	// Suggestions cover the loaded pages only. An entry a Change opened from elsewhere is matched by hand.
	const suggestions = useWishlistSuggestions(importId, suggest ? loaded : [])
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
	const wasLoading = useRef(false)
	const bulkRef = useRef<HTMLButtonElement>(null)

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
	const bulkFullId = `${id}-bulk-full`
	const suggestionOf = (group: WishlistMatchGroup) =>
		savedMatch(group)
			? undefined
			: suggestions.rows.get(group.representativeIndex)
	const isAccepted = (group: WishlistMatchGroup) => {
		const suggested = suggestedTitle(suggestionOf(group))
		const pending = draft.get(group.representativeIndex)
		return !!suggested && !!pending && sameTitle(suggested, pending)
	}
	const acceptedCount = groups.filter(isAccepted).length
	const suggestedCount = groups.filter(
		(group) => suggestionOf(group)?.state === "suggested",
	).length
	// Bulk accept covers suggestions shown that the member hasn't accepted, changed, or chosen yet.
	const acceptable = groups.flatMap((group) => {
		const title = suggestedTitle(suggestionOf(group))
		return title && !draft.has(group.representativeIndex)
			? [{ group, title }]
			: []
	})
	const changedByMember = groups.filter(
		(group) =>
			suggestionOf(group)?.state === "suggested" &&
			draft.has(group.representativeIndex) &&
			!isAccepted(group),
	).length
	const bulkTooMany =
		acceptable.length > 0 &&
		draft.size + acceptable.length > WISHLIST_MATCH_MAX_CHANGES
	const unchecked = groups.filter((group) =>
		["failed", "unavailable"].includes(suggestionOf(group)?.state ?? ""),
	).length
	// The few entries GoodWatch had no suggestion for, named above a long list of suggestions so they're easy to reach.
	// A long list of them is the list itself, so the shortcut shows only beside suggestions and up to a handful.
	const exceptions = groups.filter(
		(group) =>
			suggestionOf(group)?.state === "manual" &&
			!draft.has(group.representativeIndex),
	)
	const showExceptions =
		suggestedCount > 0 &&
		exceptions.length > 0 &&
		exceptions.length <= MAX_EXCEPTION_LINKS
	useEffect(() => {
		if (wasLoading.current && !suggestions.loading && suggestedCount > 0)
			setSaid(
				suggestedCount === 1
					? "GoodWatch suggested a match for 1 title. Check it before you accept it."
					: `GoodWatch suggested matches for ${formatCount(suggestedCount)} titles. Check each one before you accept it.`,
			)
		wasLoading.current = suggestions.loading
	}, [suggestions.loading, suggestedCount])
	const acceptAll = () => {
		const count = acceptable.length
		if (!onAcceptAll(acceptable)) {
			setSaid(locked ? "" : FULL)
			return
		}
		bulkRef.current?.focus()
		setSaid(
			`Accepted ${formatCount(count)} ${count === 1 ? "suggestion" : "suggestions"}. They aren't in this preview yet.${changedByMember > 0 ? ` ${formatCount(changedByMember)} you changed ${changedByMember === 1 ? "stays" : "stay"} as you set ${changedByMember === 1 ? "it" : "them"}.` : ""}`,
		)
	}
	const undoAll = () => {
		const undone = onUndoAccepted()
		bulkRef.current?.focus()
		setSaid(
			undone === 1
				? "Took back 1 accepted suggestion."
				: `Took back ${formatCount(undone)} accepted suggestions.`,
		)
	}

	return (
		<div className="flex flex-col gap-4 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
			<h4
				ref={headingRef}
				tabIndex={-1}
				className="font-semibold text-gray-100 outline-none"
			>
				Review matches
			</h4>
			{note && <p className="text-sm text-gray-300">{note}</p>}
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
			{suggestions.loading && (
				<div className="flex items-center gap-2 text-sm text-gray-400">
					<Spinner size="small" /> {WISHLIST_SUGGESTION_COPY.looking}
				</div>
			)}
			<div aria-live="assertive">
				{!suggestions.loading && unchecked > 0 && (
					<div className="space-y-3">
						<p className={errorBox}>
							{WISHLIST_SUGGESTION_COPY.failed}{" "}
							{unchecked === 1
								? "1 title wasn't checked."
								: `${formatCount(unchecked)} titles weren't checked.`}
						</p>
						<button
							type="button"
							className={secondaryButton}
							disabled={locked}
							onClick={suggestions.retry}
						>
							Try again
							<span className="sr-only"> to check titles for a match</span>
						</button>
					</div>
				)}
			</div>
			{showExceptions && (
				<div className="flex flex-col gap-2">
					<p className="text-sm text-gray-300">
						{exceptions.length === 1
							? "1 title has no suggestion. Match it yourself:"
							: `${formatCount(exceptions.length)} titles have no suggestion. Match them yourself:`}
					</p>
					<ul className="flex flex-wrap gap-x-4">
						{exceptions.map((group) => (
							<li key={group.representativeIndex}>
								<button
									type="button"
									className={`${textLink} min-h-11 break-words text-left text-sm`}
									disabled={locked}
									onClick={() => {
										setOpenIndex(group.representativeIndex)
										setFocus({ index: group.representativeIndex, on: "search" })
									}}
								>
									<span className="sr-only">Match </span>
									{fileTitle(group) || "No title in your file"}
									<span className="sr-only"> yourself</span>
								</button>
							</li>
						))}
					</ul>
				</div>
			)}
			{(acceptable.length > 0 || bulkAccepted > 0) && (
				<div className="flex flex-col gap-2">
					{acceptable.length > 0 && (
						<p className="text-sm text-gray-300">
							{WISHLIST_SUGGESTION_COPY.check}
						</p>
					)}
					<div className="flex flex-wrap gap-3">
						<button
							ref={bulkRef}
							type="button"
							className={secondaryButton}
							disabled={locked || bulkTooMany}
							aria-describedby={bulkTooMany ? bulkFullId : undefined}
							onClick={acceptable.length > 0 ? acceptAll : undoAll}
						>
							{acceptable.length > 0
								? acceptable.length === 1
									? "Accept the 1 suggestion shown"
									: `Accept the ${formatCount(acceptable.length)} suggestions shown`
								: "Undo accept all"}
						</button>
						{acceptable.length > 0 && bulkAccepted > 0 && (
							<button
								type="button"
								className={secondaryButton}
								disabled={locked}
								onClick={undoAll}
							>
								Undo accept all
							</button>
						)}
					</div>
					{bulkTooMany && (
						<p id={bulkFullId} className="text-sm text-gray-300">
							There's room for{" "}
							{formatCount(WISHLIST_MATCH_MAX_CHANGES - draft.size)} more{" "}
							{WISHLIST_MATCH_MAX_CHANGES - draft.size === 1
								? "change"
								: "changes"}{" "}
							in this update, so GoodWatch can't accept all{" "}
							{formatCount(acceptable.length)}. Update the preview first, or
							accept them one at a time.
						</p>
					)}
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
									suggestion={suggestionOf(group)}
									accepted={isAccepted(group)}
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
									onAccept={(suggested) => {
										if (!onChoose(group, suggested)) {
											setSaid(locked ? "" : FULL)
											return
										}
										setFocus({ index, on: "toggle" })
										setSaid(
											`Accepted ${describe(suggested)}, ${typeName(suggested.mediaType).toLowerCase()}.`,
										)
									}}
									onUndoAccept={() => {
										if (!onRevert(group)) return
										setFocus({ index, on: "accept" })
										setSaid(`${entryName(group)} isn't accepted anymore.`)
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
							{acceptedCount === changes
								? changes === 1
									? "1 accepted suggestion isn't in this preview yet. Update the preview to count it."
									: `${formatCount(changes)} accepted suggestions aren't in this preview yet. Update the preview to count them.`
								: changes === 1
									? "1 change isn't in this preview yet. Update the preview to count it."
									: `${formatCount(changes)} changes aren't in this preview yet${acceptedCount > 0 ? `, ${formatCount(acceptedCount)} of them accepted ${acceptedCount === 1 ? "suggestion" : "suggestions"}` : ""}. Update the preview to count them.`}
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
	suggestion,
	accepted,
	alsoChosen,
	open,
	disabled,
	canChoose,
	fullId,
	panelId,
	onOpen,
	onCancel,
	onUse,
	onAccept,
	onUndoAccept,
	onClear,
}: {
	importId: string
	group: WishlistMatchGroup
	title: MatchTitle | null
	pending: boolean
	hadMatch: boolean
	/** GoodWatch's suggestion, for an entry on a loaded page without a match in this preview. */
	suggestion: WishlistRowSuggestion | undefined
	/** True when the pending match is the accepted suggestion. */
	accepted: boolean
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
	onAccept: (title: MatchTitle) => void
	onUndoAccept: () => void
	onClear: () => void
}) {
	const index = group.representativeIndex
	const suggested = title || pending ? null : suggestedTitle(suggestion)
	const note =
		title || pending || !suggestion || suggestion.state === "suggested"
			? null
			: wishlistSuggestionNote(suggestion.state)
	const shown = title ?? suggested
	const poster = shown?.posterPath
		? tmdbFixedImage("poster", shown.posterPath, POSTER_WIDTH)
		: null
	const name = fileTitle(group)
	const evidence = evidenceOf(group)
	const year = group.item.wishlistOriginal?.year ?? group.item.year
	// A movie-only entry says what the source has for it: its release date, watches, and For later.
	const movie = movieOnly(group)
	const line = (
		movie
			? [releaseDateOf(group) ?? year, tvtimeIntentLine(group.intentCounts)]
			: [
					year,
					evidence?.mediaType === "unknown" ? "Type unknown" : null,
					evidence?.sourceId ? `ID ${evidence.sourceId}` : null,
					group.entryCount > 1
						? `Listed ${formatCount(group.entryCount)} times`
						: null,
				]
	)
		.filter(Boolean)
		.join(" · ")
	const effect = movie ? tvtimeMatchEffect(group.intentCounts) : ""
	const label = name || "this entry"
	return (
		<li className="rounded-lg border border-slate-700 bg-gray-950/50 p-3 text-sm">
			<div className="flex items-start gap-3">
				{poster && (
					<img
						src={poster.src}
						srcSet={poster.srcSet}
						alt=""
						width={POSTER_WIDTH}
						height={69}
						loading="lazy"
						className="h-[69px] w-[46px] shrink-0 rounded bg-slate-800 object-cover"
					/>
				)}
				<div className="min-w-0">
					<p className="break-words font-semibold text-gray-100">
						{name || "No title in your file"}
					</p>
					<p className="break-words text-gray-400">{line}</p>
					<p className="mt-1 break-words text-gray-200">
						{title ? (
							<>
								<span className="font-semibold">Your match:</span>{" "}
								{describe(title)} · {typeName(title.mediaType)}
								{accepted && " · Accepted"}
							</>
						) : suggested ? (
							<>
								<span className="font-semibold">Suggested:</span>{" "}
								{describe(suggested)} · {typeName(suggested.mediaType)} ·{" "}
								{WISHLIST_SUGGESTION_COPY.reason}
							</>
						) : hadMatch ? (
							"Match removed"
						) : (
							(note ?? "Not matched")
						)}
						{pending && (
							<span className="text-gray-400"> · Not in this preview yet</span>
						)}
					</p>
				</div>
			</div>
			{effect && <p className="mt-1 text-gray-400">{effect}</p>}
			{alsoChosen && <p className="text-gray-400">{alsoChosen}</p>}
			{!open && (
				<div className="mt-2 flex flex-wrap gap-3">
					{suggested && (
						<button
							type="button"
							className={secondaryButton}
							data-focus={`accept-${index}`}
							disabled={disabled || !canChoose}
							aria-describedby={canChoose ? undefined : fullId}
							onClick={() => onAccept(suggested)}
						>
							Accept<span className="sr-only"> the suggestion for {label}</span>
						</button>
					)}
					<button
						type="button"
						className={secondaryButton}
						data-focus={`toggle-${index}`}
						aria-expanded={false}
						aria-controls={panelId}
						disabled={disabled}
						onClick={onOpen}
					>
						{title || suggested ? "Change" : "Find a match"}
						<span className="sr-only">
							{title || suggested ? ` the match for ${label}` : ` for ${label}`}
						</span>
					</button>
					{accepted ? (
						<button
							type="button"
							className={secondaryButton}
							disabled={disabled}
							onClick={onUndoAccept}
						>
							Undo accept<span className="sr-only"> for {label}</span>
						</button>
					) : (
						title && (
							<button
								type="button"
								className={secondaryButton}
								disabled={disabled || !canChoose}
								aria-describedby={canChoose ? undefined : fullId}
								onClick={onClear}
							>
								Clear<span className="sr-only"> the match for {label}</span>
							</button>
						)
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
	const movie = movieOnly(group)
	const released = releaseDateOf(group)
	const id = useId()
	const [text, setText] = useState(name)
	// A movie-only entry always searches movies; the server refuses a show for it.
	const [mediaType, setMediaType] = useState<WishlistMatchSearch["mediaType"]>(
		movie ? "movie" : null,
	)
	const [tooShort, setTooShort] = useState(false)
	// The file's title is searched once when the entry opens; after that, only when the member sends a search.
	const [search, setSearch] = useState<WishlistMatchSearch | null>(() =>
		name.length >= 2
			? { index, query: name.slice(0, 100), mediaType: movie ? "movie" : null }
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
	const kind = movie ? "movie" : "title"
	const question = name
		? `Which GoodWatch ${kind} is "${name}"?`
		: `Which GoodWatch ${kind} is this?`
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
					<dd>{movie ? "Movie" : "Not in your file"}</dd>
					{released && (
						<>
							<dt className="text-gray-400">Released</dt>
							<dd>{released}</dd>
						</>
					)}
					{evidence?.sourceId && (
						<>
							<dt className="text-gray-400">
								{SOURCE_NAMES[evidence.source]
									? `${SOURCE_NAMES[evidence.source]} ID`
									: "ID"}
							</dt>
							<dd className="break-words">
								{evidence.sourceId}
								{SOURCE_NAMES[evidence.source] ? "" : ` (${evidence.source})`}
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
										{tvtimeReleaseDate(variant.releaseDate)
											? ` (${tvtimeReleaseDate(variant.releaseDate)})`
											: variant.year
												? ` (${variant.year})`
												: ""}
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
				{!movie && (
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
				)}
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
				search.mediaType &&
				!movie && (
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
