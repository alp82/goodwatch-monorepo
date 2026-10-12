// PROTOTYPE - throwaway. A title page for /prototype/arrival-mark. Only the where-to-watch block is the real one's
// (ui/details/hero/WhereToWatch.tsx, copied, not imported): the hero around it is a sketch that gives it a place.
import {
	AdjustmentsHorizontalIcon,
	BookmarkIcon,
} from "@heroicons/react/24/solid"
import { DISPLAY, WRAP, tmdbImage } from "~/ui/my-pages/bits"
import {
	MINE,
	type Mark,
	SERVICES,
	type ServiceKey,
	type Title,
	addedWords,
	ageWords,
	dayMonth,
	logoUrl,
	runtimeWords,
	serviceNames,
} from "./model"
import type { Ctx } from "./parts"

function WhereToWatch({
	title,
	mark,
	ctx,
}: { title: Title; mark?: Mark; ctx: Ctx }) {
	const { variant } = ctx
	const owned = title.on.filter((s) => MINE.includes(s))
	// A service of someone else's, so that the block has what it usually has: yours first, then the others.
	const services: ServiceKey[] = [
		...owned,
		...title.on.filter((s) => !MINE.includes(s)),
		...(title.on.includes("prime") ? [] : (["prime"] as ServiceKey[])),
	]
	return (
		<div
			data-where-to-watch
			className="@container relative min-w-0 rounded-2xl bg-stone-950/70 p-4 ring-1 ring-white/10"
		>
			{mark && variant === "D" && (
				<p
					data-mark="banner"
					className="-mx-4 -mt-4 mb-3 flex items-center gap-2 rounded-t-2xl bg-sky-400/15 px-4 py-2 text-sm text-sky-100"
				>
					<span className="h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400" />
					<span>
						<b className="font-bold">New on your services</b> since{" "}
						{mark.age < 2 ? ageWords(mark.age) : dayMonth(mark.day)}
					</span>
				</p>
			)}
			<div className="flex min-w-0 items-center justify-end gap-1.5">
				<h2 className="mr-auto min-w-0 truncate text-sm font-semibold text-white">
					<span className="@[30rem]:hidden">Watch</span>
					<span className="hidden @[30rem]:inline">Where to watch</span>
				</h2>
				<div className="flex shrink-0 rounded-full bg-white/8 p-0.5 text-[11px] sm:text-xs">
					{["Stream", "Rent", "Buy", "Free"].map((tab, i) => (
						<span
							key={tab}
							className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-1 @[24rem]:gap-1 @[24rem]:px-2 ${i === 0 ? "bg-white font-semibold text-black" : i < 3 ? "text-gray-300" : "text-gray-500"}`}
						>
							{tab}
							{i < 3 && (
								<span
									className={`min-w-3.5 rounded-full px-0.5 text-center text-[10px] font-bold leading-4 tabular-nums @[24rem]:min-w-4 @[24rem]:px-1 ${i === 0 ? "bg-black/10 text-black" : "bg-white/10 text-gray-200"}`}
								>
									{i === 0 ? services.length : 4}
								</span>
							)}
						</span>
					))}
				</div>
				<span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-1.5 text-xs text-gray-300">
					US
					<AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
				</span>
			</div>
			{mark && variant === "C" && (
				<p
					data-mark={mark.state === "quiet" ? "line-quiet" : "line"}
					className={`mt-2.5 text-sm ${mark.state === "quiet" ? "text-gray-400" : "text-sky-200"}`}
				>
					<b className="font-semibold">
						On {serviceNames(mark.on)} since {dayMonth(mark.day)}
					</b>
					{mark.state === "fresh" ? `, ${ageWords(mark.age)}` : ""}. You added
					it {addedWords(title.added + ctx.day).slice(6)}.
				</p>
			)}
			<div className="mt-2.5 grid grid-cols-2 gap-2 pt-0.5">
				{services.map((service, i) => {
					const mineToo = MINE.includes(service)
					const fresh = Boolean(mark?.on.includes(service))
					const whole = i === services.length - 1 && services.length % 2 === 1
					const sky = fresh && variant === "B"
					return (
						<span
							key={service}
							data-provider={service}
							className={`relative flex h-12 min-w-0 items-center gap-2.5 rounded-xl bg-white/[0.06] pr-2.5 ${whole ? "col-span-2" : ""} ${sky ? "ring-2 ring-sky-400" : mineToo ? "ring-2 ring-green-500" : "ring-1 ring-white/10"}`}
						>
							<img
								src={logoUrl(service)}
								alt=""
								className="h-12 w-12 shrink-0 rounded-xl"
							/>
							<span className="min-w-0">
								<span className="block truncate text-sm font-medium leading-tight text-white">
									{SERVICES[service].name}
								</span>
								{fresh && mark && variant === "A" && (
									<span
										data-mark="tag"
										className="block truncate text-xs font-bold leading-tight text-sky-300"
									>
										New · {ageWords(mark.age)}
									</span>
								)}
							</span>
							{fresh && variant === "D" && (
								<span className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400" />
							)}
							{whole && (
								<span
									className={`ml-auto shrink-0 text-xs ${mineToo ? "font-semibold text-green-300" : "text-gray-400"}`}
								>
									{mineToo ? "On your services" : "Stream"}
								</span>
							)}
							{sky && (
								<span
									data-mark="sticker"
									className="absolute -left-1 -top-2 rounded-full bg-sky-400 px-1.5 py-0.5 text-[9px] font-black uppercase leading-none text-black ring-2 ring-stone-950"
								>
									New
								</span>
							)}
							{mineToo && (
								<span
									className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] font-black text-black ring-2 ring-stone-950"
									aria-hidden="true"
								>
									✓
								</span>
							)}
						</span>
					)
				})}
			</div>
			<p className="mt-2 px-1 text-xs text-gray-400">
				Also streaming in{" "}
				<span className="font-semibold text-gray-200">23 other countries</span>
			</p>
		</div>
	)
}

export function TitlePage({ title, ctx }: { title: Title; ctx: Ctx }) {
	const mark = ctx.marks.get(title.key)
	return (
		<div className="relative isolate overflow-x-clip pb-40" data-title-page>
			<img
				src={tmdbImage(title.backdrop, "w1280")}
				alt=""
				className="absolute inset-x-0 top-0 -z-10 h-[30rem] w-full object-cover object-[center_20%] opacity-50"
			/>
			<div className="absolute inset-x-0 top-0 -z-10 h-[30rem] bg-linear-to-t from-gray-900 via-gray-900/70 to-gray-900/30" />
			<div
				className={`${WRAP} grid gap-6 pt-10 md:grid-cols-[14rem_1fr_24rem] md:gap-8 md:pt-16`}
			>
				<img
					src={tmdbImage(title.poster, "w342")}
					alt=""
					className="aspect-[2/3] w-32 rounded-lg object-cover shadow-2xl shadow-black/60 ring-1 ring-white/10 md:w-56"
				/>
				<div className="min-w-0">
					<h1
						className={`${DISPLAY} text-4xl leading-none text-white md:text-6xl`}
					>
						{title.title}
					</h1>
					<p className="mt-2 text-sm text-gray-300">
						{title.year}
						{title.runtime ? `, ${runtimeWords(title.runtime)}` : ", Show"},{" "}
						{title.match}% taste match, GoodWatch score {title.score}
					</p>
					<span className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-amber-400 px-4 text-sm font-bold text-black">
						<BookmarkIcon className="h-4 w-4" aria-hidden />
						Want to See
					</span>
				</div>
				<WhereToWatch title={title} mark={mark} ctx={ctx} />
			</div>
		</div>
	)
}
