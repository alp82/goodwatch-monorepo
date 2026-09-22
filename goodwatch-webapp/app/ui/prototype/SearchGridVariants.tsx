// PROTOTYPE — throwaway. Grid layouts for search results, rendered on the existing
// /search route and gated by `?variant=`. Variant A is the production list.
// Round 3: five takes on the card bottom. Columns are 2 / 4 / 5 (20 per page ends on a full row).
//   B — Overlay: MovieTvCard style, everything on the poster, reasons appear on hover.
//   C — Caption: bare poster, plain caption below (title, meta, one reason sentence). No box.
//   D — DNA tags: MovieTvCard frame, title, reasons as DNATag-style tags on one row.
//   E — Footer: ShowcaseCard frame, poster over a translucent footer with a sparkle reason.
//   F — Backdrop: landscape card, blurred poster as backdrop, poster left, reasons as a list.
import { Link } from "@remix-run/react";
import { SparklesIcon } from "@heroicons/react/20/solid";
import type { ReactNode } from "react";
import { Highlight, type Row } from "~/ui/search/search-model";
import { useSearchJourney } from "~/ui/search/SearchJourney";
import placeholder from "~/img/placeholder-poster.png";

const poster = (r: Row) =>
	r.poster ? `https://www.themoviedb.org/t/p/w300_and_h450_bestv2${r.poster}` : placeholder;
const reasons = (r: Row) =>
	(r.discovery?.reasons ?? []).filter((x) => x.kind !== "mismatch");

function useCell() {
	const j = useSearchJourney()!;
	const active = (r: Row) =>
		j.currentKey === r.key ||
		j.focused === j.sequence.findIndex((item) => item.key === r.key);
	const Cell = ({ r, className, children }: { r: Row; className: string; children: ReactNode }) =>
		r.type === "person" ? (
			<div className={className}>{children}</div>
		) : (
			<Link
				prefetch="intent"
				data-result={r.key}
				to={j.detailHref(r)}
				onClick={j.remember}
				className={`${className} focus-visible:outline focus-visible:outline-cyan-300 ${active(r) ? "ring-2 ring-cyan-300" : ""}`}
			>
				{children}
			</Link>
		);
	return { j, Cell };
}

const cols = "grid-cols-2 sm:grid-cols-4 lg:grid-cols-5";
const Title = ({ r, className = "" }: { r: Row; className?: string }) => {
	const j = useSearchJourney()!;
	return (
		<span className={className}>
			<Highlight text={r.title} query={j.batch?.q ?? ""} />
		</span>
	);
};
const meta = (r: Row) =>
	r.type === "person" ? `Known for ${r.knownFor}` : `${r.year} · ${r.type}`;
const tagColor = (kind: "attribute" | "dimension" | "mismatch") =>
	kind === "attribute" ? "bg-amber-800/50" : "bg-cyan-800/50";

export function VariantB() {
	const { j, Cell } = useCell();
	return (
		<ul aria-busy={j.loading} className={`grid ${cols} gap-2 p-2`}>
			{j.pageRows.map((r) => (
				<li key={r.key} className="min-w-0">
					<Cell r={r} className="group relative block aspect-[2/3] overflow-hidden rounded-lg border-4 border-gray-800 bg-gray-900 hover:border-amber-700/50">
						<img src={poster(r)} alt="" className="h-full w-full object-cover" />
						<div className="absolute inset-x-0 bottom-0 flex flex-col justify-end min-h-24 px-2 py-2 bg-linear-to-t from-black/80 to-transparent group-hover:from-black/95 group-hover:via-black/80 group-hover:min-h-full transition-all duration-200">
							<Title r={r} className="text-sm font-bold text-white leading-tight line-clamp-2" />
							<span className="text-[11px] text-gray-300">{meta(r)}</span>
							<ul className="hidden group-hover:block mt-2 space-y-1 text-[11px] text-cyan-200">
								{reasons(r).slice(0, 3).map((x) => (
									<li key={x.text} className="line-clamp-1">{x.text}</li>
								))}
							</ul>
						</div>
					</Cell>
				</li>
			))}
		</ul>
	);
}

export function VariantC() {
	const { j, Cell } = useCell();
	return (
		<ul aria-busy={j.loading} className={`grid ${cols} gap-x-3 gap-y-5 p-3`}>
			{j.pageRows.map((r) => {
				const lead = reasons(r)[0]?.text;
				return (
					<li key={r.key} className="min-w-0">
						<Cell r={r} className="group block">
							<img src={poster(r)} alt="" className="aspect-[2/3] w-full rounded-md object-cover bg-gray-800 shadow-lg shadow-black/40 group-hover:brightness-110" />
							<div className="mt-2 px-0.5">
								<Title r={r} className="block truncate text-sm font-semibold text-white" />
								<p className="truncate text-xs text-gray-400">{meta(r)}</p>
								<p className="mt-1 h-8 text-[11px] leading-4 text-cyan-200/90 line-clamp-2">{lead ?? ""}</p>
							</div>
						</Cell>
					</li>
				);
			})}
		</ul>
	);
}

