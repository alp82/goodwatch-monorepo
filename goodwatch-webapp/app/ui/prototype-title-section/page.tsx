// PROTOTYPE - throwaway. The real title page (a copy of ui/details/Details.tsx's page) with "Talked about now" between
// the fingerprint and the rest, plus a floating panel that shows the section's state: which third-party hosts the
// page has contacted, before and after the first click, which sources are on, and which posts were left out.
import { useSearchParams } from "@remix-run/react"
import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import type { MovieResult } from "~/server/types/details-types"
import DetailsContent from "~/ui/details/DetailsContent"
import DetailsFingerprint from "~/ui/details/DetailsFingerprint"
import DetailsHeader from "~/ui/details/DetailsHeader"
import DetailsSideNav from "~/ui/details/DetailsSideNav"
import { BelowFoldProvider, useBelowFold } from "~/ui/details/below-fold"
import DetailsHero from "~/ui/details/hero/DetailsHero"
import { sections } from "~/ui/details/sections"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { type Section, useScrollSections } from "~/utils/scroll"
import { SectionContext, useMounted } from "./embeds"
import { FeaturedLayout, GroupedLayout, LabLayout, RailLayout } from "./layouts"
import { MatchesPage } from "./matches"
import { ITEMS, SOURCE_ORDER, type SourceKey, VENDORS, visibleItems } from "./social"

export const VARIANTS = {
	rail: "Mixed rail",
	grouped: "Grouped by platform",
	featured: "Featured video + feed",
	lab: "Every source side by side",
	matches: "Real matched posts",
} as const
type VariantKey = keyof typeof VARIANTS

function useSources() {
	const [params, setParams] = useSearchParams()
	const raw = params.get("sources") ?? params.get("only")
	const sources = useMemo(() => new Set<SourceKey>(raw ? (raw.split(",") as SourceKey[]) : SOURCE_ORDER), [raw])
	const toggle = (source: SourceKey) => {
		const next = new Set(sources)
		if (next.has(source)) next.delete(source)
		else next.add(source)
		const p = new URLSearchParams(params)
		p.delete("only")
		if (next.size === SOURCE_ORDER.length) p.delete("sources")
		else p.set("sources", SOURCE_ORDER.filter((s) => next.has(s)).join(","))
		setParams(p, { replace: true, preventScrollReset: true })
	}
	return [sources, toggle] as const
}

export function TitleSectionPage({ media, country }: { media: MovieResult; country: string }) {
	const [params] = useSearchParams()
	// The section keeps its own state, so a click on a facade re-renders the section and not the whole title page.
	const section = useMemo(() => <SectionHost />, [])
	// The matches variant switches between 50 titles, so it has its own title header instead of this title's page.
	const matches = params.get("variant") === "matches"
	return (
		<>
			{matches ? (
				<MatchesPage />
			) : (
				<BelowFoldProvider titleKey={`movie-${media.details.tmdb_id}`}>
					<PageWithSection media={media} country={country} section={section} />
				</BelowFoldProvider>
			)}
			{params.get("switcher") !== "0" && <PrototypeSwitcher variants={VARIANTS} position="bottom-20 md:bottom-6 left-1/2 -translate-x-1/2" />}
			<style>{".tsqd-open-btn-container{display:none!important}"}</style>
		</>
	)
}

function SectionHost() {
	const [params] = useSearchParams()
	const variant = (params.get("variant") ?? "rail") as VariantKey
	const [sources, toggle] = useSources()
	const items = useMemo(() => visibleItems(sources), [sources])
	const [loaded, setLoaded] = useState<Set<string>>(new Set())
	const load = useCallback((id: string) => setLoaded((prev) => new Set(prev).add(id)), [])
	// A new layout starts with every item behind its facade again.
	useEffect(() => setLoaded(new Set()), [variant])
	const hydrated = useMounted()
	const Layout = ({ rail: RailLayout, grouped: GroupedLayout, featured: FeaturedLayout, lab: LabLayout } as Record<string, typeof RailLayout>)[variant] ?? RailLayout
	return (
		<SectionContext.Provider value={{ loaded, load }}>
			<div id="talked-about-now" data-hydrated={hydrated || undefined} className="isolate flex flex-col items-center">
				<div className="w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
					<Layout items={items} />
				</div>
			</div>
			{hydrated && params.get("panel") !== "0" && createPortal(<StatePanel sources={sources} toggle={toggle} loaded={loaded} />, document.body)}
		</SectionContext.Provider>
	)
}

