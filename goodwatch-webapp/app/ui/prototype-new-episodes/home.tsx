// PROTOTYPE - throwaway. A member's home on the TV for /prototype/new-episodes: the three doors as they are built
// (ui/living-room/HomeDoors.tsx, copied), and on the Continue door, which opens My shows, the signal that something
// new aired. The door keeps what it shows today: the show the member watched last.
import { activityWords, episodeCode } from "~/domain/my-shows"
import {
	MOVIE_POSTERS,
	type Planned,
	STARTS,
	type SignalWords,
	evening,
} from "./model"

const image = (path: string, size: string) =>
	`https://image.tmdb.org/t/p/${size}${path}`

export type DoorKey = "continue" | "start" | "movie"

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

function Door({
	id,
	phone,
	focus,
	setFocus,
	open,
	backdrop,
	posters,
	eyebrow,
	title,
	line,
	sub,
	signal,
}: {
	id: DoorKey
	phone: boolean
	focus: DoorKey
	setFocus: (id: DoorKey) => void
	open: () => void
	backdrop?: string
	posters?: string[]
	eyebrow: string
	title: string
	line: string
	sub?: string
	/** The words of the signal; null when nothing is new. */
	signal?: string | null
}) {
	const focused = focus === id
	return (
		<button
			type="button"
			data-door={id}
			onClick={open}
			onMouseEnter={() => setFocus(id)}
			className={`relative min-w-0 cursor-pointer overflow-hidden text-left ring-2 transition-[transform,background-color,box-shadow] duration-200 ${focused ? "bg-white/[0.10] ring-amber-300" : "bg-white/[0.04] ring-white/5"} ${focused ? (phone ? "scale-[1.03]" : "scale-[1.025]") : ""} ${phone ? "rounded-2xl !ring-4" : "h-[300px] rounded-3xl"}`}
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
			{signal && (
				<span
					data-door-signal
					className={`absolute flex items-center gap-1.5 whitespace-nowrap rounded-full bg-sky-400 font-black text-black shadow-lg ${phone ? "left-2 top-2 px-2.5 py-0.5 text-[17px]" : "left-4 top-4 px-3 py-1 text-[13.5px]"}`}
				>
					{signal}
				</span>
			)}
			<span
				className={`absolute inset-0 flex flex-col justify-end ${phone ? "p-3" : "p-6"}`}
			>
				{!phone && (
					<span className="block truncate text-[12px] font-bold uppercase tracking-[0.22em] text-amber-300/90">
						{eyebrow}
					</span>
				)}
				<span
					className={`block font-extrabold leading-none ${phone ? "text-[23px]" : "mt-1.5 text-[30px]"}`}
				>
					{title}
				</span>
				<span
					className={`block truncate text-white/85 ${phone ? "mt-1 text-[18px] leading-tight" : "mt-2 text-[16px] font-semibold"}`}
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

/** What the Continue door shows: the first row of the Continue list. */
export function continueDoorOf(plan: Planned, today: string) {
	const first = plan.continue[0]
	if (!first) return null
	const next = first.facts.next
	return {
		title: first.show.title,
		backdrop: first.show.backdrop,
		episode: next ? episodeCode(next) : null,
		episodeName: next?.name ?? null,
		fact:
			first.row.kind === "seenNew"
				? `${first.row.left} new since you saw it`
				: activityWords(first.row.lastActivityAt, evening(today)),
		more: plan.continue.length - 1,
	}
}

export function HomeScreen({
	plan,
	today,
	words,
	focus,
	setFocus,
	open,
	phone = false,
}: {
	plan: Planned
	today: string
	words: SignalWords | null
	focus: DoorKey
	setFocus: (id: DoorKey) => void
	open: (id: DoorKey) => void
	phone?: boolean
}) {
	const next = continueDoorOf(plan, today)
	const door = { phone, focus, setFocus }
	const somethingNew = (
		<span
			className={`rounded-full font-bold text-white/85 ${phone ? "px-3 py-0.5 text-[18px]" : "px-2.5 py-0.5"}`}
		>
			Something new ›
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
						Nothing in mind? {somethingNew}
					</div>
				</div>
			)}
			<div
				className={`absolute grid grid-cols-3 ${phone ? "inset-x-5 bottom-[52px] top-[58px] gap-3" : "inset-x-12 top-[132px] gap-5"}`}
			>
				{next && (
					<Door
						{...door}
						id="continue"
						open={() => open("continue")}
						backdrop={next.backdrop}
						eyebrow={next.fact}
						title="Continue"
						line={
							next.episode
								? phone
									? `${next.episode} · ${next.title}`
									: `${next.title} · ${next.episode}`
								: next.title
						}
						sub={[
							next.episodeName,
							next.more > 0 ? `and ${next.more} more` : null,
						]
							.filter(Boolean)
							.join(" · ")}
						signal={words ? (phone ? words.short : words.long) : null}
					/>
				)}
				<Door
					{...door}
					id="start"
					open={() => open("start")}
					posters={STARTS.map((s) => s.poster)}
					eyebrow={`${STARTS.length} shows to start`}
					title={phone ? "New show" : "Start a show"}
					line={phone ? `${STARTS.length} to start` : STARTS[0].title}
					sub="Best taste match first"
				/>
				<Door
					{...door}
					id="movie"
					open={() => open("movie")}
					posters={MOVIE_POSTERS}
					eyebrow="17 movies to see"
					title="A movie"
					line={phone ? "17 movies" : "Dune: Part Two"}
					sub="2h 47m · on Netflix"
				/>
			</div>
			{phone && (
				<div className="absolute inset-x-5 bottom-2.5 flex items-center gap-2 text-[18px] text-white/60">
					Nothing in mind? {somethingNew}
				</div>
			)}
		</div>
	)
}
