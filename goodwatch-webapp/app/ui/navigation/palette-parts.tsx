// The command palette's pieces, drawn from a Layout (palette-layout.ts): group header rows, rows, the site's poster
// cards, mood chips, a call to action, and the nothing-matched note. Every option is an element of the listbox with
// an id the field points at (aria-activedescendant); focus stays in the field, so options take no focus themselves.
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import {
	FaceSmileIcon,
	ListBulletIcon,
	NewspaperIcon,
	RectangleStackIcon,
	SignalIcon,
	SwatchIcon,
	TagIcon,
} from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import type { CSSProperties, MouseEvent, ReactNode } from "react"
import type { AvatarColor } from "~/domain/profile"
import { type CardTitle, MovieTvCard } from "~/ui/MovieTvCard"
import { AccountAvatar } from "~/ui/account/AccountAvatar"
import { Portrait } from "~/ui/person/Portrait"
import type { PaletteTitle } from "~/utils/command-palette"
import type { SizeRule } from "~/utils/tmdb-image"
import { tmdbImage } from "./bits"
import type {
	Head,
	Icon,
	Layout,
	Option,
	PanelGroupKey,
	Section,
} from "./palette-layout"

/** What the pieces need from the palette: where an option sits in the keyboard order, and the active one. */
export interface Ctx {
	indexOf: (option: Option) => number
	active: number
	optionId: (index: number) => string
	setActive: (index: number) => void
	run: (option: Option) => void
}

/** A plain click runs the option; a modified one opens the link the way the browser does. */
const runOnClick = (option: Option, ctx: Ctx) => (event: MouseEvent) => {
	if (option.href && (event.metaKey || event.ctrlKey || event.shiftKey)) return
	event.preventDefault()
	ctx.run(option)
}

/** The props every option shares. */
function optionProps(option: Option, ctx: Ctx) {
	const index = ctx.indexOf(option)
	const active = index === ctx.active
	return {
		active,
		props: {
			id: ctx.optionId(index),
			role: "option" as const,
			"aria-selected": active,
			tabIndex: -1,
			onMouseMove: () => !active && ctx.setActive(index),
		},
	}
}

/**
 * An option that goes somewhere: a link, so a modified click opens a new tab. A header in the All tab only shows its
 * group's tab, so it has nowhere to link to.
 */
function OptionLink({
	option,
	ctx,
	className,
	activeClassName,
	children,
}: {
	option: Option
	ctx: Ctx
	className: string
	activeClassName: string
	children: ReactNode
}) {
	const { active, props } = optionProps(option, ctx)
	const look = `${className} ${active ? activeClassName : ""}`
	if (!option.href)
		return (
			// The combobox handles the keyboard (Up, Down, Enter from the field); the click is the pointer's way in.
			<div
				{...props}
				onClick={runOnClick(option, ctx)}
				className={`cursor-pointer ${look}`}
			>
				{children}
			</div>
		)
	return (
		<Link
			{...props}
			// biome-ignore lint/a11y/useSemanticElements: an option that is a link (see the listbox in CommandPalette)
			role="option"
			to={option.href}
			onClick={runOnClick(option, ctx)}
			className={look}
		>
			{children}
		</Link>
	)
}

// ---------------------------------------------------------------- header rows

const HEAD_LOOK =
	"flex items-center justify-between gap-2 rounded-lg px-3 pt-2.5 pb-1.5 text-[11px] font-bold tracking-[0.08em] uppercase"

