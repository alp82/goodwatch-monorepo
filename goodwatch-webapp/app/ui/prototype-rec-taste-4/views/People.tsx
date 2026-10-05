// PROTOTYPE - throwaway. Third-view candidate "Your people" (existing components): the directors and actors
// you keep coming back to. The hero is the one you return to most; below, pick anyone to see how you
// rated their work and what of theirs you haven't seen.
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { Portrait } from "~/ui/person/Portrait"
import {
	PickRow,
	RatedPoster,
	ServicesSwitch,
	YourScore,
	itemsOf,
	useOnMine,
} from "~/ui/prototype-rec-taste-2/kit"
import type { Payload4, Person } from "../model"
import { Fan, Pill } from "../parts"

const ROLES = [
	{ id: "director", name: "Directors" },
	{ id: "actor", name: "Actors" },
] as const

export default function People({ data }: { data: Payload4 }) {
	const all = data.extra.people
	const [role, setRole] = useState<Person["role"]>("director")
	const people = all.filter((p) => p.role === role)
	const [name, setName] = useState<string | undefined>(all[0]?.name)
	const services = useOnMine(data)
	const hero = all[0]
	const person = people.find((p) => p.name === name) ?? people[0]
	if (!hero || !person)
		return (
			<p className="mx-auto max-w-7xl px-4 py-16 text-lg text-gray-300 md:px-8">
				Rate a few more titles by the same people to see who you keep coming
				back to.
			</p>
		)

	return (
		<div className="pb-32 text-white">
			<section className="relative overflow-hidden border-b border-gray-800 bg-gray-950">
				<div className="mx-auto grid max-w-7xl items-center gap-6 px-4 py-10 md:grid-cols-[1fr_1.3fr_1fr] md:gap-8 md:px-8 md:py-16">
					<button
						type="button"
						onClick={() => {
							setRole(hero.role)
							setName(hero.name)
						}}
						className="mx-auto block w-32 -rotate-3 overflow-hidden rounded-lg border-4 border-gray-800 shadow-2xl md:w-48"
						aria-label={`Open ${hero.name}`}
					>
						<Portrait
							path={hero.portrait}
							name={hero.name}
							className="aspect-[2/3] w-full"
						/>
					</button>
					<div className="text-center">
						<p className="text-sm text-gray-400">
							The {hero.role} you trust most
						</p>
						<h1 className="mt-3 text-3xl font-bold leading-tight md:text-5xl">
							You keep coming back to{" "}
							<span className="text-amber-300">{hero.name}</span>
						</h1>
						<p className="mx-auto mt-5 max-w-md text-gray-400">
							You've rated {hero.count} of their titles and gave them{" "}
							{hero.avg.toFixed(1)} on average, against your usual{" "}
							{data.report.who.avg}.
						</p>
					</div>
					<Fan
						items={itemsOf(data, hero.keys)}
						dir={1}
						label={`What you rated by ${hero.name}`}
						onPick={() => {
							setRole(hero.role)
							setName(hero.name)
						}}
					/>
				</div>
			</section>

			<section className="mx-auto mt-12 max-w-7xl px-4 md:px-8">
				<div className="flex flex-wrap items-end justify-between gap-4">
					<div>
						<h2 className="text-2xl font-bold md:text-3xl">Your people</h2>
						<p className="mt-1 text-gray-400">
							The names behind the most titles you rate highly.
						</p>
					</div>
					<div className="flex gap-2">
						{ROLES.map((r) => (
							<Pill
								key={r.id}
								on={role === r.id}
								onClick={() => {
									setRole(r.id)
									setName(all.find((p) => p.role === r.id)?.name)
								}}
							>
								{r.name}
							</Pill>
						))}
					</div>
				</div>
				<div
					className="mt-6 grid grid-cols-3 gap-3 md:grid-cols-6"
					role="tablist"
				>
					{people.map((p) => {
						const on = p.name === person.name
						return (
							<button
								key={p.name}
								type="button"
								role="tab"
								aria-selected={on}
								onClick={() => setName(p.name)}
								className={`overflow-hidden rounded-xl border-2 text-left transition ${on ? "border-amber-500 bg-amber-950/40" : "border-gray-800 bg-gray-950/60 hover:border-gray-600"}`}
							>
								<Portrait
									path={p.portrait}
									name={p.name}
									className="aspect-[4/5] w-full"
								/>
								<span className="block px-3 pt-2 font-bold leading-tight">
									{p.name}
								</span>
								<span className="block px-3 pb-3 pt-1 text-sm text-gray-400">
									{p.count} rated
								</span>
							</button>
						)
					})}
				</div>

				<AnimatePresence mode="wait">
					<motion.div
						key={person.name}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.25 }}
						className="mt-8 grid gap-8 md:grid-cols-[1fr_2fr]"
					>
						<div>
							<p className="text-3xl font-bold">{person.name}</p>
							<div className="mt-3">
								<YourScore
									score={Math.round(person.avg)}
									label={`Your average for their ${person.count} titles: ${person.avg.toFixed(1)}`}
								/>
							</div>
							<div className="mt-5 grid grid-cols-4 gap-2">
								{itemsOf(data, person.keys).map((t) => (
									<RatedPoster key={t.key} t={t} size="w185" />
								))}
							</div>
						</div>
						<div>
							<div className="mb-4 flex flex-wrap items-end justify-between gap-3">
								<h3 className="text-xl font-bold">
									Not seen yet from {person.name}
								</h3>
								<ServicesSwitch state={services} />
							</div>
							<PickRow
								data={data}
								refs={services.filter(person.unseen)}
								n={4}
								cols="grid-cols-2 md:grid-cols-4"
								empty={
									person.unseen.length
										? "Nothing of theirs on your services. Switch to Everywhere."
										: "You've seen everything of theirs we know."
								}
							/>
						</div>
					</motion.div>
				</AnimatePresence>
			</section>
		</div>
	)
}
