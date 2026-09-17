// THROWAWAY: three connected-journey layouts on /taste/quiz?prototype=journey&variant=A.
// Real host loader/header; all interactions, availability, authentication and transfers are simulated.
import { useSearchParams } from "@remix-run/react"
import { useState, type ReactNode } from "react"
import PrototypeSwitcher, {
	type Variant,
} from "~/ui/prototype/PrototypeSwitcher"
import type { ScoringMedia } from "~/ui/scoring/types"

const button =
	"rounded-lg border border-white/30 px-3 py-2 text-sm hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
const panel = "rounded-2xl border border-white/15 bg-white/5 p-5"
type Interaction = "8/10" | "Want to See" | "Skip"
type Screen =
	| "explore"
	| "details"
	| "wishlist"
	| "watchability"
	| "signup"
	| "review"
type Status = "ready" | "loading" | "empty" | "error"
const entries = [
	"Homepage",
	"Taste",
	"Search",
	"Title details",
	"Discover",
	"Category list",
	"Exploration",
	"Wishlist",
]
const fallback: ScoringMedia[] = [
	{
		tmdb_id: 1,
		media_type: "movie",
		title: "The quiet expedition",
		poster_path: "",
		synopsis: "An unlikely friendship on a journey into the unknown.",
	},
	{
		tmdb_id: 2,
		media_type: "movie",
		title: "After the rain",
		poster_path: "",
		synopsis: "A warm, offbeat story about starting again.",
	},
	{
		tmdb_id: 3,
		media_type: "show",
		title: "Night signal",
		poster_path: "",
		synopsis: "A mysterious transmission changes a small town.",
	},
	{
		tmdb_id: 4,
		media_type: "movie",
		title: "Far from home",
		poster_path: "",
		synopsis: "An intimate adventure with unexpected turns.",
	},
]
function Action({
	children,
	onClick,
}: { children: ReactNode; onClick: () => void }) {
	return (
		<button type="button" className={button} onClick={onClick}>
			{children}
		</button>
	)
}