/** "MOVIES ……… All 57 ›": the whole row is the option when it leads somewhere, else the name and the count. */
function HeadRow({ head, ctx }: { head: Head; ctx: Ctx }) {
	if (!head.option)
		return (
			<div className={`${HEAD_LOOK} text-gray-400`}>
				<span className="truncate">{head.label}</span>
				{head.count && (
					<span className="font-semibold tracking-normal text-gray-500 tabular-nums">
						{head.count}
					</span>
				)}
			</div>
		)
	return (
		<OptionLink
			option={head.option}
			ctx={ctx}
			className={`group/head mt-1 text-gray-400 hover:bg-white/[0.05] hover:text-gray-200 ${HEAD_LOOK}`}
			activeClassName="bg-white/[0.08] text-gray-200"
		>
			<span className="truncate">{head.label}</span>
			<span className="shrink-0 font-semibold tracking-normal normal-case text-amber-300/90 tabular-nums group-hover/head:text-amber-200">
				{head.count ? `All ${head.count} ›` : "All ›"}
			</span>
		</OptionLink>
	)
}

// ---------------------------------------------------------------- rows

/** A row's picture when the item brings none: by its group. */
const GROUP_ICON: Partial<Record<PanelGroupKey, Icon>> = {
	tropes: TagIcon,
	moods: FaceSmileIcon,
	genres: SwatchIcon,
	sequels: RectangleStackIcon,
	services: SignalIcon,
	lists: ListBulletIcon,
	blog: NewspaperIcon,
}

const iconOf = (option: Option): Icon | undefined =>
	option.icon ?? (option.group ? GROUP_ICON[option.group] : undefined)

const ROUND = { sm: "h-8 w-8", md: "h-11 w-11" }
const ROUND_PX = { sm: 32, md: 44 }

/** The picture a row carries: a poster, a portrait, a character, a logo, a member's photo, a mood's hue, or an icon. */
function Thumb({ option, size }: { option: Option; size: "sm" | "md" }) {
	const image = option.image
	const round = ROUND[size]
	if (option.characterImage)
		return (
			<img
				src={option.characterImage}
				alt=""
				width={300}
				height={450}
				loading="lazy"
				decoding="async"
				className={`shrink-0 bg-white/10 object-cover object-top ${size === "md" ? "h-[60px] w-10 rounded-md" : "h-[42px] w-7 rounded-[5px]"}`}
			/>
		)
	switch (image?.kind) {
		case "poster":
			return image.path ? (
				<img
					src={tmdbImage(image.path, "w92")}
					alt=""
					loading="lazy"
					className={`shrink-0 object-cover ${size === "md" ? "h-[60px] w-10 rounded-md" : "h-[42px] w-7 rounded-[5px]"}`}
				/>
			) : (
				<span className="h-[42px] w-7 shrink-0 rounded-[5px] bg-white/10" />
			)
		case "portrait":
			return (
				<Portrait
					path={image.path ?? null}
					name={option.label}
					width={44}
					className={`shrink-0 rounded-full !text-sm ${round}`}
				/>
			)
		case "logo":
			return image.path ? (
				<img
					src={tmdbImage(image.path, "w92")}
					alt=""
					loading="lazy"
					className={`shrink-0 rounded-lg object-cover ${round}`}
				/>
			) : (
				<span className={`shrink-0 rounded-lg bg-white/10 ${round}`} />
			)
		case "avatar":
			// The member's picture as the account menu and profile draw it: their photo, else the initial on their colour.
			return (
				<AccountAvatar
					url={image.path ?? null}
					color={(image.hue ?? "amber") as AvatarColor}
					initial={
						image.initial ??
						option.label.replace(/^@/, "").slice(0, 1).toUpperCase()
					}
					size={ROUND_PX[size]}
				/>
			)
		case "hue":
			return (
				<span
					className={`flex shrink-0 items-center justify-center ${size === "sm" ? "w-7" : round}`}
				>
					<span
						className="h-3 w-3 rounded-full"
						style={{ backgroundColor: image.hue }}
					/>
				</span>
			)
	}
	const Icon = iconOf(option)
	return (
		<span
			className={`flex shrink-0 items-center justify-center ${size === "sm" ? "w-7" : round}`}
		>
			{Icon ? (
				<Icon
					className={`text-amber-400 ${size === "md" ? "h-6 w-6" : "h-[18px] w-[18px]"}`}
					aria-hidden
				/>
			) : (
				<span className="text-[15px] font-bold text-gray-500">#</span>
			)}
		</span>
	)
}

