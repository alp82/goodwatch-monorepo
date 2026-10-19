// PROTOTYPE - throwaway. See app/server/prototype-jev-search.server.ts.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { Form, useLoaderData, useNavigation } from "@remix-run/react"
import { useState } from "react"
import {
	type PrototypeResult,
	type PrototypeSearch,
	runPrototypeSearch,
} from "~/server/prototype-jev-search.server"

export const loader = async ({ request }: LoaderFunctionArgs) => {
	const params = new URL(request.url).searchParams
	const q = params.get("q")?.trim() ?? ""
	if (!q) return json({ search: null, error: null })
	try {
		const search = await runPrototypeSearch(q, {
			retrieval:
				params.get("retrieval") === "crate"
					? "crate"
					: params.get("retrieval") === "qdrant_rerank"
						? "qdrant_rerank"
						: "qdrant",
			interpretation: params.get("interpretation") === "short" ? "short" : "full",
		})
		return json({ search, error: null })
	} catch (error) {
		return json({ search: null, error: String(error) })
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

const BASELINE = "baseline"
const usd = (value: number) => `$${value.toFixed(4)}`

const Bars = ({ probabilities, legend }: { probabilities: number[]; legend: string[] }) => (
	<div className="flex items-end gap-1 h-10">
		{probabilities.map((p, i) => (
			<div
				// biome-ignore lint/suspicious/noArrayIndexKey: fixed ladder
				key={i}
				title={`${i}: ${legend[i]} - ${(p * 100).toFixed(0)}%`}
				className="w-4 bg-sky-500"
				style={{ height: `${Math.max(p * 100, 3)}%` }}
			/>
		))}
	</div>
)

type Variant = PrototypeSearch["variants"][number]

// Match reasons as chips: required attributes the title has, requested dimensions it scores
// high on (or avoided ones it scores low on), and tropes Jev judged as supporting the request.
// When a variant asks no per-trope questions, the tropes sent in the state are listed instead.
const Reasons = ({
	result,
	judgment,
	variant,
}: {
	result: PrototypeResult
	judgment: PrototypeResult["variants"][string]
	variant: Variant
}) => {
	const tropes = judgment.usedTropes
		? result.tropes
				.map((trope, i) => ({ name: trope.name, support: judgment.tropeSupport?.[i] ?? null }))
				.filter((t) => t.support === null || t.support >= 0.5)
		: []
	const chip = (key: string, text: string, color: string) => (
		<span key={key} className={`border rounded px-1 ${color}`}>
			{text}
		</span>
	)
	return (
		<div className="flex flex-wrap gap-1 my-1">
			{result.reasons.map((r) =>
				chip(
					r.text,
					r.text,
					r.kind === "attribute"
						? "border-violet-500 text-violet-300"
						: r.kind === "dimension"
							? "border-green-600 text-green-300"
							: "border-red-600 text-red-300",
				),
			)}
			{tropes.map((t) =>
				chip(
					`trope:${t.name}`,
					t.support === null ? `trope: ${t.name}` : `trope: ${t.name} ${(t.support * 100).toFixed(0)}%`,
					"border-amber-500 text-amber-300",
				),
			)}
			{result.sources.includes("tropes") && !variant.arithmetic &&
				chip("src", "found by trope search", "border-slate-600 text-slate-400")}
			{result.reasons.length === 0 && tropes.length === 0 && (
				<span className="text-slate-500">no data-level reason</span>
			)}
		</div>
	)
}

const Card = ({ result, variant }: { result: PrototypeResult; variant: Variant }) => {
	const [open, setOpen] = useState(false)
	const [poster, setPoster] = useState(false)
	const judgment = result.variants[variant.id]
	const moved = result.variants[BASELINE].rank - judgment.rank
	return (
		<li className="border border-slate-700 rounded p-2 bg-slate-900 text-xs">
			{poster && (
				<button
					type="button"
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-zoom-out"
					onClick={() => setPoster(false)}
				>
					<img
						src={`https://image.tmdb.org/t/p/w780${result.poster_path}`}
						alt={`Poster of ${result.title}. Click to close.`}
						className="max-h-[92vh] max-w-[92vw] rounded shadow-2xl"
					/>
				</button>
			)}
			<div className="flex gap-2">
				{result.poster_path && (
					<button
						type="button"
						className="shrink-0 self-start cursor-zoom-in"
						onClick={() => setPoster(true)}
					>
						<img
							src={`https://image.tmdb.org/t/p/w92${result.poster_path}`}
							alt={`Poster of ${result.title}. Click to enlarge.`}
							className="w-8 h-12 object-cover rounded"
						/>
					</button>
				)}
				<div className="flex-1 min-w-0">
					<div className="font-semibold text-sm truncate" title={result.title}>
						{judgment.rank}. {result.title}
					</div>
					<div className="text-slate-400">
						{result.release_year}, {result.media_type}
					</div>
					<div className="text-slate-300">
						{variant.arithmetic
							? `Weighted sum ${judgment.score.toFixed(1)}`
							: `Fit ${judgment.score.toFixed(2)} of 4, confidence ${judgment.confidence.toFixed(2)}`}
						{variant.id !== BASELINE && moved !== 0 && (
							<span className={moved > 0 ? "text-green-400" : "text-red-400"}>
								{" "}
								{moved > 0 ? `up ${moved}` : `down ${-moved}`}
							</span>
						)}
					</div>
				</div>
			</div>
			<Reasons result={result} judgment={judgment} variant={variant} />
			<button type="button" className="underline text-sky-400" onClick={() => setOpen(!open)}>
				{open ? "Hide details" : "Show details"}
			</button>
			{open && (
				<div className="mt-2 space-y-2">
					<p className="text-slate-300">{result.essence_text}</p>
					<p className="text-slate-400">
						Found through: {result.sources.join(" and ")}. Arithmetic fit{" "}
						{result.arithmeticFit.toFixed(1)}. Tropes in state: {judgment.usedTropes ? "yes" : "no"}.
					</p>
					<p className="text-slate-400">Attributes: {result.attributes.join(", ") || "none"}</p>
					{!variant.arithmetic && <Bars probabilities={judgment.probabilities} legend={variant.fitLevels} />}
					<table className="w-full">
						<thead className="text-slate-400 text-left">
							<tr>
								<th>Dimension</th>
								<th>Weight</th>
								<th>Stored</th>
							</tr>
						</thead>
						<tbody>
							{result.dimensionValues.map((d) => (
								<tr key={d.key}>
									<td>{d.label}</td>
									<td className={d.weight > 0 ? "text-green-400" : "text-red-400"}>
										{d.weight > 0 ? "+" : ""}
										{d.weight.toFixed(2)}
									</td>
									<td>{d.value ?? "none"}</td>
								</tr>
							))}
						</tbody>
					</table>
					{judgment.usedTropes &&
						result.tropes.map((trope, i) => (
							<div key={trope.name} className="border-l-2 border-slate-600 pl-2">
								<span className="font-semibold">{trope.name}</span>{" "}
								{judgment.tropeSupport && (
									<span
										className={judgment.tropeSupport[i] >= 0.5 ? "text-green-400" : "text-slate-400"}
									>
										supports the request: {(judgment.tropeSupport[i] * 100).toFixed(0)}%
									</span>
								)}
								{variant.tropes === "passages" && <div className="text-slate-300">{trope.text}</div>}
							</div>
						))}
					<details>
						<summary className="cursor-pointer text-sky-400">Exact title state sent to Jev</summary>
						<pre className="whitespace-pre-wrap text-slate-400">
							{JSON.stringify(judgment.state, null, 1)}
						</pre>
					</details>
				</div>
			)}
		</li>
	)
}

export default function PrototypeJevSearch() {
	const { search, error } = useLoaderData<typeof loader>() as {
		search: PrototypeSearch | null
		error: string | null
	}
	const navigation = useNavigation()
	const loading = navigation.state !== "idle"
	const [showAll, setShowAll] = useState(false)
	const [topOnly, setTopOnly] = useState(true)

	return (
		<div className="p-4 text-slate-100">
			<h1 className="text-xl font-bold">Prototype: Jev discovery search</h1>
			<p className="text-sm text-slate-400 mb-3">
				Throwaway page. Each search runs every variant one after another and takes 10 to 20 seconds.
			</p>
			<Form method="get" className="flex flex-wrap gap-2 items-center">
				<input
					name="q"
					defaultValue={search?.request ?? ""}
					placeholder="Describe what you want to watch"
					className="flex-1 min-w-64 px-3 py-2 rounded bg-slate-800 border border-slate-600"
				/>
				<label className="text-xs">
					Fingerprint retrieval{" "}
					<select
						name="retrieval"
						defaultValue={search?.options.retrieval ?? "qdrant"}
						className="bg-slate-800 border border-slate-600 rounded p-1"
					>
						<option value="qdrant">Qdrant vector search</option>
						<option value="qdrant_rerank">Qdrant wide pool, re-ordered by weighted sum</option>
						<option value="crate">Crate weighted sum</option>
					</select>
				</label>
				<label className="text-xs">
					Interpretation that drives retrieval{" "}
					<select
						name="interpretation"
						defaultValue={search?.options.interpretation ?? "full"}
						className="bg-slate-800 border border-slate-600 rounded p-1"
					>
						<option value="full">Full level descriptions</option>
						<option value="short">Short level descriptions</option>
					</select>
				</label>
				<button type="submit" className="px-4 py-2 rounded bg-sky-600" disabled={loading}>
					{loading ? "Searching..." : "Search"}
				</button>
			</Form>
			<div className="flex flex-wrap gap-2 mt-2 text-xs">
				{EXAMPLES.map((example) => (
					<a key={example} href={`?q=${encodeURIComponent(example)}`} className="underline text-sky-400">
						{example}
					</a>
				))}
			</div>

			{error && <pre className="mt-4 text-red-400 whitespace-pre-wrap">{error}</pre>}

			{search && !loading && (
				<>
					<p className="mt-4 text-xs text-slate-400">
						This page made {search.stats.requests} Jev requests with {search.stats.questions}{" "}
						questions and {search.stats.tokens.toLocaleString("en-US")} input tokens, for an estimated{" "}
						{usd(search.stats.usd)}, in {(search.stats.ms / 1000).toFixed(1)} s. A product search runs
						one variant only: see the following table. Candidates: {search.stats.fromFingerprint} from
						fingerprint retrieval ({search.options.retrieval}), {search.stats.fromTropes} from trope
						full-text search, {search.stats.titlesWithTropes} of {search.results.length} with matching
						tropes. Stage times: reading the request {search.stats.stages.interpretMs} ms, trope
						full-text search {search.stats.stages.tropeSearchMs} ms (runs during the reading), vector
						search {search.stats.stages.vectorSearchMs} ms, title details and passages{" "}
						{search.stats.stages.detailsMs} ms.
					</p>

					<section className="mt-3 overflow-x-auto">
						<h2 className="font-semibold">Variants</h2>
						<p className="text-xs text-slate-400">
							The search columns add the chosen interpretation call and retrieval to the variant's fit
							calls. Time is measured, because variants run one after another.
						</p>
						<table className="mt-1 text-xs text-slate-300">
							<thead className="text-left text-slate-400">
								<tr>
									{[
										"Variant",
										"What changes",
										"Fit requests",
										"Fit tokens",
										"Fit time",
										"Search tokens",
										"Search cost",
										"Per 1,000 searches",
										"Search time",
									].map((heading) => (
										<th key={heading} className="pr-4">
											{heading}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{search.variants.map((v) => (
									<tr key={v.id}>
										<td className="pr-4 font-semibold whitespace-nowrap">{v.label}</td>
										<td className="pr-4 text-slate-400">{v.description}</td>
										<td className="pr-4">{v.usage.requests}</td>
										<td className="pr-4">{v.usage.tokens.toLocaleString("en-US")}</td>
										<td className="pr-4">{(v.usage.ms / 1000).toFixed(1)} s</td>
										<td className="pr-4">{v.searchTokens.toLocaleString("en-US")}</td>
										<td className="pr-4">{usd(v.searchUsd)}</td>
										<td className="pr-4">${(v.searchUsd * 1000).toFixed(2)}</td>
										<td>{(v.searchMs / 1000).toFixed(1)} s</td>
									</tr>
								))}
							</tbody>
						</table>
					</section>

					<section className="mt-4">
						<h2 className="font-semibold">How Jev read the request</h2>
						<p className="text-xs text-slate-400">
							Wanted level runs from 0 (avoid) through 2 (no preference) to 4 (central). Both
							interpretations always run. The one marked "drives retrieval" selects the candidates.{" "}
							<button
								type="button"
								className="underline text-sky-400"
								onClick={() => setShowAll(!showAll)}
							>
								{showAll ? "Show used dimensions only" : "Show all dimensions and attributes"}
							</button>
						</p>
						<div className="grid md:grid-cols-2 gap-4 mt-2">
							{search.interpretations.map((interpretation) => (
								<div key={interpretation.style} className="border border-slate-700 rounded p-2">
									<div className="text-sm font-semibold">
										{interpretation.style === "full" ? "Full" : "Short"} level descriptions
										{interpretation.style === search.options.interpretation && (
											<span className="text-sky-400"> drives retrieval</span>
										)}
									</div>
									<div className="text-xs text-slate-400">
										{interpretation.usage.tokens.toLocaleString("en-US")} input tokens,{" "}
										{usd(interpretation.usage.usd)}, {(interpretation.usage.ms / 1000).toFixed(1)} s
									</div>
									<div className="flex flex-wrap gap-1 mt-2 text-xs">
										{interpretation.flags
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
													{f.decision === "required"
														? "Must be: "
														: f.decision === "excluded"
															? "Must not be: "
															: ""}
													{f.label} ({(f.required * 100).toFixed(0)}% required,{" "}
													{(f.excluded * 100).toFixed(0)}% excluded)
												</span>
											))}
									</div>
									<div className="grid grid-cols-2 lg:grid-cols-4 gap-1 mt-2 text-xs">
										{[...interpretation.dimensions]
											.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
											.filter((d) => showAll || d.used)
											.map((d) => (
												<div key={d.key} className="border border-slate-700 rounded p-1">
													<div className="font-semibold">
														{d.label} {d.used && <span className="text-sky-400">used</span>}
													</div>
													<div className={d.weight > 0 ? "text-green-400" : "text-red-400"}>
														wanted {d.wanted.toFixed(2)}, confidence {d.confidence.toFixed(2)}
													</div>
													<Bars probabilities={d.probabilities} legend={interpretation.levels} />
												</div>
											))}
									</div>
								</div>
							))}
						</div>
					</section>

					<section className="mt-4">
						<h2 className="font-semibold">Rankings per variant</h2>
						<p className="text-xs text-slate-400">
							Every variant judges the same {search.results.length} candidates. Rank changes are
							relative to the "Baseline with tropes" column.{" "}
							<button
								type="button"
								className="underline text-sky-400"
								onClick={() => setTopOnly(!topOnly)}
							>
								{topOnly ? "Show all candidates" : "Show top 12 only"}
							</button>
						</p>
						<div className="flex gap-3 overflow-x-auto mt-2 pb-4">
							{search.variants.map((v) => (
								<div key={v.id} className="w-72 shrink-0">
									<h3 className="text-sm font-semibold">{v.label}</h3>
									<div className="text-xs text-slate-400 mb-1">
										{v.searchTokens.toLocaleString("en-US")} tokens, {usd(v.searchUsd)},{" "}
										{(v.searchMs / 1000).toFixed(1)} s per search
									</div>
									<ol className="space-y-1">
										{[...search.results]
											.sort((a, b) => a.variants[v.id].rank - b.variants[v.id].rank)
											.slice(0, topOnly ? 12 : undefined)
											.map((result) => (
												<Card key={`${result.media_type}:${result.tmdb_id}`} result={result} variant={v} />
											))}
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
