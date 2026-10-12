// PROTOTYPE - throwaway (issue #489, part B: picks). A member's home on the TV, four times: the doors as they are
// built (ui/living-room/HomeDoors.tsx, copied), and each variation's way of saying that a title landed.
//   A  the door's own line names it          B  one wide door takes tonight
//   C  the pill is the reason                D  the doors stay, a row lists what landed
import type { ReactNode } from "react"
import {
	type Arrival,
	type Decision,
	type DoorKey,
	type Lead,
	MOVIE_COUNT,
	type Pill,
	SOMETHING_NEW,
	START_COUNT,
	duration,
	fanOf,
	reasonOf,
} from "./model"

const image = (path: string, size: string) =>
	`https://image.tmdb.org/t/p/${size}${path}`

export interface Home {
	decision: Decision
	phone?: boolean
	focus: string
	setFocus: (id: string) => void
	open: (id: string) => void
}

function Fan({ posters, phone }: { posters: string[]; phone: boolean }) {
	return (
		<span
			className={`pointer-events-none absolute flex ${phone ? "-right-2 top-2 -space-x-9" : "-right-3 top-5 -space-x-12"}`}
		>
			{posters.slice(0, 3).map((path, i) => (
				<span
					key={path}
					className="block"
					style={{ transform: `rotate(${(i - 1) * 6}deg)` }}
				>
					<img
						src={image(path, phone ? "w92" : "w185")}
						alt=""
						className="rounded-lg object-cover shadow-2xl ring-1 ring-white/10"
						style={
							phone ? { width: 64, height: 96 } : { width: 104, height: 156 }
						}
					/>
				</span>
			))}
		</span>
	)
}

/** The sky blue pill of #456; `quiet` is its outlined form (C, after the page was opened). */
function SkyPill({ pill, phone }: { pill: Pill; phone: boolean }) {
	return (
		<span
			data-door-signal
			className={`absolute max-w-[calc(100%-16px)] truncate rounded-full font-black shadow-lg ${pill.quiet ? "bg-[#0b0c10]/75 text-sky-300 ring-2 ring-inset ring-sky-400/80" : "bg-sky-400 text-black"} ${phone ? "left-2 top-2 px-2.5 py-0.5 text-[17px]" : "left-4 top-4 px-3 py-1 text-[13.5px]"}`}
		>
			{phone ? pill.short : pill.long}
		</span>
	)
}

function Door({
	id,
	home,
	backdrop,
	posters,
	eyebrow,
	title,
	line,
	sub,
	pill,
	className = "",
}: {
	id: string
	home: Home
	backdrop?: string
	posters?: string[]
	eyebrow: ReactNode
	title: string
	line: ReactNode
	sub?: ReactNode
	pill?: Pill | null
	className?: string
}) {
	const phone = Boolean(home.phone)
	const focused = home.focus === id
	return (
		<button
			type="button"
			data-door={id}
			onClick={() => home.open(id)}
			onMouseEnter={() => home.setFocus(id)}
			className={`relative min-w-0 cursor-pointer overflow-hidden text-left ring-2 transition-[transform,background-color,box-shadow] duration-200 ${focused ? "bg-white/[0.10] ring-amber-300" : "bg-white/[0.04] ring-white/5"} ${focused ? (phone ? "scale-[1.03]" : "scale-[1.025]") : ""} ${phone ? "rounded-2xl !ring-4" : "h-[300px] rounded-3xl"} ${className}`}
		>
			{backdrop && (
				<img
					src={image(backdrop, "w780")}
					alt=""
					className="absolute inset-0 h-full w-full object-cover opacity-60"
				/>
			)}
			{posters && <Fan posters={posters} phone={phone} />}
			<span
				className={`absolute inset-0 ${backdrop ? "bg-gradient-to-t from-[#0b0c10] via-[#0b0c10]/70 to-transparent" : "bg-gradient-to-tr from-[#0b0c10] via-[#0b0c10]/85 to-transparent"}`}
			/>
			{pill && <SkyPill pill={pill} phone={phone} />}
			<span
				className={`absolute inset-0 flex flex-col justify-end ${phone ? "p-3" : "p-6"}`}
			>
				{!phone && (
					<span className="block truncate text-[12px] font-bold uppercase tracking-[0.22em] text-amber-300/90">
						{eyebrow}
					</span>
				)}
				<span
					className={`block truncate font-extrabold leading-none ${phone ? "pb-0.5 text-[23px]" : "mt-1.5 pb-1 text-[30px]"}`}
				>
					{title}
				</span>
				<span
					className={`block truncate text-white/85 ${phone ? "mt-0.5 text-[18px] leading-tight" : "mt-1 text-[16px] font-semibold"}`}
				>
					{line}
				</span>
				{!phone && sub && (
					<span className="mt-0.5 block truncate text-[13.5px] text-white/55">
						{sub}
					</span>
				)}
			</span>
		</button>
	)
}

