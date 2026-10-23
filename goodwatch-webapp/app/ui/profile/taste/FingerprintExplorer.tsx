import { Link } from "@remix-run/react"
import { useReducedMotion } from "framer-motion"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
// The fingerprint section: the whorl, the five families as buttons, the family's attributes as diverging bars (sought
// right, avoided left), and one detail panel of fixed height that changes in place when an attribute is picked (no
// popups, no layout shift). A signed-in visitor gets a Vs me switch: the print keeps its size and its rim dots become
// tracks with both stances (RimTracks), the list turns to the biggest gaps with both bars, and the detail compares the
// two stances. Pointing at a row lights its track and ridges; pointing at a track lights its row.
import { FAMILY_NAMES } from "~/domain/taste-attributes"
import { PosterImg, ScorePair } from "../parts"
import { RimTracks } from "./RimTracks"
import { Whorl } from "./Whorl"
import {
	CRAFT_KEYS,
	FAMILY_COLOR,
	FAMILY_ORDER,
	type FamilyId,
	TIER_NAMES,
	TIER_NAMES_THEY,
	type TasteAttribute,
	type Tier,
	pct,
	signed,
	theirLine,
	useTaste,
} from "./model"
import { MiniPoster, PANEL, SectionHead } from "./parts"

const tierTone = (tier: Tier) =>
	tier >= 3
		? "bg-amber-400 text-gray-950"
		: tier === 2
			? "bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/50"
			: tier === 1
				? "bg-white/10 text-amber-100 ring-1 ring-white/15"
				: tier === 0
					? "bg-white/5 text-gray-400 ring-1 ring-white/10"
					: "bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/30"

type View = "top" | "common"

