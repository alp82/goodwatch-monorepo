// A trope's page. The header (group, name, + Add, our one-liner, how often it's twisted, what TV Tropes says it is,
// what it plays against, what its titles feel like) and the sticky sidebar (tropes often and rarely seen with it,
// others in its index) frame the casebook of examples. Under them: how it grew decade by decade as a tall row, the
// moods, genres and countries it blends well with (each a real blend page), and the people behind it.
import { Link } from "@remix-run/react"
import { type CSSProperties, useMemo } from "react"
import { type Address, familyPage, ing, kindNoun, place } from "~/domain/browse/address"
import { tropeUrlOf } from "~/domain/tropes/catalog"
import {
	type TropeLink,
	type TropePageData,
	many,
	strongest,
	twistWords,
} from "~/domain/tropes/pages"
import { WRAP, poster } from "~/ui/browse/base"
import { AddEntry } from "~/ui/browse/blend/AddEntry"
import { FOCUS, GLIDE_T, QUICK_T } from "~/ui/browse/motion"
import { PeopleStrip } from "~/ui/browse/People"
import { ModuleHead } from "~/ui/browse/place-parts"
import { TraitWord } from "~/ui/browse/TraitWord"
import { Casebook } from "~/ui/browse/tropes/Casebook"
import { NamePlate, PosterFan, TvTropesCredit } from "~/ui/browse/tropes/parts"
import { SpoilerScope, SpoilerSwitch } from "~/ui/browse/tropes/Spoiler"
import { FlagShape } from "~/ui/browse/world-map/FlagShape"
import { CAPTION } from "~/ui/eyebrow"
import { RowArrows, useStepRow } from "~/ui/row-arrows"

type To = (a: Address, extra?: Record<string, string | undefined>) => string
type Kind = Address["kind"]