const Sky = ({ children }: { children: ReactNode }) => (
	<span className="font-bold text-sky-300">{children}</span>
)

/** What each door shows for its lead, as the built doors do. A variation changes parts of it. */
function doorProps(door: DoorKey, lead: Lead, phone: boolean) {
	if (door === "continue")
		return {
			id: "continue",
			backdrop: lead.title.backdrop,
			eyebrow: lead.fact ?? "",
			title: "Continue",
			line: phone
				? `${lead.episode?.code} · ${lead.title.title}`
				: `${lead.title.title} · ${lead.episode?.code}`,
			sub: `${lead.episode?.name} · and 2 more` as ReactNode,
		}
	if (door === "start") {
		const count = START_COUNT(lead)
		return {
			id: "start",
			posters: fanOf("start", lead),
			eyebrow: `${count} shows to start`,
			title: phone ? "New show" : "Start a show",
			line: (phone ? `${count} to start` : lead.title.title) as ReactNode,
			sub: "Best taste match first" as ReactNode,
		}
	}
	return {
		id: "movie",
		posters: fanOf("movie", lead),
		eyebrow: `${MOVIE_COUNT} movies to see`,
		title: "A movie",
		line: (phone ? `${MOVIE_COUNT} movies` : lead.title.title) as ReactNode,
		sub: [
			lead.title.runtime ? duration(lead.title.runtime) : null,
			lead.service ? `on ${lead.service}` : null,
		]
			.filter(Boolean)
			.join(" · ") as ReactNode,
	}
}

const somethingNew = (home: Home) => (
	<Door
		id="something-new"
		home={home}
		posters={SOMETHING_NEW}
		eyebrow="Not seen yet"
		title="Something new"
		line={home.phone ? "Your taste" : "Closest to your taste"}
	/>
)

/** The TV's home screen around the doors: the title, its line, and the two keys in the corner. */
function Screen({
	home,
	columns = "grid-cols-3",
	bottom,
	children,
}: {
	home: Home
	columns?: string
	/** What stands under the doors in place of "Nothing in mind?". */
	bottom?: ReactNode
	children: ReactNode
}) {
	const phone = Boolean(home.phone)
	const three = Boolean(home.decision.doors.continue)
	const key = (
		<span
			className={`rounded-full font-bold text-white/85 ${phone ? "px-3 py-0.5 text-[18px]" : "px-2.5 py-0.5"}`}
		>
			Something new ›
		</span>
	)
	const nothingInMind = three ? <>Nothing in mind? {key}</> : null
	const keys = (
		<span
			className={`absolute flex ${phone ? "right-4 top-3 gap-2" : "right-10 top-8 gap-2.5"}`}
		>
			{["⌕", "···"].map((glyph) => (
				<span
					key={glyph}
					className={`flex items-center justify-center rounded-full bg-black/60 text-white/70 ring-1 ring-white/15 ${phone ? "h-10 w-10 text-[18px]" : "h-9 w-9 text-[13px]"}`}
				>
					{glyph}
				</span>
			))}
		</span>
	)
	return (
		<div className="absolute inset-0 text-white">
			<div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_30%_0%,#2b1706_0%,#08070a_62%)]" />
			{phone ? (
				<div className="absolute left-5 right-[110px] top-3">
					<h2 className="truncate text-[26px] font-extrabold leading-tight tracking-tight">
						What are we watching?
					</h2>
				</div>
			) : (
				<div className="absolute left-12 right-44 top-9">
					<div className="text-[34px] font-extrabold leading-none tracking-tight">
						What are we watching?
					</div>
					<div className="mt-2 text-[15px] text-white/60">
						{nothingInMind ?? "Everything else is in the menu, top right."}
					</div>
				</div>
			)}
			{keys}
			<div
				data-home-doors
				className={`absolute grid ${columns} ${phone ? `inset-x-5 top-[58px] gap-3 ${bottom || three ? "bottom-[52px]" : "bottom-4"}` : "inset-x-12 top-[132px] gap-5"}`}
			>
				{children}
			</div>
			{phone
				? (bottom ?? nothingInMind) && (
						<div className="absolute inset-x-5 bottom-2.5 flex items-center gap-2 truncate text-[18px] text-white/60">
							{bottom ?? nothingInMind}
						</div>
					)
				: bottom}
		</div>
	)
}

