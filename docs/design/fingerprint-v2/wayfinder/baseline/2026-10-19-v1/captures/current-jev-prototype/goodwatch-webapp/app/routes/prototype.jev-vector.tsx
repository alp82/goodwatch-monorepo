// PROTOTYPE - throwaway. See app/server/prototype-jev-vector.server.ts.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { Form, useLoaderData, useNavigation } from "@remix-run/react"
import { useState } from "react"
import { type Result, type VectorComparison, runVectorComparison } from "~/server/prototype-jev-vector.server"

export const loader = async ({ request }: LoaderFunctionArgs) => {
	const params = new URL(request.url).searchParams
	const q = params.get("q")?.trim() ?? ""
	if (!q) return json({ comparison: null, error: null })
	try {
		const comparison = await runVectorComparison(q, {
			pool: params.get("pool") === "300" ? 300 : 2000,
			tropes: params.get("tropes") === "off" ? "off" : params.get("tropes") === "always" ? "always" : "auto",
		})
		return json({ comparison, error: null })
	} catch (error) {
		return json({ comparison: null, error: String(error) })
	}
}

const EXAMPLES = [
	"tense but not bleak",
	"something strange and dreamlike",
	"clever dialogue, little action",
	"unreliable narrator",
	"heist that goes wrong",
	"enemies to lovers, funny",
	"cozy mystery for a rainy sunday with my parents",
	"not funny, not scifi, not fantasy, anime",
]

const usd = (value: number) => `$${value.toFixed(4)}`

const Poster = ({ result }: { result: Result }) => {
	const [open, setOpen] = useState(false)
	if (!result.poster_path) return null
	return (
		<>
			{open && (
				<button
					type="button"
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-zoom-out"
					onClick={() => setOpen(false)}
				>
					<img
						src={`https://image.tmdb.org/t/p/w780${result.poster_path}`}
						alt={`Poster of ${result.title}. Click to close.`}
						className="max-h-[92vh] max-w-[92vw] rounded shadow-2xl"
					/>
				</button>
			)}
			<button type="button" className="shrink-0 self-start cursor-zoom-in" onClick={() => setOpen(true)}>
				<img
					src={`https://image.tmdb.org/t/p/w92${result.poster_path}`}
					alt={`Poster of ${result.title}. Click to enlarge.`}
					className="w-8 h-12 object-cover rounded"
				/>
			</button>
		</>
	)
}