export function FingerprintExplorer() {
	const { taste, owner, handle, attributeByKey, compare: you } = useTaste()
	const compare = !!you
	const yours = useCallback(
		(key: string) => you?.yourEdges[key]?.edge ?? 0,
		[you],
	)
	const gap = (a: TasteAttribute) => Math.abs(a.edge - yours(a.key))
	const [family, setFamily] = useState<FamilyId | null>(null)
	const [view, setView] = useState<View>("top")
	const [vsOn, setVs] = useState(false)
	const vs = compare && vsOn
	const still = useReducedMotion() ?? false
	const [hover, setHover] = useState<string | null>(null)
	const listRef = useRef<HTMLUListElement>(null)
	// Pointing at a track brings its row into view inside the list; the page itself never scrolls.
	useEffect(() => {
		const ul = listRef.current
		const row = hover
			? ul?.querySelector<HTMLElement>(`[data-key="${hover}"]`)
			: null
		if (!ul || !row || ul.matches(":hover")) return
		const top = row.offsetTop
		if (
			top < ul.scrollTop ||
			top + row.offsetHeight > ul.scrollTop + ul.clientHeight
		)
			ul.scrollTo({
				top: top - ul.clientHeight / 2 + row.offsetHeight / 2,
				behavior: still ? "auto" : "smooth",
			})
	}, [hover, still])
	const [key, setKey] = useState<string>(
		taste.identity?.persona ?? taste.seek[0] ?? taste.attributes[0].key,
	)
	const picked = attributeByKey.get(key) as TasteAttribute
	const max = Math.max(
		...taste.attributes.map((a) => Math.abs(a.edge)),
		...(compare ? taste.attributes.map((a) => Math.abs(yours(a.key))) : []),
	)
	const worded = taste.attributes.filter((a) => !CRAFT_KEYS.has(a.key))
	const rows = family
		? taste.attributes
				.filter((a) => a.family === family)
				.sort((a, b) => (vs ? gap(b) - gap(a) : b.edge - a.edge))
		: vs
			? view === "common"
				? worded
						.filter((a) => a.edge > 0 && yours(a.key) > 0)
						.sort(
							(a, b) =>
								Math.min(b.edge, yours(b.key)) - Math.min(a.edge, yours(a.key)),
						)
						.slice(0, 10)
				: [...worded].sort((a, b) => gap(b) - gap(a)).slice(0, 12)
			: [
					// The strongest pulls either way, worded attributes first (craft says little: most loved titles are well made).
					...worded
						.filter((a) => a.edge > 0)
						.sort((a, b) => b.edge - a.edge)
						.slice(0, 8),
					...worded
						.filter((a) => a.edge < 0)
						.sort((a, b) => a.edge - b.edge)
						.slice(0, 4)
						.reverse(),
				]
	const pickFamily = (id: FamilyId | null, nextView: View = "top") => {
		setFamily(id)
		setView(nextView)
		const pool = id ? taste.attributes.filter((a) => a.family === id) : worded
		const top = [...pool].sort((a, b) =>
			vs ? gap(b) - gap(a) : b.edge - a.edge,
		)[0]
		if (top) setKey(top.key)
	}
	const pickAttribute = (k: string) => {
		setKey(k)
		setFamily(attributeByKey.get(k)?.family ?? null)
	}
	const toggleVs = () => {
		const next = !vsOn
		setVs(next)
		setView("top")
		if (next && !family) {
			const top = [...worded].sort((a, b) => gap(b) - gap(a))[0]
			if (top) setKey(top.key)
		}
	}
	const they = owner ? "you" : "they"
	return (
		<section aria-labelledby="fingerprint" className="flex flex-col gap-5">
			<SectionHead
				id="fingerprint"
				eyebrow="74 attributes, 5 families"
				lead={owner ? "Your" : "Their"}
				accent="fingerprint"
				sub={`Every title on GoodWatch is read for 74 attributes. Ridges swell where ${they} seek an attribute more than everyone does and rate it above ${owner ? "your" : "their"} usual, and fade where ${they} pull away. Pick a family or a dot on the rim.`}
				right={
					compare ? (
						<button
							type="button"
							role="switch"
							aria-checked={vsOn}
							onClick={toggleVs}
							className={`inline-flex min-h-11 items-center gap-3 rounded-full py-1 pr-4 pl-1.5 text-sm font-bold ring-1 transition-colors ${vsOn ? "bg-white text-gray-950 ring-white" : "bg-white/[0.04] text-gray-200 ring-white/20 hover:ring-white/40"}`}
						>
							<span
								className={`relative h-6 w-11 rounded-full transition-colors ${vsOn ? "bg-gray-950" : "bg-white/15"}`}
								aria-hidden
							>
								<span
									className={`absolute top-1 left-1 size-4 rounded-full transition-transform duration-300 ${vsOn ? "translate-x-5 bg-white" : "bg-gray-300"}`}
								/>
							</span>
							Vs me
						</button>
					) : undefined
				}
			/>
			<div
				className={`${PANEL} grid gap-6 overflow-hidden p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]`}
			>
				{/* One square stage either way, so the switch never moves the layout. */}
				<div className="relative mx-auto aspect-square w-full max-w-[30rem]">
					<Whorl
						attributes={taste.attributes}
						family={family}
						selected={vs ? (hover ?? key) : key}
						onFamily={(id) => pickFamily(family === id ? null : id)}
						onAttribute={pickAttribute}
						markers={!vs}
						className="w-full"
						label={`Fingerprint of @${handle}: ${owner ? taste.line : theirLine(taste.line)}`}
					/>
					{compare && (
						<RimTracks
							vs={vs}
							attributes={taste.attributes}
							yours={yours}
							family={family}
							selected={key}
							hover={hover}
							onHover={setHover}
							onPick={pickAttribute}
							handle={handle}
							still={still}
						/>
					)}
				</div>
				<div className="flex min-w-0 flex-col gap-4">
					<div
						className="flex flex-wrap gap-1.5"
						// biome-ignore lint/a11y/useSemanticElements: a labelled group of toggle buttons
						role="group"
						aria-label="Families"
					>
						<FamilyButton
							on={!family && view === "top"}
							onClick={() => pickFamily(null)}
							color={vs ? "#ffffff" : "#f59e0b"}
						>
							{vs ? "Biggest gaps" : "Strongest"}
						</FamilyButton>
						{vs && (
							<FamilyButton
								on={!family && view === "common"}
								onClick={() => pickFamily(null, "common")}
								color="#ffffff"
							>
								In common
							</FamilyButton>
						)}
						{FAMILY_ORDER.map((id) => (
							<FamilyButton
								key={id}
								on={family === id}
								onClick={() => pickFamily(id)}
								color={FAMILY_COLOR[id]}
							>
								{FAMILY_NAMES[id].name}
							</FamilyButton>
						))}
					</div>
					<p className="-mt-1 text-xs text-gray-500">
						{family
							? FAMILY_NAMES[family].line
							: vs
								? view === "common"
									? "What pulls you both, strongest shared pull first."
									: `Where your print and @${handle}'s part most. Colour is theirs, white is yours.`
								: `The worded attributes that set @${handle} apart most, either way.`}
					</p>
					<ul
						ref={listRef}
						className="relative h-56 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]"
					>
						{rows.map((a) => (
							<li key={a.key}>
								<button
									type="button"
									onClick={() => setKey(a.key)}
									aria-pressed={a.key === key}
									data-key={a.key}
									onMouseEnter={() => setHover(a.key)}
									onMouseLeave={() => setHover(null)}
									onFocus={() => setHover(a.key)}
									onBlur={() => setHover(null)}
									className={`grid w-full grid-cols-[7.5rem_1fr_2.5rem] items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm sm:grid-cols-[10rem_1fr_2.75rem] ${a.key === key ? "bg-white/10" : a.key === hover ? "bg-white/[0.07] ring-1 ring-white/25" : "hover:bg-white/5"}`}
								>
									<span className="truncate text-gray-200">
										<span aria-hidden className="mr-1">
											{a.emoji}
										</span>
										{a.label}
									</span>
									<span className="flex flex-col gap-1" aria-hidden>
										<Bar
											edge={a.edge}
											max={max}
											color={FAMILY_COLOR[a.family]}
										/>
										{/* Always drawn, so turning Vs me on grows it instead of shifting the rows. */}
										<span
											className={`transition-opacity duration-300 ${vs ? "opacity-100" : "opacity-0"}`}
										>
											<Bar
												edge={vs ? yours(a.key) : 0}
												max={max}
												color="#ffffff"
												thin
											/>
										</span>
									</span>
									<span
										className={`text-right text-xs font-bold tabular-nums ${a.edge > 0 ? "text-gray-200" : "text-gray-500"}`}
									>
										{vs ? `${Math.round(gap(a) * 10) / 10}` : signed(a.edge)}
									</span>
								</button>
							</li>
						))}
					</ul>
					{vs ? (
						<VsDetail a={picked} mine={you?.yourEdges[picked.key] ?? null} />
					) : (
						<Detail a={picked} />
					)}
				</div>
			</div>
		</section>
	)
}

