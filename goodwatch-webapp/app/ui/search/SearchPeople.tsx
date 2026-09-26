// The people a search names, above the title grid. From sm up, a horizontal accordion: every person keeps a fixed
// place as a narrow photo strip, and the open one shows the full photo with a drawer (backdrop, name, known-for
// posters). On phones, one banner with the people as text links below it.
import { Link } from "@remix-run/react"
import { type CSSProperties, useEffect, useState } from "react"
import type {
	CreditScope,
	SearchPerson,
} from "~/server/search-people/people.server"
import { Portrait } from "~/ui/person/Portrait"
import { personPath, titleToDashed } from "~/utils/helpers"

// The accordion shows this many people; phones list all of them.
const ACCORDION_PEOPLE = 6
// Width of a closed person, and of the open person's photo: the full 2:3 portrait at the row's 15rem height.
const CLOSED_WIDTH = "3.5rem"
const PHOTO_WIDTH = "10rem"
const GAP = "0.375rem"

const image = (path: string, size: string) =>
	`https://image.tmdb.org/t/p/${size}${path}`
const backdropOf = (p: SearchPerson) =>
	p.knownFor.find((t) => t.backdrop)?.backdrop ?? null
const noMotion = "motion-reduce:animate-none motion-reduce:transition-none"

function listOfNames(names: string[]) {
	return names.length < 2
		? (names[0] ?? "")
		: `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

// What the title grid shows when this person's name narrowed it.
function ScopeNote({
	person,
	scope,
	allTitlesHref,
}: {
	person: SearchPerson
	scope: CreditScope | null
	allTitlesHref: string
}) {
	if (!scope?.people.some((p) => p.id === person.id)) return null
	return (
		<p className="text-gray-300">
			Showing titles with {listOfNames(scope.people.map((p) => p.name))} that
			match “{scope.text}”.{" "}
			<Link
				to={allTitlesHref}
				preventScrollReset
				className="cursor-pointer text-cyan-300 transition-colors hover:text-cyan-100"
			>
				Search all titles instead
			</Link>
		</p>
	)
}

// Department, name, and "See all titles": one link to the person page.
function NameBlock({
	person,
	size,
}: { person: SearchPerson; size: "large" | "small" }) {
	return (
		<Link
			to={personPath(person.id, person.name)}
			prefetch="intent"
			className="group/name block min-w-0 cursor-pointer rounded focus-visible:outline focus-visible:outline-cyan-300"
		>
			<span className="block text-sm uppercase tracking-[0.2em] text-amber-400">
				{person.department}
			</span>
			<span
				className={`line-clamp-2 block font-black break-words text-gray-100 transition-colors duration-200 group-hover/name:text-white ${size === "large" ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl"}`}
			>
				{person.name}
			</span>
			<span className="mt-1 inline-flex items-center gap-1 text-sm text-cyan-300 transition-colors group-hover/name:text-cyan-200">
				See all titles
				<span
					aria-hidden="true"
					className={`transition-transform duration-200 group-hover/name:translate-x-1 ${noMotion}`}
				>
					→
				</span>
			</span>
		</Link>
	)
}

function KnownFor({ person }: { person: SearchPerson }) {
	return (
		<ul className="flex shrink-0 gap-2">
			{person.knownFor.slice(0, 3).map((t) =>
				t.poster ? (
					<li key={`${t.type}:${t.id}`} className="w-16 lg:w-20 xl:w-24">
						<Link
							to={`/${t.type}/${t.id}-${titleToDashed(t.title)}`}
							prefetch="intent"
							title={t.title}
							className={`block cursor-pointer rounded-md transition duration-200 ease-out hover:-translate-y-1 focus-visible:outline focus-visible:outline-cyan-300 ${noMotion}`}
						>
							<img
								src={image(t.poster, "w300_and_h450_bestv2")}
								alt={t.title}
								className="aspect-[2/3] w-full rounded-md border-2 border-gray-800 object-cover shadow-lg transition-colors duration-200 hover:border-gray-500"
							/>
						</Link>
					</li>
				) : null,
			)}
		</ul>
	)
}

function Backdrop({
	person,
	size,
	className,
}: { person: SearchPerson; size: string; className: string }) {
	const backdrop = backdropOf(person)
	return (
		<>
			{backdrop && (
				<img
					key={backdrop}
					src={image(backdrop, size)}
					alt=""
					className={`absolute inset-y-0 left-0 -z-10 h-full object-cover opacity-30 animate-backdrop-in ${noMotion} ${className}`}
				/>
			)}
			<div
				className={`absolute inset-y-0 left-0 -z-10 bg-linear-to-t from-gray-950 via-gray-950/70 to-transparent ${className}`}
			/>
		</>
	)
}

interface PeopleProps {
	people: SearchPerson[]
	current: SearchPerson
	select: (id: number) => void
	scope: CreditScope | null
	allTitlesHref: string
}

