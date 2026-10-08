// A member's home with REC_TRACKING (#385): three doors in place of the two tiles. Continue opens My shows, Start a
// show opens it at the Start group, A movie opens My movies. A door with nothing behind it is not drawn, and
// Something new then takes its place as a tile; with all three doors it is a key in the head line.
// This file is a chunk of its own: only a member whose home has doors requests it (see MemberHome in TvScreens.tsx
// and PhoneTvScreens.tsx).
import type { ReactNode } from "react"
import { durationWords } from "~/domain/my-movies"
import { backdropUrl, posterUrl } from "~/ui/watch-next/style"
import { Item, type TvView, memberTiles } from "./TvScreens"
import type { HomeDoors as Doors } from "./living-room-data"

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`

function Fan({
	posters,
	phone,
}: { posters: (string | null)[]; phone: boolean }) {
	return (
		<span
			className={`pointer-events-none absolute flex ${phone ? "-right-2 top-2 -space-x-9" : "-right-3 top-5 -space-x-12"}`}
		>
			{posters.slice(0, 3).map((path, i) =>
				path ? (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: up to three posters in a fixed order
						key={i}
						className="block"
						style={{ transform: `rotate(${(i - 1) * 6}deg)` }}
					>
						<img
							src={posterUrl(path, phone ? "w92" : "w185")}
							alt=""
							className="rounded-lg object-cover shadow-2xl ring-1 ring-white/10"
							style={
								phone ? { width: 64, height: 96 } : { width: 104, height: 156 }
							}
						/>
					</span>
				) : null,
			)}
		</span>
	)
}

function Door({
	view,
	phone,
	id,
	backdrop,
	posters,
	eyebrow,
	title,
	line,
	sub,
}: {
	view: TvView
	phone: boolean
	id: string
	backdrop?: string | null
	posters?: (string | null)[]
	eyebrow: string
	title: string
	line: string
	sub?: string | null
}) {
	return (
		<Item
			view={view}
			id={id}
			grow={phone ? "scale-[1.03]" : "scale-[1.025]"}
			className={`min-w-0 overflow-hidden ${phone ? "rounded-2xl !ring-4" : "h-[300px] rounded-3xl"}`}
		>
			{backdrop && (
				<img
					src={backdropUrl(backdrop, "w780")}
					alt=""
					className="absolute inset-0 h-full w-full object-cover opacity-60"
				/>
			)}
			{posters && <Fan posters={posters} phone={phone} />}
			<span
				className={`absolute inset-0 ${backdrop ? "bg-gradient-to-t from-[#0b0c10] via-[#0b0c10]/70 to-transparent" : "bg-gradient-to-tr from-[#0b0c10] via-[#0b0c10]/85 to-transparent"}`}
			/>
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
		</Item>
	)
}

/** The doors of a member's home, and Something new. `head` draws the screen's title and line in each edition. */
export default function HomeDoors({
	view,
	doors,
	phone = false,
	head,
}: {
	view: TvView
	doors: Doors
	phone?: boolean
	head: (line: ReactNode) => ReactNode
}) {
	const { continue: next, start, movie } = doors
	const three = Boolean(next && start)
	const fresh = memberTiles(view)[1]
	const somethingNew = (
		<Item
			view={view}
			id="something-new"
			grow=""
			on="ring-amber-300 bg-white/10 text-white"
			off="ring-transparent text-white/85"
			className={`rounded-full font-bold ${phone ? "px-3 py-0.5 text-[18px] !ring-4" : "px-2.5 py-0.5"}`}
		>
			Something new ›
		</Item>
	)
	return (
		<>
			{head(
				three && !phone ? (
					<>Nothing in mind? {somethingNew}</>
				) : phone ? null : (
					"Everything else is in the menu, top right."
				),
			)}
			<div
				data-home-doors
				className={`absolute grid ${!next && !start ? "grid-cols-2" : "grid-cols-3"} ${phone ? `inset-x-5 top-[58px] gap-3 ${three ? "bottom-[52px]" : "bottom-4"}` : "inset-x-12 top-[132px] gap-5"}`}
			>
				{next && (
					<Door
						view={view}
						phone={phone}
						id="door:continue"
						backdrop={next.backdrop_path}
						eyebrow={next.episode ? `Next episode · ${next.fact}` : next.fact}
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
					/>
				)}
				{start && (
					<Door
						view={view}
						phone={phone}
						id="door:start"
						posters={start.posters}
						eyebrow={`${plural(start.count, "show")} you want to see`}
						title={phone ? "New show" : "Start a show"}
						line={phone ? `${start.count} to start` : start.title}
						sub="Best taste match first"
					/>
				)}
				<Door
					view={view}
					phone={phone}
					id="door:movie"
					posters={[...movie.posters].reverse()}
					eyebrow={`${plural(movie.count, "movie")} you want to see`}
					title="A movie"
					line={
						phone
							? plural(movie.count, "movie")
							: (movie.title ?? "No movies yet")
					}
					sub={[
						movie.runtime ? durationWords(movie.runtime) : null,
						movie.service ? `on ${movie.service}` : null,
					]
						.filter(Boolean)
						.join(" · ")}
				/>
				{!three && (
					<Door
						view={view}
						phone={phone}
						id="something-new"
						posters={fresh.art.slice(0, 3).map((title) => title.poster_path)}
						eyebrow="Not seen yet"
						title="Something new"
						line={phone ? "Your taste" : "Closest to your taste"}
					/>
				)}
			</div>
			{three && phone && (
				<div className="absolute inset-x-5 bottom-2.5 flex items-center gap-2 text-[18px] text-white/60">
					Nothing in mind? {somethingNew}
				</div>
			)}
		</>
	)
}