function LinkList({
	title,
	items,
	kind,
	to,
}: {
	title: string
	items: TropeLink[]
	kind: Kind
	to: To
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

function Header({ data, address, to }: { data: TropePageData; address: Address; to: To }) {
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
							<AddEntry address={address} to={to} />
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
									href={tropeUrlOf(t.id)}
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
					</aside>
				</div>
			</div>
		</header>
	)
}

function Sidebar({ data, kind, to }: { data: TropePageData; kind: Kind; to: To }) {
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

/** How it grew: one tall column per decade (its share of that decade's titles), with the decade's best-known three. */
function Timeline({ d, kind, to, noun }: { d: TropePageData; kind: Kind; to: To; noun: string }) {
	const row = useStepRow<HTMLOListElement>([d.timeline.length])
	const rows = d.timeline.filter((x) => x.n > 0)
	if (rows.length < 3) return null
	const peak = rows.reduce((a, b) => (b.share > a.share ? b : a), rows[0])
	const barMax = 150
	return (
		<section style={{ "--tint": d.trope.color } as CSSProperties}>
			<ModuleHead
				title="How it grew"
				line={`How common it is among each decade's well-known ${noun}. The ${peak.label} had the most.`}
				aside={<RowArrows row={row} label="decades" />}
			/>
			<ol
				ref={row.ref}
				onScroll={row.measure}
				className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0"
			>
				{rows.map((x) => {
					const on = x === peak
					return (
						<li key={x.slug} className="min-w-[6.5rem] flex-1">
							<Link
								to={to(place(kind, [ing("trope", d.trope.slug), ing("decade", x.slug)]))}
								prefetch="intent"
								className={`group flex h-full flex-col items-center rounded-xl px-2 pt-3 pb-3 ${QUICK_T} hover:bg-white/[0.04] ${FOCUS}`}
							>
								<span
									className={`text-sm font-semibold tabular-nums ${on ? "text-white" : "text-gray-400"}`}
								>
									{many(x.n)}
								</span>
								<span
									className="mt-1.5 flex w-full items-end justify-center"
									style={{ height: barMax }}
								>
									<span
										className={`w-full max-w-12 origin-bottom rounded-t-md ${GLIDE_T} group-hover:scale-y-[1.04]`}
										style={{
											height: Math.max(4, x.share * barMax),
											background: on
												? "var(--tint)"
												: "color-mix(in oklab, var(--tint) 28%, rgba(255,255,255,0.08))",
										}}
									/>
								</span>
								<span className="relative mt-3 flex h-[84px] w-full justify-center">
									{x.titles.slice(0, 3).map((t, i) => {
										const src = poster(t.card.poster_path, "w154")
										return (
											<span
												key={t.card.key}
												className={`absolute top-0 h-[78px] w-[52px] overflow-hidden rounded-md bg-gray-800 shadow-lg ring-1 ring-black/40 ${GLIDE_T}`}
												style={{
													translate: `${(i - 1) * 22}px ${i === 1 ? 0 : 4}px`,
													rotate: `${(i - 1) * 6}deg`,
													zIndex: i === 1 ? 2 : 1,
												}}
											>
												{src && (
													<img
														src={src}
														alt=""
														loading="lazy"
														className="h-full w-full object-cover"
													/>
												)}
											</span>
										)
									})}
								</span>
								<span
									className={`mt-2 text-sm font-bold ${on ? "text-[color-mix(in_oklab,var(--tint)_70%,white)]" : "text-gray-300"}`}
								>
									{x.label}
								</span>
							</Link>
						</li>
					)
				})}
			</ol>
		</section>
	)
}

const FAMILY: Record<string, string> = {
	mood: "Mood",
	genre: "Genre",
	decade: "Decade",
	country: "Country",
}

function Glyph({ s }: { s: TropePageData["ways"][number] }) {
	if (s.place.family === "country" && s.place.code)
		return <FlagShape code={s.place.code} size={20} state="on" />
	return (
		<span
			aria-hidden
			className="h-2.5 w-2.5 shrink-0 rounded-full"
			style={{ background: s.place.hue ?? "rgba(255,255,255,0.35)" }}
		/>
	)
}

/** Where it blends well: each a real blend page (part + this trope), with how many titles and three posters. */
function Ways({ d, kind, to, noun }: { d: TropePageData; kind: Kind; to: To; noun: string }) {
	if (!d.ways.length) return null
	return (
		<section>
			<ModuleHead
				title="Blend it"
				line={`Where it shows up more than usual. Each opens the ${noun} that have both.`}
			/>
			<ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
				{d.ways.map((s) => (
					<li key={`${s.place.family}-${s.place.slug}`}>
						<Link
							to={to(place(kind, [ing(s.place.family, s.place.slug), ing("trope", d.trope.slug)]))}
							prefetch="intent"
							className={`group flex h-full flex-col overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/10 ${GLIDE_T} hover:-translate-y-0.5 hover:bg-white/[0.05] hover:ring-white/20 ${FOCUS}`}
						>
							<span
								className="flex h-28 items-end justify-center overflow-hidden"
								style={{
									background: `radial-gradient(110% 90% at 50% 100%, color-mix(in oklab, ${s.place.hue ?? d.trope.color} 30%, transparent), transparent 72%)`,
								}}
							>
								<PosterFan titles={s.titles} width={58} className="mb-[-18%]" />
							</span>
							<span className="flex flex-1 flex-col p-3.5">
								<span className="text-[11px] font-bold tracking-[0.14em] text-gray-500 uppercase">
									{FAMILY[s.place.family] ?? s.place.family}
								</span>
								<span className="mt-1 flex items-center gap-2 font-semibold text-white">
									<Glyph s={s} />
									<span className="truncate">{s.place.label}</span>
								</span>
								<span className="mt-0.5 text-[13px] text-gray-400">
									+ {d.trope.label} · {many(s.count)} {noun}
								</span>
							</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	)
}

export function TropePage({
	data,
	address,
	to,
}: {
	data: TropePageData
	address: Address
	to: To
}) {
	const cases = useMemo(() => strongest(data.examples), [data])
	const noun = kindNoun(address.kind)
	const kind = address.kind
	return (
		<SpoilerScope>
			<div className="pb-24">
				<Header data={data} address={address} to={to} />
				<div className={`${WRAP} grid gap-10 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12`}>
					<section aria-label="Examples" className="min-w-0">
						<Casebook
							cases={cases}
							noun={noun}
							tint={data.trope.color}
							tools={
								cases.some((e) => e.spoilers.length) ? (
									<SpoilerSwitch tint={data.trope.color} />
								) : undefined
							}
						/>
					</section>
					<Sidebar data={data} kind={kind} to={to} />
				</div>
				<div className={`${WRAP} mt-16 space-y-14`}>
					<Timeline d={data} kind={kind} to={to} noun={noun} />
					<Ways d={data} kind={kind} to={to} noun={noun} />
					{data.people.length > 0 && (
						<PeopleStrip
							people={data.people}
							head={(arrows) => (
								<ModuleHead
									title="Who keeps using it"
									aside={arrows}
									line="The people behind the most of them."
								/>
							)}
						/>
					)}
					<TvTropesCredit
						href={tropeUrlOf(data.trope.id)}
						className="border-t border-white/[0.07] pt-6"
					/>
				</div>
			</div>
		</SpoilerScope>
	)
}