// Opening a person grows their panel in 220 ms. The photo and the drawer have their final size from the start, so
// the panel only reveals them: nothing stretches. A closing panel drops its drawer at once.
function Accordion({
	people,
	current,
	select,
	scope,
	allTitlesHref,
}: PeopleProps) {
	const shown = people.slice(0, ACCORDION_PEOPLE)
	return (
		<ul
			aria-label="People"
			style={
				{
					"--closed-width": CLOSED_WIDTH,
					"--photo-width": PHOTO_WIDTH,
					// The open panel's final width: the row without the closed people and the gaps.
					"--open-width": `calc(100cqw - ${shown.length - 1} * (${CLOSED_WIDTH} + ${GAP}))`,
				} as CSSProperties
			}
			className="@container flex h-60 gap-1.5"
		>
			{shown.map((p) => {
				const open = p.id === current.id
				return (
					<li
						key={p.id}
						className={`group relative isolate min-w-0 shrink-0 basis-(--closed-width) overflow-hidden rounded-xl border bg-gray-900 transition-[flex-grow,border-color] duration-220 ease-out ${noMotion} ${open ? "grow border-gray-800" : "grow-0 border-gray-800/60 hover:border-gray-500"}`}
					>
						{open ? (
							<>
								<Backdrop
									person={p}
									size="w1280"
									className="w-(--open-width) max-w-none"
								/>
								<Link
									to={personPath(p.id, p.name)}
									prefetch="intent"
									tabIndex={-1}
									aria-hidden="true"
									className="absolute inset-y-0 left-0 w-(--photo-width) cursor-pointer"
								>
									<Portrait
										path={p.profile}
										name={p.name}
										className="h-full w-full"
									/>
								</Link>
								<div className="absolute inset-y-0 left-(--photo-width) w-[calc(var(--open-width)-var(--photo-width))]">
									<div
										className={`flex h-full items-end gap-6 p-4 sm:p-6 animate-fade-in ${noMotion}`}
									>
										<div className="min-w-0 flex-1 space-y-2">
											<NameBlock person={p} size="large" />
											<div className="text-sm">
												<ScopeNote
													person={p}
													scope={scope}
													allTitlesHref={allTitlesHref}
												/>
											</div>
										</div>
										<KnownFor person={p} />
									</div>
								</div>
							</>
						) : (
							<button
								type="button"
								aria-label={`Show ${p.name}`}
								onClick={() => select(p.id)}
								className="absolute inset-y-0 left-0 w-(--closed-width) cursor-pointer focus-visible:outline focus-visible:outline-cyan-300"
							>
								<Portrait
									path={p.profile}
									name={p.name}
									className={`absolute inset-0 h-full w-full opacity-50 grayscale transition-[filter,opacity] duration-150 group-hover:opacity-100 group-hover:grayscale-0 ${noMotion}`}
								/>
								<span className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/90 via-black/30 to-transparent" />
								<span className="pointer-events-none absolute inset-x-0 bottom-2 mx-auto rotate-180 text-xs font-semibold text-gray-200 transition-colors [writing-mode:vertical-rl] group-hover:text-white">
									{p.name}
								</span>
							</button>
						)}
					</li>
				)
			})}
		</ul>
	)
}

// Phones: the open person's banner, the others as text links below it.
function Banner({
	people,
	current,
	select,
	scope,
	allTitlesHref,
}: PeopleProps) {
	return (
		<>
			<div className="relative isolate overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
				<Backdrop person={current} size="w780" className="w-full" />
				<div className="flex items-end gap-4 p-3">
					<Link
						to={personPath(current.id, current.name)}
						prefetch="intent"
						tabIndex={-1}
						aria-hidden="true"
						className="block shrink-0 cursor-pointer"
					>
						<Portrait
							path={current.profile}
							name={current.name}
							className="h-36 w-24 rounded-lg shadow-2xl"
						/>
					</Link>
					<div
						key={current.id}
						className={`min-w-0 flex-1 space-y-2 animate-fade-in ${noMotion}`}
					>
						<NameBlock person={current} size="small" />
						<div className="text-xs">
							<ScopeNote
								person={current}
								scope={scope}
								allTitlesHref={allTitlesHref}
							/>
						</div>
					</div>
				</div>
			</div>
			{people.length > 1 && (
				<nav aria-label="People" className="mt-2 text-sm leading-7">
					<span className="mr-1 text-gray-500">People:</span>
					{people.map((p, i) => {
						const open = p.id === current.id
						return (
							<span key={p.id}>
								{i > 0 && <span className="px-1.5 text-gray-600">·</span>}
								<button
									type="button"
									aria-pressed={open}
									onClick={() => select(p.id)}
									className={`cursor-pointer transition-colors ${open ? "font-semibold text-white" : "text-cyan-300 hover:text-cyan-100"}`}
								>
									{p.name}
								</button>
							</span>
						)
					})}
				</nav>
			)}
		</>
	)
}

export function SearchPeople({
	people,
	scope,
	allTitlesHref,
}: {
	people: SearchPerson[]
	scope: CreditScope | null
	allTitlesHref: string
}) {
	const [selected, setSelected] = useState<number | null>(null)
	const key = people.map((p) => p.id).join(",")
	// A new search opens its best match.
	useEffect(() => setSelected(null), [key])
	// Load every person's pictures up front, so switching never shows empty frames.
	useEffect(() => {
		// The accordion from sm (40rem) up; phones show smaller backdrops and no posters.
		const wide = window.matchMedia("(min-width: 40rem)").matches
		for (const p of people) {
			const backdrop = backdropOf(p)
			for (const src of [
				p.profile && image(p.profile, "w300_and_h450_bestv2"),
				backdrop && image(backdrop, wide ? "w1280" : "w780"),
				...(wide ? p.knownFor.slice(0, 3) : []).map(
					(t) => t.poster && image(t.poster, "w300_and_h450_bestv2"),
				),
			])
				if (src) new Image().src = src
		}
	}, [key])
	if (!people.length) return null
	const current = people.find((p) => p.id === selected) ?? people[0]
	const props = { people, current, select: setSelected, scope, allTitlesHref }
	return (
		<section aria-label="People in this search" className="mb-4">
			<div className="max-sm:hidden">
				<Accordion {...props} />
			</div>
			<div className="sm:hidden">
				<Banner {...props} />
			</div>
		</section>
	)
}