const Card = ({
	result,
	order,
	hovered,
	setHovered,
	columns,
	total,
}: {
	result: Result
	order: "weighted_sum" | "cosine"
	hovered: string | null
	setHovered: (id: string | null) => void
	// Number of strategy columns that contain this title
	columns: number
	total: number
}) => {
	const [open, setOpen] = useState(false)
	const id = `${result.media_type}:${result.tmdb_id}`
	return (
		<li
			onMouseEnter={() => setHovered(id)}
			onMouseLeave={() => setHovered(null)}
			className={`border rounded p-2 text-xs ${
				hovered === id ? "border-amber-400 bg-amber-950 ring-1 ring-amber-400" : "border-slate-700 bg-slate-900"
			}`}
		>
			<div className="flex gap-2">
				<Poster result={result} />
				<div className="flex-1 min-w-0">
					<div className="font-semibold text-sm truncate" title={result.title}>
						{result.rank}. {result.title}
					</div>
					<div className="text-slate-500">in {columns} of {total} columns</div>
					<div className="text-slate-400">
						{result.release_year}, {result.media_type}
						{order === "cosine"
							? `, cosine ${result.cosine.toFixed(3)}`
							: `, weighted sum ${result.weightedSum.toFixed(1)}`}
					</div>
				</div>
			</div>
			<div className="flex flex-wrap gap-1 my-1">
				{result.reasons.map((r) => (
					<span
						key={r.text}
						className={`border rounded px-1 ${
							r.kind === "attribute"
								? "border-violet-500 text-violet-300"
								: r.kind === "dimension"
									? "border-green-600 text-green-300"
									: "border-red-600 text-red-300"
						}`}
					>
						{r.text}
					</span>
				))}
				{result.tropes.map((t) => (
					<span key={t.name} title={t.text} className="border rounded px-1 border-amber-500 text-amber-300">
						{t.name}
					</span>
				))}
				{result.reasons.length === 0 && result.tropes.length === 0 && (
					<span className="text-slate-500">no data-level reason</span>
				)}
			</div>
			<button type="button" className="underline text-sky-400" onClick={() => setOpen(!open)}>
				{open ? "Hide scores" : "Show scores"}
			</button>
			{open &&
				result.tropes.map((t) => (
					<div key={t.name} className="border-l-2 border-amber-600 pl-2 mt-1">
						<span className="font-semibold">{t.name}</span>{" "}
						<span className="text-slate-400">relative match {(t.score * 100).toFixed(0)}%</span>
						<div className="text-slate-300">{t.text}</div>
					</div>
				))}
			{open && (
				<table className="w-full mt-1">
					<thead className="text-slate-400 text-left">
						<tr>
							<th>Dimension</th>
							<th>Weight</th>
							<th>Stored</th>
						</tr>
					</thead>
					<tbody>
						{result.scores.map((s) => (
							<tr key={s.key}>
								<td>{s.label}</td>
								<td className={s.weight > 0 ? "text-green-400" : "text-red-400"}>
									{s.weight > 0 ? "+" : ""}
									{s.weight.toFixed(2)}
								</td>
								<td>{s.value ?? "none"}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</li>
	)
}

export default function PrototypeJevVector() {
	const { comparison, error } = useLoaderData<typeof loader>() as {
		comparison: VectorComparison | null
		error: string | null
	}
	const loading = useNavigation().state !== "idle"
	const [showAll, setShowAll] = useState(false)
	const [hovered, setHovered] = useState<string | null>(null)
	const columnCount = new Map<string, number>()
	for (const s of comparison?.strategies ?? []) {
		for (const r of s.results) {
			const id = `${r.media_type}:${r.tmdb_id}`
			columnCount.set(id, (columnCount.get(id) ?? 0) + 1)
		}
	}

	return (
		<div className="p-4 text-slate-100">
			<h1 className="text-xl font-bold">Prototype: D4+ speed and cost</h1>
			<p className="text-sm text-slate-400 mb-3">
				Throwaway page. Jev reads the request only. No title is sent to Jev. Each Jev reading runs once, every
				column derives its query from the shared readings, then Qdrant retrieves and code ranks.
			</p>
			<Form method="get" className="flex flex-wrap gap-2 items-center">
				<input
					name="q"
					defaultValue={comparison?.request ?? ""}
					placeholder="Describe what you want to watch"
					className="flex-1 min-w-64 px-3 py-2 rounded bg-slate-800 border border-slate-600"
				/>
				<label className="text-xs">
					Qdrant pool{" "}
					<select
						name="pool"
						defaultValue={String(comparison?.options.pool ?? 2000)}
						className="bg-slate-800 border border-slate-600 rounded p-1"
					>
						<option value="300">300 titles</option>
						<option value="2000">2,000 titles</option>
					</select>
				</label>
				<label className="text-xs">
					Trope search{" "}
					<select
						name="tropes"
						defaultValue={comparison?.options.tropes ?? "auto"}
						className="bg-slate-800 border border-slate-600 rounded p-1"
					>
						<option value="auto">Auto: only for requests that name a concrete thing</option>
						<option value="off">Off</option>
						<option value="always">Always</option>
					</select>
				</label>
				<button type="submit" className="px-4 py-2 rounded bg-sky-600" disabled={loading}>
					{loading ? "Searching..." : "Search"}
				</button>
			</Form>
			<div className="flex flex-wrap gap-2 mt-2 text-xs">
				{EXAMPLES.map((example) => (
					<a key={example} href={`?q=${encodeURIComponent(example)}&pool=${comparison?.options.pool ?? 2000}&tropes=${comparison?.options.tropes ?? "auto"}`} className="underline text-sky-400">
						{example}
					</a>
				))}
			</div>

			{error && <pre className="mt-4 text-red-400 whitespace-pre-wrap">{error}</pre>}

			{comparison && !loading && (
				<>
					<section className="mt-4 overflow-x-auto">
						<h2 className="font-semibold">Speed and cost per strategy</h2>
						<p className="text-xs text-slate-400">
							The strategy columns exclude the attribute request. Each column runs its own attribute
							request, shown in the column. The first column's request: {comparison.attributes.usage.tokens.toLocaleString("en-US")} tokens,{" "}
							{usd(comparison.attributes.usage.usd)}, {comparison.attributes.usage.ms} ms. The "whole search"
							columns add it. Whole page: {(comparison.stats.ms / 1000).toFixed(1)} s.
						</p>
						<table className="mt-1 text-xs text-slate-300">
							<thead className="text-left text-slate-400">
								<tr>
									{["Strategy", "Requests", "Questions", "Input tokens", "Cost", "Per 1,000", "Jev time", "Qdrant time", "Trope time", "Match mode", "Pool", "Dimensions used", "Whole search tokens", "Whole search per 1,000", "Whole search, one call after another", "Whole search, Jev calls in parallel"].map(
										(h) => (
											<th key={h} className="pr-4">
												{h}
											</th>
										),
									)}
								</tr>
							</thead>
							<tbody>
								{comparison.strategies.map((s) => (
									<tr key={s.id}>
										<td className="pr-4 font-semibold whitespace-nowrap">{s.label}</td>
										<td className="pr-4">{s.usage.requests}</td>
										<td className="pr-4">{s.usage.questions}</td>
										<td className="pr-4">{s.usage.tokens.toLocaleString("en-US")}</td>
										<td className="pr-4">{usd(s.usage.usd)}</td>
										<td className="pr-4">${(s.usage.usd * 1000).toFixed(2)}</td>
										<td className="pr-4">{s.usage.ms} ms</td>
										<td className="pr-4">{s.retrievalMs} ms</td>
										<td className="pr-4">{s.tropeMs} ms</td>
										<td className="pr-4">{s.tropeMode}</td>
										<td className="pr-4">{s.pool}</td>
										<td className="pr-4">{s.used.length}</td>
										<td className="pr-4">{s.total.tokens.toLocaleString("en-US")}</td>
										<td className="pr-4">${(s.total.usd * 1000).toFixed(2)}</td>
										<td className="pr-4">{s.total.sequentialMs} ms</td>
										<td className="font-semibold">{s.total.parallelMs} ms</td>
									</tr>
								))}
							</tbody>
						</table>
					</section>

					<section className="mt-4">
						<h2 className="font-semibold">Attributes read from the request</h2>
						<div className="flex flex-wrap gap-1 mt-1 text-xs">
							{comparison.attributes.flags
								.filter((f) => showAll || f.decision)
								.map((f) => (
									<span
										key={f.id}
										className={`border rounded px-1 ${
											f.decision === "required"
												? "border-green-500 text-green-400"
												: f.decision === "excluded"
													? "border-red-500 text-red-400"
													: "border-slate-700 text-slate-400"
										}`}
									>
										{f.decision === "required" ? "Must be: " : f.decision === "excluded" ? "Must not be: " : ""}
										{f.label} ({(f.required * 100).toFixed(0)}% required, {(f.excluded * 100).toFixed(0)}% excluded)
									</span>
								))}
							{!comparison.attributes.flags.some((f) => f.decision) && !showAll && (
								<span className="text-slate-500">none decided</span>
							)}
						</div>
						<button type="button" className="text-xs underline text-sky-400 mt-1" onClick={() => setShowAll(!showAll)}>
							{showAll ? "Show decided attributes and used dimensions only" : "Show all attributes and dimensions"}
						</button>
					</section>

					<section className={comparison.attributes.lean ? "hidden" : "mt-4"}>
						<h2 className="font-semibold">Genres read from the request</h2>
						<div className="flex flex-wrap gap-1 mt-1 text-xs">
							{comparison.attributes.genres
								.filter((g) => showAll || g.decision)
								.map((g) => (
									<span
										key={g.id}
										className={`border rounded px-1 ${
											g.decision === "required"
												? "border-green-500 text-green-400"
												: g.decision === "excluded"
													? "border-red-500 text-red-400"
													: "border-slate-700 text-slate-400"
										}`}
									>
										{g.id} ({(g.required * 100).toFixed(0)}% required, {(g.excluded * 100).toFixed(0)}% excluded)
									</span>
								))}
							{!comparison.attributes.genres.some((g) => g.decision) && !showAll && (
								<span className="text-slate-500">none decided</span>
							)}
						</div>
					</section>

					<section className={comparison.kinds.length ? "mt-4" : "hidden"}>
						<h2 className="font-semibold">Kinds of title that Jev found closest (approach C)</h2>
						<ol className="text-xs text-slate-300 mt-1 space-y-0.5">
							{comparison.kinds.map((k) => (
								<li key={k.id}>
									<span className="font-semibold">
										Fit {k.score.toFixed(2)} of 4, kind {k.id}
									</span>{" "}
									({k.size} titles, {k.kind}): {k.genres.join(", ") || "mixed genres"}. Distinctive:{" "}
									{k.distinctive_qualities.join(", ")}. Unusually low: {k.unusually_low_qualities.join(", ") || "none"}.
								</li>
							))}
						</ol>
					</section>

					<section className="mt-4">
						<h2 className="font-semibold">Concrete words</h2>
						<div className="flex flex-wrap gap-1 mt-1 text-xs">
							{comparison.attributes.split.map((w) => (
								<span
									key={w.word}
									className={`border rounded px-1 ${w.isConcrete ? "border-amber-500 text-amber-300" : "border-slate-700 text-slate-400"}`}
								>
									{w.word}: {(w.concrete * 100).toFixed(0)}% concrete
								</span>
							))}
						</div>
						<p className="text-xs text-slate-400">
							Words at 60% or more count as concrete. They drive the mood gate and the wider evidence
							search. Search phrase candidates:{" "}
							{comparison.attributes.phrases
								.slice(0, 6)
								.map((p) => `"${p.phrase}" ${(p.probability * 100).toFixed(0)}%`)
								.join(", ") || "none"}
							.
						</p>
						<h2 className={comparison.attributes.lean ? "hidden" : "font-semibold mt-4"}>Request shape</h2>
						<p className={comparison.attributes.lean ? "hidden" : "text-xs text-slate-300"}>
							The 74 qualities can express the request: {(comparison.attributes.shape.covered * 100).toFixed(0)}%.
							The request names a concrete thing, motif, or trope:{" "}
							{(comparison.attributes.shape.specific * 100).toFixed(0)}%. Trope search:{" "}
							<span className={comparison.tropesActive ? "text-amber-300" : "text-slate-400"}>
								{comparison.tropesActive ? `on, searching for "${comparison.tropeTerms}"` : "off"}
							</span>
							.
						</p>
						<p className={comparison.attributes.lean ? "hidden" : "text-xs text-slate-400"}>
							Both questions ride along in the attribute request, so they add no Jev call. The trope
							search runs only among the titles in each strategy's Qdrant pool. It needs no Jev call.
						</p>
					</section>

					<section className="mt-4">
						<h2 className="font-semibold">Results per strategy</h2>
						<div className="grid grid-flow-col auto-cols-[minmax(240px,1fr)] gap-2 mt-2 pb-4 overflow-x-auto">
							{comparison.strategies.map((s) => (
								<div key={s.id} className="min-w-0">
									<h3 className="text-sm font-semibold">{s.label}</h3>
									<p className="text-xs text-slate-400 h-36 overflow-y-auto">{s.description}</p>
									<div className="text-xs text-slate-400 my-1">
										Whole search: {s.total.tokens.toLocaleString("en-US")} tokens, {usd(s.total.usd)},{" "}
										{s.total.parallelMs} ms with both Jev calls in parallel
									</div>
									<div className="text-xs text-slate-300 my-1">
										Attribute request ({s.attributes.criteria} criteria, {s.attributes.tokens.toLocaleString("en-US")}{" "}
										tokens, {s.attributes.ms} ms): {s.attributes.decided.join(", ") || "no attribute decided"}. Phrase: "
										{s.attributes.phrase}". Concrete words: {s.attributes.concrete.join(", ") || "none"}.
									</div>
									{s.notes.map((note) => (
										<div key={note} className="text-xs text-slate-400">
											{note}
										</div>
									))}
									<div className="flex flex-wrap gap-1 my-2 text-xs">
										{(showAll ? s.details : s.used).map((d) => (
											<span
												key={d.key}
												title={"text" in d ? String(d.text) : undefined}
												className={`border rounded px-1 ${d.weight > 0 ? "border-green-600 text-green-300" : "border-red-600 text-red-300"}`}
											>
												{d.label} {d.weight > 0 ? "+" : ""}
												{d.weight.toFixed(2)}
											</span>
										))}
										{s.used.length === 0 && <span className="text-slate-500">no dimension used</span>}
									</div>
									<ol className="space-y-1">
										{s.results.map((result) => (
											<Card
												key={`${result.media_type}:${result.tmdb_id}`}
												result={result}
												order={s.order}
												hovered={hovered}
												setHovered={setHovered}
												columns={columnCount.get(`${result.media_type}:${result.tmdb_id}`) ?? 1}
												total={comparison.strategies.length}
											/>
										))}
										{s.results.length === 0 && <li className="text-xs text-slate-500">no results</li>}
									</ol>
								</div>
							))}
						</div>
					</section>
				</>
			)}
		</div>
	)
}
