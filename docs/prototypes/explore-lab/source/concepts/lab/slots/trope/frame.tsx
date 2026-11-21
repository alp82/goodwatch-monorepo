// PROTOTYPE - throwaway (prototype/explore-r8). What every trope page variant shares: the header and the sidebar
// (the owner: "header and sidebar are the better parts") and the order of the strongest examples. Round 9: the body,
// the spoiler treatment and the sections under the page are lab parts of their own (slots trope-body, trope-spoiler,
// trope-below); see parts.tsx.
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import { CAPTION } from "~/ui/eyebrow"
import { type Address, familyPage, ing, kindNoun, place } from "../../../../kit/address"
import { BlendEntry, FOCUS, TraitWord, WRAP } from "../../../../kit/ui"
import { QUICK_T } from "../../../../kit/ui/motion"
import type { PageViewProps } from "../../contract"
import { type Example, type TropeLink, type TropePageData, many, twistWords } from "../tropes/model"
import { NamePlate } from "../tropes/parts"

export type TropeProps = PageViewProps<TropePageData | null>

function LinkList({
	title,
	items,
	kind,
	to,
}: {
	title: string
	items: TropeLink[]
	kind: Address["kind"]
	to: TropeProps["to"]
}) {
	if (!items.length) return null
	return (
		<section>
			<h2 className={CAPTION}>{title}</h2>
			<ul className="mt-2 space-y-0.5">
				{items.map((l) => (
					<li key={l.slug}>
						<Link
							to={to(place(kind, [ing("trope", l.slug)]))}
							prefetch="intent"
							className={`group block rounded-lg px-2 py-1.5 ${QUICK_T} hover:bg-white/[0.05] ${FOCUS}`}
						>
							<span className="flex items-baseline gap-2">
								<span
									aria-hidden
									className="h-2 w-2 shrink-0 rounded-[2px]"
									style={{ background: l.color }}
								/>
								<span className="font-semibold text-gray-100 group-hover:text-white">
									{l.label}
								</span>
							</span>
							<span className="mt-0.5 block pl-4 text-[13px] leading-snug text-gray-500">
								{l.line}
							</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	)
}

/** The decade it's most common in (share of that decade's well-known titles), or null when there's too little. */
export function peakOf(data: TropePageData) {
	const peak = data.decades.reduce((a, b) => (b.share > a.share ? b : a), data.decades[0])
	return !peak || data.decades.every((d) => d.n < 3) ? null : peak
}

/** When it peaked: its share of each decade's well-known titles, as small columns; the peak is named. */
function Decades({ data }: { data: TropePageData }) {
	const peak = peakOf(data)
	if (!peak) return null
	return (
		<section>
			<h2 className={CAPTION}>When it peaked</h2>
			<div
				className="mt-3 flex h-14 items-end gap-1"
				// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a chart of spans, read as one picture
				role="img"
				aria-label={`Most common in the ${peak.label}`}
			>
				{data.decades.map((d) => (
					<span
						key={d.slug}
						className="flex-1 rounded-t-[3px]"
						style={{
							height: `${Math.max(4, d.share * 100)}%`,
							background: d === peak ? data.group.color : "rgba(255,255,255,0.14)",
						}}
					/>
				))}
			</div>
			<div className="mt-1 flex justify-between text-[11px] text-gray-500">
				<span>{data.decades[0]?.label}</span>
				<span className="font-semibold text-gray-300">Most common in the {peak.label}</span>
				<span>{data.decades.at(-1)?.label}</span>
			</div>
		</section>
	)
}

function Header({
	data,
	address,
	to,
	chart,
}: { data: TropePageData; chart: boolean } & Pick<TropeProps, "address" | "to">) {
	const t = data.trope
	const kind = address.kind
	const noun = kindNoun(kind)
	const vs = data.contrast
	return (
		<header
			className="relative isolate overflow-hidden"
			style={{
				background: `radial-gradient(90% 120% at 10% 0%, color-mix(in oklab, ${t.color} 16%, transparent), transparent 70%)`,
			}}
		>
			<div className={`${WRAP} pt-8 pb-8 sm:pt-10 sm:pb-10`}>
				<div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-12">
					<div className="min-w-0">
						<Link
							to={`${to(familyPage(kind, "trope"))}#index-${data.group.id}`}
							className={`inline-flex items-center gap-2 rounded-sm text-xs font-bold tracking-[0.16em] uppercase ${FOCUS}`}
							style={{ color: data.group.color }}
						>
							{data.group.name}
						</Link>
						<div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
							<h1>
								<NamePlate label={t.label} color={t.color} size="lg" />
							</h1>
							<BlendEntry address={address} to={to} />
						</div>
						<p className="mt-4 max-w-xl text-xl leading-snug text-gray-100 sm:text-2xl">{t.line}</p>
						<p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] text-gray-300">
							<span className="font-semibold text-white">
								{many(t.n)} well-known {noun}
							</span>
							<span aria-hidden className="text-gray-600">
								·
							</span>
							<span>{twistWords[data.twist]}</span>
						</p>
						{t.opening && (
							<p className="mt-4 max-w-xl text-[15px] leading-relaxed text-gray-400">
								{t.opening}{" "}
								<a
									href={`https://tvtropes.org/pmwiki/pmwiki.php/Main/${t.id}`}
									target="_blank"
									rel="noreferrer"
									className={`rounded-sm font-semibold whitespace-nowrap text-gray-300 underline decoration-white/20 underline-offset-2 hover:text-white ${FOCUS}`}
								>
									More on TV Tropes<span className="sr-only"> (opens in a new tab)</span>
								</a>
							</p>
						)}
					</div>
					<aside className="flex min-w-0 flex-col gap-6 lg:pt-8">
						{vs && (
							<Link
								to={to(place(kind, [ing("trope", vs.slug)]))}
								prefetch="intent"
								className={`group block rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 ${QUICK_T} hover:bg-white/[0.07] ${FOCUS}`}
							>
								<span className={CAPTION}>Plays against</span>
								<span className="mt-2 flex items-center justify-between gap-3">
									<NamePlate label={vs.label} color={vs.color} size="md" />
									<span
										aria-hidden
										className={`text-xl text-gray-500 ${QUICK_T} group-hover:translate-x-0.5 group-hover:text-white`}
									>
										›
									</span>
								</span>
								<span className="mt-1.5 block pl-4 text-sm text-gray-400">{vs.line}</span>
							</Link>
						)}
						{data.feels.length > 0 && (
							<div>
								<p className={CAPTION}>What these {noun} feel like</p>
								<p className="mt-2 text-lg leading-relaxed text-gray-300">
									{data.feels.map((w, i) => (
										<span key={w.key}>
											{i > 0 && (i === data.feels.length - 1 ? " and " : ", ")}
											<TraitWord trait={w} noun={noun} className="font-semibold" />
										</span>
									))}
								</p>
							</div>
						)}
						{chart && <Decades data={data} />}
					</aside>
				</div>
			</div>
		</header>
	)
}

function Sidebar({
	data,
	kind,
	to,
}: {
	data: TropePageData
	kind: Address["kind"]
	to: TropeProps["to"]
}) {
	return (
		<aside className="space-y-7 lg:sticky lg:top-32 lg:self-start">
			<LinkList title="Often seen with" items={data.travels} kind={kind} to={to} />
			<LinkList title="Rarely seen with" items={data.rarely} kind={kind} to={to} />
			{data.siblings.length > 0 && (
				<section>
					<h2 className={CAPTION}>Also in {data.group.name}</h2>
					<ul className="mt-2 flex flex-wrap gap-1.5">
						{data.siblings.map((s) => (
							<li key={s.slug}>
								<Link
									to={to(place(kind, [ing("trope", s.slug)]))}
									prefetch="intent"
									className={`block rounded-full bg-white/[0.05] px-2.5 py-1 text-sm font-semibold text-gray-300 ring-1 ring-white/10 ${QUICK_T} hover:bg-white/10 hover:text-white ${FOCUS}`}
								>
									{s.label}
								</Link>
							</li>
						))}
					</ul>
				</section>
			)}
		</aside>
	)
}

/** The page around a body: header on top, the body beside the sticky sidebar, the sections under both. */
export function TropeFrame({
	data,
	address,
	to,
	body,
	below,
	chart = true,
}: Pick<TropeProps, "address" | "to"> & {
	data: TropePageData | null
	body: (data: TropePageData) => ReactNode
	below?: (data: TropePageData) => ReactNode
	/** The small "When it peaked" chart in the header; off when the sections below draw the full decade row. */
	chart?: boolean
}) {
	if (!data)
		return (
			<div className={`${WRAP} py-24 text-gray-400`}>This trope has no page for this kind.</div>
		)
	return (
		<div className="pb-24">
			<Header data={data} address={address} to={to} chart={chart} />
			<div className={`${WRAP} grid gap-10 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12`}>
				<section aria-label="Examples" className="min-w-0">
					{body(data)}
				</section>
				<Sidebar data={data} kind={address.kind} to={to} />
			</div>
			{below && <div className={`${WRAP} mt-16`}>{below(data)}</div>}
		</div>
	)
}

// A write-up that opens by naming its own twist ("Subverted.", "Averted;") repeats the twist tag beside it.
const LEAD =
	/^(?:(?:partially|mostly|somewhat|largely|briefly|ultimately) )?(?:double[- ])?(?:subverted|inverted|averted|lampshaded|exaggerated|downplayed|played with|zig-?zagged|deconstructed|discussed)(?:,? (?:then|and|but) (?:\w+ ?){1,2})?(?:[.!;:,]|\s+-)\s+/i

/** The write-up without a leading twist word when the tag already says it; spoiler marks move with the text. */
export function clean(e: Example): Example {
	if (e.play === "straight") return e
	const m = LEAD.exec(e.text)
	if (!m || m[0].length >= e.text.length - 12) return e
	const cut = m[0].length
	const text = e.text.slice(cut)
	return {
		...e,
		text: text[0].toUpperCase() + text.slice(1),
		spoilers: e.spoilers
			.map(([a, b]) => [Math.max(0, a - cut), b - cut] as [number, number])
			.filter(([, b]) => b > 0),
	}
}

/** How many characters of the write-up you can read before showing the spoiler. */
export const visible = (e: Pick<Example, "text" | "spoilers">) =>
	e.text.length - e.spoilers.reduce((n, [a, b]) => n + (b - a), 0)

// Write-ups about a later book, comic, cut scene or the creators' word are about something else than the film.
const ASIDE =
	/\b(expanded universe|legends|\bEU\b|retroactive|novel(?:ization|isation)?|comic|tie-in|word of god|deleted scene|video game|spin-?off)\b/i

/**
 * The examples in the order a reader wants them: well-known titles whose write-up is about the title itself first.
 * A write-up about a tie-in book or comic, a very short one, and a sprawling one count for less; twists count a
 * little more (they're the interesting ones). Final Girl no longer opens on Star Wars' Expanded Universe.
 */
export function strongest(raw: Example[]): Example[] {
	const examples = raw.map(clean)
	const score = (e: Example, i: number) => {
		const votes = e.title.card.goodwatch_overall_score_voting_count ?? 0
		let s = Math.log10(votes + 10) + (examples.length - i) / (examples.length * 4)
		if (ASIDE.test(e.text)) s *= 0.35
		if (e.text.length < 50) s *= 0.6
		// Mostly spoiler: nothing to read until you ask.
		if (visible(e) < 45) s *= 0.4
		if (e.text.length > 520) s *= 0.8
		if (e.play !== "straight") s *= 1.08
		return s
	}
	return examples
		.map((e, i) => ({ e, s: score(e, i) }))
		.sort((a, b) => b.s - a.s)
		.map((x) => x.e)
}