const DOORS = ["continue", "start", "movie"] as const

// ---------------------------------------------------------------------------------------------------------
// A. The door names it: the landed title leads its own door, and the door's line says why, in sky blue.

export function VariantA(home: Home) {
	const { doors, pills } = home.decision
	const phone = Boolean(home.phone)
	return (
		<Screen home={home}>
			{DOORS.map((door) => {
				const lead = doors[door]
				if (!lead) return null
				const props = doorProps(door, lead, phone)
				const reason = lead.arrival && reasonOf("A", lead.arrival).long
				return (
					<Door
						key={door}
						home={home}
						{...props}
						pill={pills[door]}
						line={phone && reason ? <Sky>{reason}</Sky> : props.line}
						sub={
							reason ? (
								<>
									<Sky>{reason}</Sky>
									{lead.title.runtime && ` · ${duration(lead.title.runtime)}`}
								</>
							) : (
								props.sub
							)
						}
					/>
				)
			})}
			{!doors.continue && somethingNew(home)}
		</Screen>
	)
}

// ---------------------------------------------------------------------------------------------------------
// B. It takes tonight: the landed title is the first door, wide, with its own name and backdrop.

function WideDoor({
	home,
	door,
	lead,
	arrival,
}: { home: Home; door: DoorKey; lead: Lead; arrival: Arrival }) {
	const phone = Boolean(home.phone)
	const focused = home.focus === door
	const reason = reasonOf("B", arrival)
	const where =
		door === "continue"
			? `Continue · ${lead.episode?.code} · ${lead.episode?.name}`
			: door === "start"
				? "A show to start"
				: `A movie${lead.title.runtime ? ` · ${duration(lead.title.runtime)}` : ""}`
	const more = lead.more.length
	return (
		<button
			type="button"
			data-door={door}
			data-wide-door
			onClick={() => home.open(door)}
			onMouseEnter={() => home.setFocus(door)}
			className={`relative min-w-0 cursor-pointer overflow-hidden text-left ring-2 transition-[transform,box-shadow] duration-200 ${focused ? "ring-amber-300" : "ring-sky-400/60"} ${focused ? "scale-[1.02]" : ""} ${phone ? "rounded-2xl !ring-4" : "h-[300px] rounded-3xl"}`}
		>
			<img
				src={image(lead.title.backdrop, "w780")}
				alt=""
				className="absolute inset-0 h-full w-full object-cover"
			/>
			<span className="absolute inset-0 bg-gradient-to-t from-[#0b0c10] via-[#0b0c10]/65 to-[#0b0c10]/10" />
			<span
				className={`absolute rounded-full bg-black/70 font-bold text-amber-300 ring-1 ring-amber-300/60 ${phone ? "left-2 top-2 px-2.5 py-0.5 text-[17px]" : "left-4 top-4 px-3 py-1 text-[13px]"}`}
			>
				Tonight's pick
			</span>
			<span
				className={`absolute inset-0 flex flex-col justify-end ${phone ? "p-3" : "p-6"}`}
			>
				<span
					className={`block font-black text-sky-300 ${phone ? "text-[18px] leading-tight" : "truncate text-[15px]"}`}
				>
					{phone ? reason.short : reason.long}
				</span>
				<span
					className={`block truncate font-extrabold leading-none ${phone ? "mt-0.5 pb-0.5 text-[23px]" : "mt-1.5 pb-1 text-[34px]"}`}
				>
					{lead.title.title}
				</span>
				{!phone && (
					<span className="mt-1 block truncate text-[16px] font-semibold text-white/85">
						{where}
					</span>
				)}
				{more > 0 && (
					<span
						className={`block truncate text-white/60 ${phone ? "text-[18px] leading-tight" : "mt-0.5 text-[13.5px]"}`}
					>
						and {more} more just landed
					</span>
				)}
			</span>
		</button>
	)
}