/** A bar from the centre line, right when sought and left when avoided; it grows with transform only. */
function Bar({
	edge,
	max,
	color,
	thin = false,
}: { edge: number; max: number; color: string; thin?: boolean }) {
	const size = Math.min(1, Math.abs(edge) / max)
	return (
		<span
			className={`relative block overflow-hidden rounded-full bg-white/[0.06] ${thin ? "h-1.5" : "h-2.5"}`}
		>
			<span className="absolute inset-y-0 left-1/2 z-10 w-px bg-white/25" />
			<span
				className={`absolute inset-y-0 w-1/2 rounded-full transition-transform duration-500 ease-out ${edge >= 0 ? "left-1/2 origin-left" : "right-1/2 origin-right"}`}
				style={{
					background: color,
					opacity: edge > 0 ? 1 : 0.55,
					transform: `scaleX(${size})`,
				}}
			/>
		</span>
	)
}

function FamilyButton({
	on,
	onClick,
	color,
	children,
}: { on: boolean; onClick: () => void; color: string; children: string }) {
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={onClick}
			className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-bold ring-1 transition-colors ${on ? "bg-white/10 text-white ring-white/40" : "text-gray-400 ring-white/10 hover:text-white"}`}
		>
			<span
				aria-hidden
				className="size-2.5 rounded-full"
				style={{ background: color }}
			/>
			{children}
		</button>
	)
}

/** One attribute, always the same height. */
function Detail({ a }: { a: TasteAttribute }) {
	const { owner, title: tt } = useTaste()
	const titles = (
		a.edge >= 0 ? a.carriers : a.against.length ? a.against : a.carriers
	)
		.slice(0, 6)
		.map(tt)
	const exception = a.exception ? tt(a.exception) : null
	const your = owner ? "your" : "their"
	return (
		<div
			className="flex h-[19rem] flex-col gap-3 overflow-hidden rounded-xl bg-gray-950/60 p-4 ring-1 ring-white/10 [&>*]:shrink-0"
			aria-live="polite"
		>
			<DetailHead a={a}>
				<span
					className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${tierTone(a.tier)}`}
				>
					{(owner ? TIER_NAMES : TIER_NAMES_THEY)[a.tier]}
				</span>
			</DetailHead>
			<p className="truncate text-sm text-gray-400">{a.meaning}</p>
			<dl className="grid grid-cols-3 gap-2 text-center">
				<Stat label={`of ${your} titles`} value={pct(a.share)} />
				<Stat label="of everyone's" value={pct(a.everyoneShare)} />
				<Stat
					label={`vs ${your} usual`}
					value={a.lift == null ? "–" : signed(a.lift)}
					tone={a.lift == null ? 0 : a.lift}
				/>
			</dl>
			<div className="min-h-0">
				<p className="mb-1.5 text-xs text-gray-500">
					{a.edge >= 0
						? `Carry it for ${owner ? "you" : "them"}`
						: "Strong in it, scored lowest"}
				</p>
				<ul className="flex gap-2">
					{titles.map((t) => (
						<li key={t.key} className="w-11 sm:w-12">
							<MiniPoster title={t} />
						</li>
					))}
				</ul>
			</div>
			{exception ? (
				<p className="mt-auto flex items-center gap-2 truncate text-xs text-gray-400">
					<span className="block w-5 shrink-0">
						<PosterImg title={exception} className="rounded-sm" />
					</span>
					<span className="truncate">
						The exception:{" "}
						<Link
							to={exception.href}
							className="font-semibold text-gray-200 hover:text-white"
						>
							{exception.title}
						</Link>
						, scored {exception.score}
					</span>
				</p>
			) : (
				<p className="mt-auto text-xs text-gray-600">
					No exception to {your} usual stance.
				</p>
			)}
		</div>
	)
}