function Row({
	option,
	ctx,
	big,
	compact,
}: { option: Option; ctx: Ctx; big?: boolean; compact?: boolean }) {
	return (
		<OptionLink
			option={option}
			ctx={ctx}
			className={`flex min-w-0 shrink-0 items-center rounded-xl px-3 text-left ${compact ? "min-h-[38px] gap-2.5 py-1 text-gray-300" : "min-h-[50px] gap-3 py-1.5 text-gray-100"}`}
			activeClassName="bg-white/[0.08]"
		>
			<Thumb option={option} size={big ? "md" : "sm"} />
			<span className="flex min-w-0 flex-1 flex-col">
				<b
					className={`truncate ${compact ? "text-[13.5px] font-semibold" : "text-[15px]"}`}
				>
					{option.label}
				</b>
				{option.sub && (
					<small
						className={`truncate text-gray-400 ${compact ? "text-[11.5px]" : "text-[12.5px]"}`}
					>
						{option.sub}
					</small>
				)}
			</span>
		</OptionLink>
	)
}

// ---------------------------------------------------------------- poster cards

/** The card's drawn width: a sixth of the results on desktop, a fixed slide on phones. */
const CARD_SIZES: SizeRule[] = [
	["(min-width: 1024px)", "120px"],
	[null, "104px"],
]

const cardOf = (title: PaletteTitle): CardTitle => ({
	tmdb_id: title.tmdbId,
	title: title.title,
	release_year: title.year || null,
	poster_path: title.posterPath,
	goodwatch_overall_score_normalized_percent: title.score ?? null,
	canonical_title: title.canonical_title,
	presentation: title.presentation,
})

/** One poster card as an option; the active one gets the amber ring the shelves use. Opening it closes the panel. */
function Card({ option, ctx }: { option: Option; ctx: Ctx }) {
	const { active, props } = optionProps(option, ctx)
	const title = option.title
	if (!title) return null
	return (
		<div {...props} className="relative min-w-0">
			<MovieTvCard
				details={cardOf(title)}
				mediaType={title.mediaType}
				posterSizes={CARD_SIZES}
				onOpen={() => ctx.run(option)}
			/>
			<span
				aria-hidden
				className={`pointer-events-none absolute -inset-1 rounded-xl ring-2 ring-amber-400 transition-opacity duration-150 ${active ? "opacity-100" : "opacity-0"}`}
			/>
		</div>
	)
}

/** Cards `cols` across on desktop; on phones one scrolling row, or 3 across when `wrap`. */
function Cards({
	items,
	ctx,
	cols,
	wrap,
}: { items: Option[]; ctx: Ctx; cols: number; wrap?: boolean }) {
	return (
		<div
			className={`gap-2.5 px-1 pt-1 pb-2 lg:grid lg:gap-3 lg:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))] ${wrap ? "grid grid-cols-3" : "flex overflow-x-auto lg:overflow-visible"}`}
			style={{ "--cols": cols } as CSSProperties}
		>
			{items.map((option) => (
				<div
					key={option.key}
					className={wrap ? "min-w-0" : "w-[104px] shrink-0 lg:w-auto"}
				>
					<Card option={option} ctx={ctx} />
				</div>
			))}
		</div>
	)
}

// ---------------------------------------------------------------- chips, calls to action, notes

function Chip({ option, ctx }: { option: Option; ctx: Ctx }) {
	return (
		<OptionLink
			option={option}
			ctx={ctx}
			className="flex h-9 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] pr-3.5 pl-3 text-[13px] font-semibold whitespace-nowrap text-gray-200 hover:border-white/20"
			activeClassName="border-amber-400/70 bg-white/[0.1] text-white"
		>
			{option.image?.kind === "hue" && (
				<span
					aria-hidden
					className="h-2.5 w-2.5 rounded-full"
					style={{ backgroundColor: option.image.hue }}
				/>
			)}
			{option.label}
		</OptionLink>
	)
}