export default function ConnectedJourneyPrototype({
	titles,
}: { titles: ScoringMedia[] }) {
	const [params] = useSearchParams()
	const variant: Variant =
		params.get("variant") === "B"
			? "B"
			: params.get("variant") === "C"
				? "C"
				: "A"
	const catalog = titles.length ? titles.slice(0, 8) : fallback
	const key = (title: ScoringMedia) => `${title.media_type}:${title.tmdb_id}`
	const [entry, setEntry] = useState("Taste")
	const [screen, setScreen] = useState<Screen>("explore")
	const [returnTo, setReturnTo] = useState<Screen>("explore")
	const [detailReturn, setDetailReturn] = useState<Screen>("explore")
	const [selected, setSelected] = useState(0)
	const [interactions, setInteractions] = useState<Record<string, Interaction>>(
		{},
	)
	const [status, setStatus] = useState<Status>("ready")
	const [mood, setMood] = useState("Anything")
	const [query, setQuery] = useState("")
	const [country, setCountry] = useState("")
	const [service, setService] = useState("")
	const [rentals, setRentals] = useState(false)
	const [dismissed, setDismissed] = useState(false)
	const [notice, setNotice] = useState("")
	const [account, setAccount] = useState(false)
	const [pending, setPending] = useState(false)
	const [transferError, setTransferError] = useState(false)
	const [reviewSelection, setReviewSelection] = useState<string[]>([])
	const ratings = Object.values(interactions).filter(
		(value) => value === "8/10",
	).length
	const wishlist = Object.values(interactions).filter(
		(value) => value === "Want to See",
	).length
	const title = catalog[selected] || catalog[0]
	const offers = [
		"Included · checked 4 days ago",
		"No matching offer · checked 2 days ago",
		"Availability unknown · last updated 35 days ago",
		"Rental · checked 3 days ago",
	]
	const fresh = catalog.filter((item) => !interactions[key(item)])
	const reviewRows = [
		...Object.entries(interactions).map(([id, value]) => ({
			id,
			text: `${catalog.find((item) => key(item) === id)?.title || id}: ${value}`,
			replacement: false,
		})),
		{
			id: "conflict-demo",
			text: "Example conflicting score: account 6/10 → guest 8/10",
			replacement: true,
		},
		{
			id: "preferences",
			text: `Example preferences: account US / Hulu → guest ${country || "unset"} / ${service || "unset"}`,
			replacement: true,
		},
	]
	function interact(value: Interaction) {
		if (
			value === "8/10" &&
			ratings >= 20 &&
			interactions[key(title)] !== "8/10" &&
			!account
		) {
			setNotice(
				"You have rated 20 titles. Create an account to rate another. You can still browse, edit ratings, Want to See, or Skip.",
			)
			return
		}
		setInteractions((previous) => ({ ...previous, [key(title)]: value }))
		setNotice(
			`${title.title}: ${value}. Your previous interaction for this title is replaced.`,
		)
	}
	function openDetails(item: ScoringMedia) {
		setDetailReturn(screen === "details" ? detailReturn : screen)
		setSelected(catalog.indexOf(item))
		setScreen("details")
	}
	function signup() {
		setReturnTo(screen)
		setScreen(pending ? "review" : "signup")
	}
	function finishTransfer(keep = false) {
		setPending(false)
		setAccount(true)
		setTransferError(false)
		setScreen(returnTo)
		setNotice(
			keep
				? "Account unchanged. Guest changes discarded by your explicit choice."
				: "Transfer complete. You're back where you left off. Unselected guest changes discarded.",
		)
		// After success this becomes the simulated member collection. No browser data is written.
		setInteractions(
			keep
				? {}
				: screen === "signup" || transferError
					? interactions
					: Object.fromEntries(
							Object.entries(interactions).filter(([id]) =>
								reviewSelection.includes(id),
							),
						),
		)
	}
	function seed(count: number) {
		setInteractions(
			Object.fromEntries(
				Array.from({ length: count }, (_, index) => [
					`example-rated-${index + 1}`,
					"8/10",
				]),
			),
		)
		setDismissed(false)
		setAccount(false)
		setNotice(
			`${count} example ratings loaded. These are fictional scenario records.`,
		)
	}
	const cards = (items: ScoringMedia[]) => (
		<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
			{items.map((item) => (
				<button
					type="button"
					key={key(item)}
					onClick={() => openDetails(item)}
					className="overflow-hidden rounded-xl border border-white/15 text-left hover:border-amber-300"
				>
					{item.poster_path ? (
						<img
							className="aspect-[2/3] w-full object-cover"
							src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
							alt=""
						/>
					) : (
						<div className="flex aspect-[2/3] items-end bg-gradient-to-br from-teal-900 to-slate-900 p-4 text-xl">
							{item.title}
						</div>
					)}
					<div className="p-3">
						<strong>{item.title}</strong>
						<p className="text-sm text-gray-400">
							{interactions[key(item)] || "Explore this title →"}
						</p>
					</div>
				</button>
			))}
		</div>
	)
	const progress = (
		<section className={panel}>
			<h2 className="text-lg font-bold">
				{account ? "Your account" : "Your progress"}
			</h2>
			<p className="my-2">
				{ratings} ratings · {wishlist} in Wishlist
			</p>
			<p className="mb-3 text-sm text-gray-300">
				{account
					? "Account handoff completed in this simulation."
					: "Keep your ratings, Wishlist and preferences across visits and devices with an account. Guest progress stays in this browser; clearing browser data can erase it."}
			</p>
			<div className="flex flex-wrap gap-2">
				<Action onClick={() => setScreen("wishlist")}>Open Wishlist</Action>
				{!account && (
					<Action onClick={signup}>
						{pending ? "Resume transfer" : "Keep my progress"}
					</Action>
				)}
			</div>
		</section>
	)
	const refine = (
		<div className="flex flex-wrap items-end gap-3">
			<label className="flex flex-col gap-1 text-sm">
				Find a title or start from one you like
				<input
					className="rounded-lg border border-white/30 bg-slate-900 p-2"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="A familiar title…"
				/>
			</label>
			<label className="flex flex-col gap-1 text-sm">
				Direction
				<select
					className="rounded-lg bg-slate-900 p-2"
					value={mood}
					onChange={(event) => setMood(event.target.value)}
				>
					{["Anything", "Warm & hopeful", "Suspense", "Science fiction"].map(
						(value) => (
							<option key={value}>{value}</option>
						),
					)}
				</select>
			</label>
			<Action
				onClick={() => {
					setScreen("watchability")
					setStatus("ready")
				}}
			>
				What can I watch?
			</Action>
		</div>
	)
	const actions = (
		<div className="my-4 flex flex-wrap gap-2">
			<Action onClick={() => interact("Want to See")}>Want to See</Action>
			<Action onClick={() => interact("8/10")}>Rate 8/10</Action>
			<Action onClick={() => interact("Skip")}>Skip</Action>
		</div>
	)
	const details = (
		<section className={panel}>
			<Action onClick={() => setScreen(detailReturn)}>
				← Continue {entry === "Title details" ? "discovering" : `from ${entry}`}
			</Action>
			<div className="mt-5 grid gap-5 sm:grid-cols-[150px_1fr]">
				{title.poster_path && (
					<img
						className="w-36 rounded-lg"
						src={`https://image.tmdb.org/t/p/w342${title.poster_path}`}
						alt=""
					/>
				)}
				<div>
					<p className="text-sm text-amber-300">
						{interactions[key(title)] || "A new possibility"}
					</p>
					<h2 className="text-3xl font-bold">{title.title}</h2>
					<p className="my-3 text-gray-300">
						{title.synopsis ||
							"Open a possibility, keep what interests you, and continue exploring."}
					</p>
					{actions}
					<p className="text-sm">
						Viewing options (fictional): {offers[selected % 4]}
					</p>
					<p className="my-2 text-sm text-gray-400">
						{selected % 4 === 2
							? "We cannot confirm watchability. Keep it in Wishlist while you explore alternatives."
							: selected % 4 === 1
								? "No matching offer found. Your interest is still worth keeping."
								: "Confirm access with the provider before watching."}
					</p>
					<Action onClick={() => setScreen("watchability")}>
						Check services & alternatives
					</Action>
				</div>
			</div>
		</section>
	)
	const recovery = (
		<section className={panel} aria-live="polite">
			<h2 className="text-xl font-bold">
				{status === "loading"
					? "Finding possibilities…"
					: status === "error"
						? "We couldn't refresh your suggestions"
						: "No exact matches for this direction"}
			</h2>
			<p className="my-3">
				Your progress and current direction are still here.
			</p>
			{status !== "empty" ? (
				<Action onClick={() => setStatus("ready")}>
					{status === "loading" ? "Finish simulated loading" : "Try again"}
				</Action>
			) : (
				<>
					<p className="mb-3">
						Preview: remove the “{mood}” direction to explore these
						possibilities. These do not satisfy your current constraints.
					</p>
					{cards(fresh.slice(0, 2))}
					<div className="mt-3">
						<Action
							onClick={() => {
								setMood("Anything")
								setStatus("ready")
							}}
						>
							Use this broader direction
						</Action>
					</div>
				</>
			)}
		</section>
	)
	const explore = (
		<>
			{refine}
			<p className="my-4 text-sm text-gray-400">
				{ratings
					? "Suggestions informed by your taste"
					: "General suggestions · start exploring, no ratings required"}{" "}
				· Example ranking; directions are simulated.
			</p>
			{status !== "ready" ? (
				recovery
			) : fresh.length ? (
				cards(fresh)
			) : (
				<p>
					You've explored these examples. Open Wishlist or reset the demo to
					keep going.
				</p>
			)}
		</>
	)
	const watchability = (
		<section className={panel}>
			<h2 className="text-2xl font-bold">What can I watch?</h2>
			<p className="my-3">
				Check the titles you are interested in. Broader discovery stays
				available.
			</p>
			<div className="mb-4 flex flex-wrap gap-3">
				<label>
					Country{" "}
					<select
						className="bg-slate-900 p-2"
						value={country}
						onChange={(event) => setCountry(event.target.value)}
					>
						<option value="">Choose</option>
						<option>Germany</option>
						<option>United States</option>
					</select>
				</label>
				<label>
					Service{" "}
					<select
						className="bg-slate-900 p-2"
						value={service}
						onChange={(event) => setService(event.target.value)}
					>
						<option value="">Choose</option>
						<option>Netflix</option>
						<option>Prime Video</option>
					</select>
				</label>
				<label className="flex items-center gap-2">
					<input
						type="checkbox"
						checked={rentals}
						onChange={(event) => setRentals(event.target.checked)}
					/>
					Include rentals / purchases
				</label>
			</div>
			{!country || !service ? (
				<p>Choose country and service to check these example offers.</p>
			) : status !== "ready" ? (
				recovery
			) : (
				<>
					<p className="mb-3 text-sm text-amber-300">
						Fictional offers for layout review · included by default; unknown
						availability excluded.
					</p>
					{cards(
						catalog.filter(
							(_, index) => index % 4 === 0 || (rentals && index % 4 === 3),
						),
					)}
				</>
			)}
			<div className="mt-4">
				<Action onClick={() => setScreen("explore")}>
					Back to all discoveries
				</Action>
			</div>
		</section>
	)
	const auth = (
		<section className={`${panel} mx-auto max-w-2xl`}>
			<h2 className="text-2xl font-bold">
				{screen === "review"
					? "Review guest progress"
					: "Make this progress yours"}
			</h2>
			{screen === "signup" ? (
				<>
					<p className="my-4">
						Keep {ratings} ratings, {wishlist} Wishlist titles, skipped titles
						and your preferences. Continue from {entry} after signing in.
					</p>
					<p className="mb-4 text-sm text-gray-300">
						If you confirm your email on another device, return to this browser
						to finish transferring your guest progress.
					</p>
					<div className="flex flex-wrap gap-2">
						<Action
							onClick={() => {
								setPending(true)
								setAccount(true)
								setTransferError(true)
								setScreen("review")
							}}
						>
							Simulate new account / interrupted transfer
						</Action>
						<Action onClick={() => finishTransfer()}>
							Simulate successful new account
						</Action>
						<Action
							onClick={() => {
								setPending(true)
								setAccount(true)
								setTransferError(false)
								setReviewSelection([])
								setScreen("review")
							}}
						>
							Simulate existing account
						</Action>
						<Action
							onClick={() =>
								setNotice(
									"Sign-in failed. Guest progress remains here. Retry or continue exploring.",
								)
							}
						>
							Simulate sign-in failure
						</Action>
					</div>
				</>
			) : transferError ? (
				<>
					<p className="my-4">
						Your account is ready, but progress transfer did not finish. Guest
						progress remains in this browser until the transfer succeeds.
					</p>
					<Action onClick={() => finishTransfer()}>Retry transfer</Action>
				</>
			) : (
				<>
					<p className="my-4">
						Choose the additions and changes to bring into your account. Score
						replacements and preference changes start unselected.
					</p>
					<Action
						onClick={() =>
							setReviewSelection(
								reviewRows
									.filter((row) => !row.replacement)
									.map((row) => row.id),
							)
						}
					>
						Select all new entries
					</Action>
					<div className="my-3 space-y-3">
						{reviewRows.map((row) => (
							<label key={row.id} className="flex items-start gap-3">
								<input
									type="checkbox"
									checked={reviewSelection.includes(row.id)}
									onChange={(event) =>
										setReviewSelection((previous) =>
											event.target.checked
												? [...previous, row.id]
												: previous.filter((id) => id !== row.id),
										)
									}
								/>
								<span>{row.text}</span>
							</label>
						))}
					</div>
					<p className="my-3 text-sm text-amber-300">
						After confirmation succeeds, unselected guest changes are discarded.
						Closing this review leaves the transfer pending.
					</p>
					<div className="flex flex-wrap gap-2">
						<Action onClick={() => finishTransfer()}>
							Confirm {reviewSelection.length} changes
						</Action>
						<Action onClick={() => finishTransfer(true)}>
							Keep account unchanged
						</Action>
						<Action
							onClick={() =>
								setNotice(
									"Import failed. All guest changes are retained; retry confirmation.",
								)
							}
						>
							Simulate import failure
						</Action>
					</div>
				</>
			)}
			<div className="mt-5">
				<Action onClick={() => setScreen(returnTo)}>
					Close and continue exploring
				</Action>
			</div>
		</section>
	)
	let content: ReactNode = explore
	if (screen === "details") content = details
	if (screen === "watchability") content = watchability
	if (screen === "wishlist")
		content = (
			<section className={panel}>
				<h2 className="mb-4 text-2xl font-bold">Wishlist</h2>
				{wishlist ? (
					cards(
						catalog.filter((item) => interactions[key(item)] === "Want to See"),
					)
				) : (
					<p className="mb-4">
						Keep titles that interest you with Want to See. Your Wishlist will
						grow here.
					</p>
				)}
				<div className="mt-4">
					<Action onClick={() => setScreen("explore")}>
						Continue discovering
					</Action>
				</div>
			</section>
		)
	if (screen === "signup" || screen === "review") content = auth
	return (
		<main className="mx-auto max-w-7xl px-4 pb-48 pt-6 text-white">
			<details className="mb-6 rounded-xl border border-dashed border-amber-300/50 p-3 text-sm">
				<summary>
					Throwaway prototype · fictional availability and account actions · no
					data is saved
				</summary>
				<div className="mt-3 flex flex-wrap gap-3">
					<label>
						Arrive from{" "}
						<select
							className="bg-slate-900 p-2"
							value={entry}
							onChange={(event) => {
								setEntry(event.target.value)
								setScreen(
									event.target.value === "Title details"
										? "details"
										: event.target.value === "Wishlist"
											? "wishlist"
											: "explore",
								)
								setDetailReturn("explore")
							}}
						>
							{entries.map((value) => (
								<option key={value}>{value}</option>
							))}
						</select>
					</label>
					<label>
						Response{" "}
						<select
							className="bg-slate-900 p-2"
							value={status}
							onChange={(event) => setStatus(event.target.value as Status)}
						>
							{["ready", "loading", "empty", "error"].map((value) => (
								<option key={value}>{value}</option>
							))}
						</select>
					</label>
					<Action onClick={() => seed(10)}>10 ratings</Action>
					<Action onClick={() => seed(20)}>20 ratings</Action>
					<Action
						onClick={() => {
							setInteractions({})
							setPending(false)
							setAccount(false)
							setTransferError(false)
							setNotice("")
							setScreen("explore")
							setDismissed(false)
						}}
					>
						Reset guest
					</Action>
				</div>
				<p className="mt-3">
					Entry points are simulated within Taste's real shell. Search and
					directions preserve state but do not run a recommendation engine.
					Refresh resets this throwaway demo; production persistence is a
					separate delivery ticket.
				</p>
			</details>
			{notice && (
				<div role="status" className="mb-4 rounded-lg bg-teal-900 p-4">
					{notice}
				</div>
			)}
			{pending && screen !== "review" && (
				<div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-amber-950 p-4">
					Your guest progress is waiting to transfer.
					<Action
						onClick={() => {
							setReturnTo(screen)
							setScreen("review")
						}}
					>
						Resume transfer
					</Action>
				</div>
			)}
			{ratings >= 10 && !dismissed && !account && (
				<aside className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300/40 p-4">
					<p>
						You've shaped your taste with {ratings} ratings. Keep that progress
						across devices.
					</p>
					<Action onClick={signup}>Keep my progress</Action>
					<Action onClick={() => setDismissed(true)}>Not now</Action>
				</aside>
			)}
			{variant === "A" ? (
				<VariantA progress={progress} content={content} entry={entry} />
			) : variant === "B" ? (
				<VariantB
					progress={progress}
					content={content}
					focus={
						screen === "explore" && status === "ready" ? (
							<>
								{details}
								<p className="my-4">Next possibilities</p>
								{cards(fresh.slice(0, 3))}
							</>
						) : (
							content
						)
					}
					refine={refine}
				/>
			) : (
				<VariantC
					progress={progress}
					content={content}
					screen={screen}
					navigate={setScreen}
				/>
			)}
			<details className="mt-8 text-xs text-gray-400">
				<summary>Prototype state</summary>
				<pre className="mt-2 overflow-auto">
					{JSON.stringify(
						{
							variant,
							entry,
							screen,
							returnTo,
							detailReturn,
							selected,
							query,
							mood,
							country,
							service,
							rentals,
							status,
							interactions,
							dismissed,
							account,
							pending,
							transferError,
							reviewSelection,
						},
						null,
						2,
					)}
				</pre>
			</details>
			<PrototypeSwitcher />
		</main>
	)
}
function VariantA({
	progress,
	content,
	entry,
}: { progress: ReactNode; content: ReactNode; entry: string }) {
	return (
		<>
			<p className="text-sm uppercase tracking-widest text-amber-300">
				Continue from {entry}
			</p>
			<h1 className="mb-6 mt-2 text-4xl font-bold">
				Find your next possibility.
			</h1>
			<div className="grid items-start gap-6 lg:grid-cols-[1fr_280px]">
				<section>{content}</section>
				<aside>{progress}</aside>
			</div>
		</>
	)
}
function VariantB({
	progress,
	focus,
	refine,
}: {
	progress: ReactNode
	content: ReactNode
	focus: ReactNode
	refine: ReactNode
}) {
	return (
		<div className="grid items-start gap-6 lg:grid-cols-[260px_1fr]">
			<aside className="space-y-5">
				<h1 className="text-3xl font-bold">Follow your curiosity.</h1>
				<p className="text-gray-300">
					Take one title further, then follow the next possibility.
				</p>
				{refine}
				{progress}
			</aside>
			<section>{focus}</section>
		</div>
	)
}
function VariantC({
	progress,
	content,
	screen,
	navigate,
}: {
	progress: ReactNode
	content: ReactNode
	screen: Screen
	navigate: (screen: Screen) => void
}) {
	return (
		<div className="mx-auto max-w-4xl">
			<h1 className="mb-5 text-4xl font-bold">
				Something you'll want to watch.
			</h1>
			<nav aria-label="Discovery steps" className="mb-6 flex flex-wrap gap-3">
				<Action onClick={() => navigate("explore")}>1 · Find interest</Action>
				<Action onClick={() => navigate("wishlist")}>2 · Your shortlist</Action>
				<Action onClick={() => navigate("watchability")}>
					3 · Check watchability
				</Action>
			</nav>
			<p className="mb-4 text-sm text-gray-400">
				Jump to any step ·{" "}
				{screen === "explore"
					? "Start with what appeals to you"
					: "Keep following your interest"}
			</p>
			{content}
			<div className="mt-6">{progress}</div>
		</div>
	)
}
