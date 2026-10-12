// PROTOTYPE - throwaway. The Want to See list of My library for /prototype/arrival-mark: the list as it is built
// (ui/my-library/MyLibraryPage.tsx, copied, not imported), with what each variation adds. The status switch, the
// kind filter and the search are drawn and do nothing.
import {
	ChevronDownIcon,
	ChevronRightIcon,
	MagnifyingGlassIcon,
} from "@heroicons/react/20/solid"
import { MY_MOVIES, MY_SHOWS, PageHead, Poster, WRAP } from "~/ui/my-pages/bits"
import { TITLES, type Title, addedWords, lineOf } from "./model"
import {
	Chip,
	type Ctx,
	DotD,
	LineC,
	LogRow,
	SortSelect,
	StickerB,
	TagA,
	opens,
} from "./parts"

function Row({ title, ctx }: { title: Title; ctx: Ctx }) {
	const { variant } = ctx
	const mark = ctx.marks.get(title.key)
	const added = addedWords(title.added + ctx.day)
	// C: the landing is the row's fact while it is fresh, and follows the day it was added after.
	const fact =
		mark && variant === "C" ? (
			mark.state === "fresh" ? (
				<LineC mark={mark} />
			) : (
				`${added} · ${lineOf(mark)}`
			)
		) : (
			added
		)
	return (
		<li
			className="flex items-center gap-2 border-b border-white/5"
			data-item={title.key}
		>
			<a
				href="#title"
				{...opens(ctx, title.key)}
				className="group flex min-w-0 flex-1 items-center gap-3 py-2 hover:bg-white/[0.03]"
			>
				<span className="relative shrink-0">
					<Poster path={title.poster} className="h-[60px] w-10 rounded" />
					{mark && variant === "B" && (
						<StickerB
							mark={mark}
							small
							className="absolute -left-1.5 -top-1.5"
						/>
					)}
				</span>
				<span className="min-w-0 flex-1">
					<span className="flex min-w-0 items-center gap-2">
						{mark && variant === "D" && <DotD mark={mark} />}
						<b className="truncate text-sm text-white group-hover:text-amber-200 md:text-base">
							{title.title}
						</b>
						{mark && variant === "A" && (
							<span className="hidden shrink-0 sm:block">
								<TagA mark={mark} />
							</span>
						)}
					</span>
					<span className="block truncate text-xs text-gray-500">
						{title.kind === "show" ? "Show" : "Movie"} · {title.year}
					</span>
					{mark && variant === "A" && (
						<span className="mt-0.5 block sm:hidden">
							<TagA mark={mark} />
						</span>
					)}
					<span className="block truncate text-xs text-gray-400 sm:hidden">
						{fact}
					</span>
				</span>
				<span className="hidden w-64 shrink-0 truncate text-xs text-gray-300 sm:block">
					{fact}
				</span>
				<ChevronRightIcon
					className="h-4 w-4 shrink-0 text-gray-600 group-hover:text-amber-300"
					aria-hidden
				/>
			</a>
		</li>
	)
}

export function LibraryPage({ ctx }: { ctx: Ctx }) {
	const { variant, marks } = ctx
	const lastAdded = [...TITLES].sort((a, b) => a.added - b.added)
	const landed = [...marks.values()].map((mark) => mark.title)
	const items =
		variant === "B" && ctx.only
			? landed
			: variant === "C" && ctx.sort === "arrived"
				? [...landed, ...lastAdded.filter((title) => !landed.includes(title))]
				: lastAdded
	const movies = TITLES.filter((title) => title.kind === "movie").length
	const pill = "rounded-full px-1.5 py-0.5 text-xs tabular-nums"
	return (
		<div className="overflow-x-clip pb-40" data-my-library>
			<PageHead
				name="My library"
				line="Every title you have marked, by where you stand with it. Picking one for tonight happens in My shows and My movies."
				links={[
					{ label: "My shows", to: MY_SHOWS },
					{ label: "My movies", to: MY_MOVIES },
				]}
			/>
			<div className={`${WRAP} flex flex-col gap-3`}>
				<div className="flex items-center gap-2">
					<div className="flex min-w-0 flex-1 gap-1 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10 sm:flex-none">
						<span className="flex h-11 min-w-0 flex-auto items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-amber-400 px-2.5 text-sm font-bold text-black sm:flex-none sm:px-5 sm:text-base">
							Want to see
							<span className={`${pill} bg-black/15`}>{TITLES.length}</span>
						</span>
						<span className="flex h-11 min-w-0 flex-auto items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-sm font-bold text-gray-300 sm:flex-none sm:px-5 sm:text-base">
							Seen
							<span className={`${pill} bg-white/10`}>34</span>
						</span>
					</div>
					<span className="flex h-[52px] shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] px-3.5 text-sm font-bold text-gray-200 ring-1 ring-white/10 sm:px-4 sm:text-base">
						More
						<ChevronDownIcon className="h-4 w-4" aria-hidden />
					</span>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<div className="inline-flex max-w-full gap-1 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10">
						{(
							[
								["All", TITLES.length],
								["Movies", movies],
								["Shows", TITLES.length - movies],
							] as [string, number][]
						).map(([label, n], i) => (
							<span
								key={label}
								className={`flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-bold ${i === 0 ? "bg-white text-black" : "text-gray-300"}`}
							>
								{label}
								<span
									className={`text-xs tabular-nums ${i === 0 ? "text-black/60" : "text-gray-400"}`}
								>
									{n}
								</span>
							</span>
						))}
					</div>
					{variant === "B" && <Chip ctx={ctx} kind={null} />}
					<span className="relative flex h-11 min-w-0 flex-1 basis-44 items-center rounded-xl bg-white/[0.06] pl-8 text-sm text-gray-500 ring-1 ring-white/10 sm:max-w-xs">
						<MagnifyingGlassIcon
							className="absolute left-2.5 h-4 w-4 text-gray-400"
							aria-hidden
						/>
						Search want to see
					</span>
					<span className="hidden grow sm:block" />
					{variant === "C" ? (
						<SortSelect ctx={ctx} library />
					) : (
						<span className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-white/[0.06] px-3 text-sm font-bold text-gray-100 ring-1 ring-white/10">
							Last added
							<ChevronDownIcon className="h-4 w-4 text-gray-400" aria-hidden />
						</span>
					)}
				</div>
				{variant === "D" && <LogRow ctx={ctx} kind={null} />}
				<p className="text-xs text-gray-400">
					{items.length} {items.length === 1 ? "title" : "titles"}
					{ctx.only && variant === "B" ? " new on your services" : ""}
				</p>
				<ul>
					{items.map((title) => (
						<Row key={title.key} title={title} ctx={ctx} />
					))}
				</ul>
			</div>
		</div>
	)
}
