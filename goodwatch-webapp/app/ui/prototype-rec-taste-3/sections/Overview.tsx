// PROTOTYPE - throwaway. Overview: who you are as a viewer in two lines and your canon at a glance, then one
// card per section to step into. The portrait lives here, small, instead of taking over the page.
import { itemsOf, backdrop, Frame, Plain, useGo, type View3Props } from "../kit3"
import { SECTION_META, sectionTitles } from "../meta"

export default function Overview({ data }: View3Props) {
	const r = data.report
	const go = useGo()
	const titles = sectionTitles(data)
	const canon = itemsOf(
		data,
		r.canon.slice(0, 5).map((c) => c.key),
	)
	const a = r.sides.find((s) => s.id === r.contradiction?.a)
	const b = r.sides.find((s) => s.id === r.contradiction?.b)
	return (
		<Frame>
			<div className="grid items-center gap-10 md:grid-cols-[1.15fr_1fr]">
				<div className="min-w-0">
					<p className="text-gray-400">
						{r.who.mode === "me"
							? `From your ${r.who.rated} ratings`
							: `From the demo member's ${r.who.rated} ratings`}
					</p>
					<h1 className="mt-2 text-4xl font-bold leading-tight md:text-5xl">
						{r.archetype.name}
					</h1>
					<p className="mt-3 max-w-xl text-lg text-gray-300">
						{r.archetype.line}
					</p>
					{a && b && (
						<p className="mt-6 max-w-xl text-gray-400">
							You love{" "}
							<span className="font-semibold text-amber-300">
								{a.name.toLowerCase()}
							</span>{" "}
							and also{" "}
							<span className="font-semibold text-sky-300">
								{b.name.toLowerCase()}
							</span>
							.
						</p>
					)}
				</div>
				{canon.length > 0 && (
					<div className="flex justify-center md:justify-end">
						{canon.map((t, i) => (
							<Plain
								key={t.key}
								t={t}
								size="w185"
								className="-ml-6 w-20 shrink-0 rounded-md shadow-2xl ring-2 ring-gray-950 first:ml-0 sm:w-24 md:-ml-8 md:w-28"
							/>
						))}
					</div>
				)}
			</div>

			<div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{SECTION_META.filter((s) => s.id !== "overview").map((s) => {
					const t = titles[s.id]
					return (
						<button
							key={s.id}
							type="button"
							onClick={() => go(s.id)}
							className="group relative isolate flex min-h-40 flex-col justify-end overflow-hidden rounded-xl border border-white/10 p-5 text-left transition hover:border-white/30 md:min-h-48"
						>
							{t && (
								<img
									src={backdrop(t, "w780")}
									alt=""
									className="absolute inset-0 -z-10 h-full w-full object-cover opacity-45 transition group-hover:opacity-65"
									loading="lazy"
								/>
							)}
							<span className="absolute inset-0 -z-10 bg-linear-to-t from-gray-950 via-gray-950/60 to-transparent" />
							<span className="text-xl font-bold">{s.label}</span>
							<span className="mt-1 text-sm text-gray-300">
								{s.teaser(data)}
							</span>
						</button>
					)
				})}
			</div>
		</Frame>
	)
}