function verdict(t: number, y: number, handle: string) {
	if (t >= 1 && y >= 1) return "You both seek it."
	if (t <= -1 && y <= -1) return "You both steer away from it."
	if (t >= 1) return `It pulls @${handle}, not you.`
	if (y >= 1) return `It pulls you, not @${handle}.`
	if (t <= -1) return `@${handle} pulls away from it; you don't mind it.`
	if (y <= -1) return `You pull away from it; @${handle} doesn't mind it.`
	return "Neither of you cares much either way."
}

/** The same attribute, both stances side by side; same height as Detail. */
function VsDetail({
	a,
	mine,
}: { a: TasteAttribute; mine: { edge: number; tier: number } | null }) {
	const { handle, title: tt, compare } = useTaste()
	const myTier = (mine?.tier ?? 0) as Tier
	const titles = (
		a.edge >= 0 ? a.carriers : a.against.length ? a.against : a.carriers
	)
		.slice(0, 6)
		.map(tt)
	return (
		<div
			className="flex h-[19rem] flex-col gap-3 overflow-hidden rounded-xl bg-gray-950/60 p-4 ring-1 ring-white/10 [&>*]:shrink-0"
			aria-live="polite"
		>
			<DetailHead a={a} />
			<p className="text-base font-bold text-white">
				{verdict(a.tier, myTier, handle)}
			</p>
			<dl className="grid grid-cols-2 gap-2">
				<div className="rounded-lg bg-white/[0.04] px-3 py-2">
					<dt className="text-[11px] font-bold tracking-wide text-amber-300 uppercase">
						@{handle}
					</dt>
					<dd className="mt-1 flex items-center justify-between gap-2">
						<span
							className={`truncate rounded-full px-2 py-0.5 text-xs font-bold ${tierTone(a.tier)}`}
						>
							{TIER_NAMES_THEY[a.tier]}
						</span>
						<span className="text-sm font-black tabular-nums text-white">
							{signed(a.edge)}
						</span>
					</dd>
				</div>
				<div className="rounded-lg bg-white/[0.04] px-3 py-2">
					<dt className="text-[11px] font-bold tracking-wide text-gray-300 uppercase">
						You
					</dt>
					<dd className="mt-1 flex items-center justify-between gap-2">
						<span
							className={`truncate rounded-full px-2 py-0.5 text-xs font-bold ${tierTone(myTier)}`}
						>
							{myTier === 3 ? "Defining" : TIER_NAMES[myTier]}
						</span>
						<span className="text-sm font-black tabular-nums text-white">
							{signed(mine?.edge ?? 0)}
						</span>
					</dd>
				</div>
			</dl>
			<div className="min-h-0">
				<p className="mb-1.5 text-xs text-gray-500">
					{a.edge >= 0
						? `Carry it for @${handle}`
						: `Strong in it, @${handle} scored lowest`}{" "}
					· scores under each: @{handle} left, you right
				</p>
				<ul className="flex gap-1.5 sm:gap-2">
					{titles.map((t) => (
						<li key={t.key} className="w-[2.6rem] shrink-0 sm:w-12">
							<MiniPoster title={t} score={false} />
							<ScorePair
								theirs={t.score}
								yours={compare?.yourScores[t.key]}
								handle={handle}
							/>
						</li>
					))}
				</ul>
			</div>
		</div>
	)
}

function DetailHead({
	a,
	children,
}: { a: TasteAttribute; children?: ReactNode }) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<span className="text-lg font-black text-white">
				<span aria-hidden className="mr-1.5">
					{a.emoji}
				</span>
				{a.label}
			</span>
			{children}
			<span
				className="ml-auto text-xs font-semibold"
				style={{ color: FAMILY_COLOR[a.family] }}
			>
				{FAMILY_NAMES[a.family].name}
			</span>
		</div>
	)
}

function Stat({
	label,
	value,
	tone = 0,
}: { label: string; value: string; tone?: number }) {
	return (
		<div className="rounded-lg bg-white/[0.04] px-2 py-1.5">
			<dd
				className={`text-lg font-black tabular-nums ${tone > 0 ? "text-green-400" : tone < 0 ? "text-rose-400" : "text-white"}`}
			>
				{value}
			</dd>
			<dt className="text-[11px] leading-tight text-gray-500">{label}</dt>
		</div>
	)
}
