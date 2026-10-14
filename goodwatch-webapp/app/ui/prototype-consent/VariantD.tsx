// PROTOTYPE - throwaway (#545). Variant D (not in the brief): consent belongs to the row, not to the site or to each
// card. The row's header asks once, with a chip per source; until then the cards are GoodWatch's own artwork and
// words. After "Show posts" the Bluesky posts appear and videos play on one click. A source left off can be turned
// on from its card. No site banner. What production would store: the same `consent_embeds` map as variant A.
import { useRef, useState } from "react"
import { type Post, type TalkedAbout, VENDORS, VENDOR_KEYS, type Vendor } from "./data"
import { Artwork, LiveEmbed, PostCaption, StatePanel, TalkedAboutRow, VendorMark, useHydrated, usePlayer, useStored } from "./kit"

type Stored = { decided: boolean; sources: Partial<Record<Vendor, boolean>> }
const KEY = "proto-consent:D"
const EMPTY: Stored = { decided: false, sources: {} }

export function VariantD() {
	const hydrated = useHydrated()
	const [stored, setStored] = useStored<Stored>(KEY, EMPTY)
	const state = hydrated ? stored : EMPTY
	const [editing, setEditing] = useState(false)
	const [pulse, setPulse] = useState(0)
	const stripRef = useRef<HTMLDivElement>(null)
	const turnOn = (vendor: Vendor) => setStored({ decided: true, sources: { ...state.sources, [vendor]: true } })
	const nudge = () => {
		stripRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
		setPulse((p) => p + 1)
	}

	return (
		<>
			<StatePanel
				variant="D · Ask in the row"
				question="One question in the row's header, a chip per source; no site banner, no question per card."
				cost="≈4.3 KB gzip own code (row question, facade, vendor marks, store); only where the row is"
				analytics="Untouched: analytics keep loading as today, without asking (a separate question)"
				stored={hydrated ? stored : "…"}
				onReset={() => {
					localStorage.removeItem(KEY)
					location.reload()
				}}
			/>
			<TalkedAboutRow
				header={
					<div ref={stripRef} className="px-4 sm:px-6">
						{state.decided && !editing ? (
							<div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
								{VENDOR_KEYS.some((v) => state.sources[v]) ? "Showing posts from" : "Posts are off"}
								{VENDOR_KEYS.filter((v) => state.sources[v]).map((v) => (
									<span key={v} className="flex items-center gap-1 text-neutral-300">
										<VendorMark vendor={v} className="h-3 w-3" /> {VENDORS[v].name}
									</span>
								))}
								<button type="button" className="underline hover:text-neutral-200" onClick={() => setEditing(true)}>
									Change
								</button>
							</div>
						) : (
							<ConsentStrip
								key={pulse}
								pulse={pulse > 0}
								initial={state.decided ? state.sources : Object.fromEntries(VENDOR_KEYS.map((v) => [v, true]))}
								onSave={(sources) => {
									setStored({ decided: true, sources })
									setEditing(false)
								}}
								onSkip={state.decided ? () => setEditing(false) : undefined}
							/>
						)}
					</div>
				}
				renderPost={(post, title) => (
					<FacadeD post={post} title={title} decided={state.decided} on={Boolean(state.sources[post.vendor])} onLocked={nudge} onTurnOn={() => turnOn(post.vendor)} />
				)}
			/>
		</>
	)
}

function ConsentStrip({
	initial,
	pulse,
	onSave,
	onSkip,
}: {
	initial: Partial<Record<Vendor, boolean>>
	pulse: boolean
	onSave: (sources: Partial<Record<Vendor, boolean>>) => void
	onSkip?: () => void
}) {
	const [sources, setSources] = useState(initial)
	const any = VENDOR_KEYS.some((v) => sources[v])
	return (
		<div
			className={`mb-4 flex flex-col gap-3 rounded-2xl bg-gradient-to-r from-amber-500/15 to-neutral-800/60 p-4 ring-1 sm:flex-row sm:items-center ${pulse ? "animate-pulse ring-amber-400" : "ring-amber-500/30"}`}
		>
			<div className="min-w-0 flex-1">
				<div className="font-semibold text-white">See what people are posting?</div>
				<p className="mt-0.5 text-xs leading-snug text-neutral-300">
					These posts load from the sources below, which get your IP address and can set cookies. We remember your choice.
				</p>
				<div className="mt-2 flex flex-wrap gap-2">
					{VENDOR_KEYS.map((v) => (
						<button
							key={v}
							type="button"
							aria-pressed={Boolean(sources[v])}
							onClick={() => setSources({ ...sources, [v]: !sources[v] })}
							className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
								sources[v] ? "bg-white text-black ring-white" : "bg-transparent text-neutral-400 ring-neutral-600 line-through"
							}`}
						>
							<VendorMark vendor={v} className="h-3.5 w-3.5" /> {VENDORS[v].name}
						</button>
					))}
				</div>
			</div>
			<div className="flex shrink-0 items-center gap-3">
				{onSkip && (
					<button type="button" onClick={onSkip} className="text-sm text-neutral-400 hover:text-neutral-200">
						Cancel
					</button>
				)}
				<button
					type="button"
					onClick={() => onSave(sources)}
					className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-black hover:bg-amber-300"
				>
					{any ? "Show posts" : "Keep posts off"}
				</button>
			</div>
		</div>
	)
}

function FacadeD({
	post,
	title,
	decided,
	on,
	onLocked,
	onTurnOn,
}: { post: Post; title: TalkedAbout; decided: boolean; on: boolean; onLocked: () => void; onTurnOn: () => void }) {
	const player = usePlayer(post.id)
	const vendor = VENDORS[post.vendor]
	const text = post.vendor === "bluesky"
	if (on && text) return <LiveEmbed post={post} />
	if (on && player.live) return <LiveEmbed post={post} />

	// Before the row's question is answered the card is GoodWatch's own; afterwards a source left off offers itself.
	const off = decided && !on
	const press = on ? player.start : off ? onTurnOn : onLocked
	const cta = on ? null : off ? `Turn on ${vendor.name}` : "Show posts above"

	if (text)
		return (
			<button type="button" onClick={press} className="block w-full rounded-xl bg-neutral-800/80 p-3 text-left ring-1 ring-white/5 hover:bg-neutral-800">
				<div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-neutral-200">
					<VendorMark vendor="bluesky" className="h-3.5 w-3.5" /> Bluesky
				</div>
				<PostCaption post={post} />
				<div className="mt-2 text-xs font-semibold text-amber-300">{cta}</div>
			</button>
		)

	return (
		<Artwork title={title} post={post}>
			<button type="button" onClick={press} className="absolute inset-0 flex items-center justify-center" aria-label={on ? `Play ${post.label}` : cta ?? ""}>
				{on ? (
					<span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 ring-2 ring-white/70">
						<svg viewBox="0 0 24 24" className="ml-1 h-6 w-6 fill-white" aria-hidden="true">
							<path d="M8 5v14l11-7z" />
						</svg>
					</span>
				) : (
					<span className="rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-400/50">{cta}</span>
				)}
			</button>
			<div className="pointer-events-none absolute inset-x-3 bottom-3">
				<PostCaption post={post} />
			</div>
		</Artwork>
	)
}