/** One line: a sentence and its button, the button as the option. */
function CtaLine({
	text,
	option,
	ctx,
}: { text: string; option: Option; ctx: Ctx }) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg px-3 pt-3 pb-2 text-[13.5px] text-gray-300">
			<span>{text}</span>
			<OptionLink
				option={option}
				ctx={ctx}
				className="rounded-full px-3 py-1 text-[13px] font-bold whitespace-nowrap text-amber-300 hover:bg-white/[0.06] hover:text-amber-200"
				activeClassName="bg-white/[0.08] text-amber-200"
			>
				{option.label} ›
			</OptionLink>
		</div>
	)
}

/** The Search key as the field shows it, for the sentences that name it. */
export const SearchKey = () => (
	<kbd className="rounded-md bg-amber-400 px-1.5 py-0.5 font-sans text-xs font-semibold text-gray-950">
		Search ↵
	</kbd>
)

function Nothing({ q, short }: { q: string; short: boolean }) {
	return (
		<div className="flex flex-col items-center gap-2 px-6 pt-8 pb-5 text-center">
			<span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06]">
				<MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden />
			</span>
			<b className="text-[17px] text-white">
				{short
					? "Keep typing to find titles, people, and pages"
					: `No title, person, or page is called “${q}”`}
			</b>
			<p className="max-w-[440px] text-[13.5px] text-gray-400">
				Discover also reads plots, moods, and descriptions. Press <SearchKey />{" "}
				to search there, or start from a mood.
			</p>
		</div>
	)
}

// ---------------------------------------------------------------- sections and layouts

function SectionView({ section, ctx }: { section: Section; ctx: Ctx }) {
	switch (section.kind) {
		case "note":
			return (
				<p className="px-3 pt-4 text-[13px] text-gray-500">{section.text}</p>
			)
		case "nothing":
			return <Nothing q={section.q} short={section.short} />
		case "cta":
			return <CtaLine text={section.text} option={section.option} ctx={ctx} />
	}
	const body =
		section.kind === "cards" ? (
			<Cards
				items={section.items}
				ctx={ctx}
				cols={section.cols}
				wrap={section.wrap}
			/>
		) : section.kind === "chips" ? (
			<div className="flex flex-wrap gap-1.5 px-2 pt-0.5 pb-1">
				{section.items.map((option) => (
					<Chip key={option.key} option={option} ctx={ctx} />
				))}
			</div>
		) : (
			<div className={`grid gap-0.5 ${section.split ? "lg:grid-cols-2" : ""}`}>
				{section.items.map((option) => (
					<Row
						key={option.key}
						option={option}
						ctx={ctx}
						big={section.big}
						compact={section.compact}
					/>
				))}
			</div>
		)
	return (
		// biome-ignore lint/a11y/useSemanticElements: a group of options inside the listbox; <fieldset> is for forms
		<div
			role="group"
			aria-label={section.head.label}
			className="flex min-w-0 flex-col gap-0.5"
		>
			<HeadRow head={section.head} ctx={ctx} />
			{body}
		</div>
	)
}

export function LayoutView({ layout, ctx }: { layout: Layout; ctx: Ctx }) {
	return (
		<>
			{layout.top.map((section) => (
				<SectionView key={section.key} section={section} ctx={ctx} />
			))}
			{layout.columns && (
				<div className="grid gap-x-4 lg:grid-cols-2">
					{layout.columns.map((column, index) => (
						<div
							key={index === 0 ? "left" : "right"}
							className="flex min-w-0 flex-col"
						>
							{column.map((section) => (
								<SectionView key={section.key} section={section} ctx={ctx} />
							))}
						</div>
					))}
				</div>
			)}
		</>
	)
}