export function VariantB(home: Home) {
	const { doors, pills, hero } = home.decision
	const phone = Boolean(home.phone)
	const wide = hero && doors[hero]
	const rest = DOORS.filter((door) => door !== hero)
	return (
		<Screen
			home={home}
			columns={
				wide && doors.continue
					? "grid-cols-[1.7fr_1fr_1fr]"
					: wide
						? "grid-cols-[1.4fr_1fr_1fr]"
						: "grid-cols-3"
			}
		>
			{hero && wide?.arrival && (
				<WideDoor home={home} door={hero} lead={wide} arrival={wide.arrival} />
			)}
			{rest.map((door) => {
				const lead = doors[door]
				return (
					lead && (
						<Door
							key={door}
							home={home}
							{...doorProps(door, lead, phone)}
							pill={pills[door]}
						/>
					)
				)
			})}
			{!doors.continue && somethingNew(home)}
		</Screen>
	)
}

// ---------------------------------------------------------------------------------------------------------
// C. A bonus that fades: the doors stay as built and the pill is the reason, worded by the landing's age.

export function VariantC(home: Home) {
	const { doors, pills } = home.decision
	const phone = Boolean(home.phone)
	return (
		<Screen home={home}>
			{DOORS.map((door) => {
				const lead = doors[door]
				if (!lead) return null
				const props = doorProps(door, lead, phone)
				return (
					<Door
						key={door}
						home={home}
						{...props}
						pill={pills[door]}
						// The pill names the service; the line below does not say it again.
						sub={
							lead.arrival && door === "movie" && lead.title.runtime
								? duration(lead.title.runtime)
								: props.sub
						}
					/>
				)
			})}
			{!doors.continue && somethingNew(home)}
		</Screen>
	)
}

// ---------------------------------------------------------------------------------------------------------
// D. A row of its own: nothing is preferred. Under the doors the TV lists what landed, newest first.

function LandedRow({ home }: { home: Home }) {
	const { row } = home.decision
	if (!row.length) return null
	if (home.phone) {
		const [first, ...rest] = row
		return (
			<span data-landed-row className="flex min-w-0 items-center gap-2">
				<span className="shrink-0 font-black text-sky-300">Just landed</span>
				<span className="truncate font-bold text-white/90">
					{first.title.title}
				</span>
				<span className="shrink-0">{first.service}</span>
				{rest.length > 0 && (
					<span className="shrink-0 font-bold text-white/85">
						+{rest.length} ›
					</span>
				)}
			</span>
		)
	}
	const shown = row.slice(0, 3)
	return (
		<div
			data-landed-row
			className="absolute inset-x-12 top-[446px] flex items-center gap-3"
		>
			<span className="w-[92px] shrink-0 text-[12px] font-bold uppercase leading-snug tracking-[0.2em] text-sky-300">
				Just landed
			</span>
			{shown.map((arrival) => (
				<button
					type="button"
					key={arrival.title.id}
					onClick={() => home.open(`title:${arrival.title.id}`)}
					className={`flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-2xl bg-white/[0.05] py-1.5 pl-1.5 pr-3 text-left ring-1 ring-white/10 hover:bg-white/[0.1] ${arrival.days > 7 ? "opacity-60" : ""}`}
				>
					<img
						src={image(arrival.title.poster, "w92")}
						alt=""
						className="h-[60px] w-10 shrink-0 rounded-md object-cover"
					/>
					<span className="min-w-0">
						<span className="flex items-center gap-1.5">
							{arrival.unseen && (
								<span className="h-2 w-2 shrink-0 rounded-full bg-sky-400" />
							)}
							<span className="truncate text-[16.5px] font-bold">
								{arrival.title.title}
							</span>
						</span>
						<span className="block truncate text-[13.5px] text-white/60">
							{reasonOf("D", arrival).long}
						</span>
					</span>
				</button>
			))}
			{row.length > shown.length && (
				<span className="shrink-0 text-[14px] font-bold text-white/70">
					+{row.length - shown.length} ›
				</span>
			)}
		</div>
	)
}

export function VariantD(home: Home) {
	const { doors, pills, row } = home.decision
	const phone = Boolean(home.phone)
	return (
		<Screen
			home={home}
			bottom={row.length ? <LandedRow home={home} /> : undefined}
		>
			{DOORS.map((door) => {
				const lead = doors[door]
				return (
					lead && (
						<Door
							key={door}
							home={home}
							{...doorProps(door, lead, phone)}
							pill={pills[door]}
						/>
					)
				)
			})}
			{!doors.continue && somethingNew(home)}
		</Screen>
	)
}

export const SCREENS = { A: VariantA, B: VariantB, C: VariantC, D: VariantD }