// A copy of DetailsPage in ui/details/Details.tsx with one slot added, between the fingerprint and the content.
const PageWithSection = memo(function PageWithSection({ media, country, section }: { media: MovieResult; country: string; section: React.ReactNode }) {
	const { backdrop_path } = media.details
	const backdropUrl = backdrop_path ? tmdbImageUrl(backdrop_path, "w300") : ""
	const { activeSections, sectionProps, navigateToSection: scrollToSection } = useScrollSections({ sections })
	const { layOutAll } = useBelowFold()
	const navigateToSection = (s: Section) => {
		layOutAll()
		scrollToSection(s)
	}
	return (
		<>
			{backdrop_path && (
				<div
					className="pointer-events-none absolute top-0 z-0 h-full w-full"
					aria-hidden="true"
					style={{ backgroundImage: `url(${backdropUrl})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(64px) brightness(0.17)" }}
				/>
			)}
			<DetailsHeader media={media} country={country} activeSections={activeSections} navigateToSection={navigateToSection} />
			<DetailsSideNav activeSections={activeSections} navigateToSection={navigateToSection} />
			<DetailsHero media={media} country={country} episodeGrid={null} sectionProps={sectionProps} />
			<div className="isolate">
				<DetailsFingerprint media={media} sectionProps={sectionProps.fingerprint} />
			</div>
			{section}
			<div className="isolate flex flex-col items-center">
				<div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8">
					<DetailsContent media={media} country={country} sectionProps={sectionProps} navigateToSection={navigateToSection} />
				</div>
			</div>
		</>
	)
})

// --- State panel ---

/** Hosts other than this page's own that the page has requested so far: the ones the title page uses anyway (TMDB
 * artwork, analytics), and every other one, which only an embed's player brings. */
const PAGE_HOST = /tmdb\.org|googletagmanager|google-analytics|posthog|sentry/
function useThirdPartyHosts(clicked: boolean) {
	const [hosts, setHosts] = useState<{ page: string[]; embeds: string[] }>({ page: [], embeds: [] })
	useEffect(() => {
		const page = new Set<string>()
		const embeds = new Set<string>()
		const add = (entries: PerformanceEntryList) => {
			for (const entry of entries) {
				let host = ""
				try {
					host = new URL(entry.name).host
				} catch {
					continue
				}
				if (!host || host === location.host) continue
				if (PAGE_HOST.test(host)) page.add(host)
				else embeds.add(host)
			}
			setHosts({ page: [...page].sort(), embeds: [...embeds].sort() })
		}
		add(performance.getEntriesByType("resource"))
		const observer = new PerformanceObserver((list) => add(list.getEntries()))
		observer.observe({ type: "resource", buffered: false })
		return () => observer.disconnect()
	}, [])
	return { ...hosts, clicked }
}

function StatePanel({ sources, toggle, loaded }: { sources: Set<SourceKey>; toggle: (s: SourceKey) => void; loaded: Set<string> }) {
	const [open, setOpen] = useState(false)
	const hosts = useThirdPartyHosts(loaded.size > 0)
	const skipped = ITEMS.filter((item) => item.skip)
	return (
		<div className="fixed bottom-36 right-3 z-50 max-w-[calc(100vw-1.5rem)] text-sm text-black md:bottom-6" data-panel>
			{open ? (
				<div className="w-80 max-w-full rounded-2xl bg-white p-3 shadow-2xl ring-2 ring-fuchsia-500">
					<div className="flex items-center justify-between">
						<span className="font-bold">Section state</span>
						<button type="button" onClick={() => setOpen(false)} className="rounded px-2 hover:bg-neutral-200" aria-label="Close panel">
							×
						</button>
					</div>
					<p className="mt-2 text-xs font-semibold text-neutral-600">Players loaded: {loaded.size}</p>
					<p className="mt-2 text-xs font-semibold text-neutral-600">Hosts contacted by the embeds ({hosts.embeds.length})</p>
					<p className="text-xs">{hosts.embeds.length ? hosts.embeds.join(", ") : "none: every facade is text and the title's own artwork"}</p>
					<p className="mt-2 text-xs font-semibold text-neutral-600">Other hosts the page itself uses ({hosts.page.length})</p>
					<p className="text-xs text-neutral-500">{hosts.page.join(", ") || "none"}</p>
					<p className="mt-3 text-xs font-semibold text-neutral-600">Sources</p>
					<div className="mt-1 flex flex-wrap gap-1">
						{SOURCE_ORDER.map((source) => (
							<button
								type="button"
								key={source}
								onClick={() => toggle(source)}
								className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${sources.has(source) ? "bg-neutral-900 text-white ring-neutral-900" : "bg-white text-neutral-500 ring-neutral-300 line-through"}`}
							>
								{VENDORS[source].name}
							</button>
						))}
					</div>
					<p className="mt-3 text-xs font-semibold text-neutral-600">Left out ({skipped.length})</p>
					<ul className="list-disc pl-4 text-xs text-neutral-600">
						{skipped.map((item) => (
							<li key={item.id}>{item.skip}</li>
						))}
					</ul>
				</div>
			) : (
				<button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 font-semibold shadow-2xl ring-2 ring-fuchsia-500">
					<span className={`h-2 w-2 rounded-full ${hosts.embeds.length ? "bg-amber-500" : "bg-emerald-500"}`} />
					Embed hosts: {hosts.embeds.length}
				</button>
			)}
		</div>
	)
}