export function VariantD() {
	const { j, Cell } = useCell();
	return (
		<ul aria-busy={j.loading} className={`grid ${cols} gap-2 p-2`}>
			{j.pageRows.map((r) => {
				const list = reasons(r);
				return (
					<li key={r.key} className="min-w-0">
						<Cell r={r} className="flex h-full flex-col rounded-lg border-4 border-gray-800 bg-gray-900 hover:bg-gray-800 hover:border-amber-700/50 overflow-hidden">
							<img src={poster(r)} alt="" className="aspect-[2/3] w-full object-cover bg-gray-800" />
							<div className="p-2">
								<Title r={r} className="block truncate text-sm font-bold text-white" />
								<p className="truncate text-xs text-gray-400">{meta(r)}</p>
								<div className="mt-2 h-6 overflow-hidden flex gap-1 flex-nowrap">
									{list.slice(0, 2).map((x) => (
										<span key={x.text} className={`${tagColor(x.kind)} truncate rounded-md border-2 border-gray-600 px-1.5 text-[11px] leading-5 text-white`}>
											{x.text}
										</span>
									))}
									{list.length > 2 && (
										<span className="shrink-0 rounded-md border-2 border-gray-600 px-1.5 text-[11px] leading-5 text-gray-300">
											+{list.length - 2}
										</span>
									)}
								</div>
							</div>
						</Cell>
					</li>
				);
			})}
		</ul>
	);
}

export function VariantE() {
	const { j, Cell } = useCell();
	return (
		<ul aria-busy={j.loading} className={`grid ${cols} gap-3 p-3`}>
			{j.pageRows.map((r) => {
				const lead = reasons(r)[0]?.text;
				return (
					<li key={r.key} className="min-w-0">
						<Cell r={r} className="flex h-full flex-col overflow-hidden rounded-md border border-gray-600/50 bg-gray-800/50 hover:border-gray-400/60">
							<img src={poster(r)} alt="" className="aspect-[2/3] w-full object-cover bg-gray-800" />
							<div className="flex flex-col gap-1.5 bg-black/40 p-2.5">
								<div>
									<Title r={r} className="block truncate text-sm font-bold text-white" />
									<p className="truncate text-xs text-gray-400">{meta(r)}</p>
								</div>
								<div className="flex items-start gap-1.5 h-8 text-[11px] leading-4 text-gray-200">
									<SparklesIcon className="h-3.5 w-3.5 shrink-0 mt-px text-amber-300" aria-hidden="true" />
									<span className="line-clamp-2">{lead ?? "Catalog match"}</span>
								</div>
							</div>
						</Cell>
					</li>
				);
			})}
		</ul>
	);
}

export function VariantF() {
	const { j, Cell } = useCell();
	return (
		<ul aria-busy={j.loading} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 p-3">
			{j.pageRows.map((r) => (
				<li key={r.key} className="min-w-0">
					<Cell r={r} className="relative flex h-full gap-3 overflow-hidden rounded-lg border border-gray-600/50 bg-gray-800/50 p-3 hover:border-amber-700/50">
						{r.poster && (
							<div
								className="absolute inset-0 opacity-30 blur-xl scale-125"
								style={{ backgroundImage: `url(${poster(r)})`, backgroundSize: "cover", backgroundPosition: "center" }}
							/>
						)}
						<div className="absolute inset-0 bg-linear-to-r from-gray-900 via-gray-900/90 to-gray-900/70" />
						<img src={poster(r)} alt="" width={80} height={120} className="relative w-20 h-30 rounded-md object-cover bg-gray-800 shadow-xl shrink-0" />
						<div className="relative min-w-0 flex-1">
							<Title r={r} className="block text-base font-bold text-white leading-snug line-clamp-2" />
							<p className="text-xs text-gray-400">{meta(r)}</p>
							<ul className="mt-2 space-y-0.5 text-xs text-gray-200">
								{reasons(r).slice(0, 3).map((x) => (
									<li key={x.text} className="flex gap-1.5 truncate">
										<span className="text-amber-300">•</span>
										<span className="truncate">{x.text}</span>
									</li>
								))}
							</ul>
						</div>
					</Cell>
				</li>
			))}
		</ul>
	);
}
