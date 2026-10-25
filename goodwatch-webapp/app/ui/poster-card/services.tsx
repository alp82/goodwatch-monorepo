// The streaming logos on a poster and in the quick view: only the services the member saved in their settings. A
// guest and a member without saved services see none, so a logo always means "you can watch it on a service you have".
import { useMemo } from "react"
import { useUserSettings } from "~/routes/api.user-settings.get"
import { TmdbImage } from "~/ui/TmdbImage"
import { useUser } from "~/utils/auth"
import { duplicateProviderMapping } from "~/utils/streaming-links"
import type { PartSize } from "./size"

/** One service that carries the title, in either shape the app's cards have it. */
export type ServiceOffer =
	| { id: number; name: string; logo_path: string | null }
	| {
			provider_id: number
			provider_name: string
			provider_logo_path: string | null
	  }

export interface PosterService {
	id: number
	name: string
	logoPath: string | null
}

const toService = (offer: ServiceOffer): PosterService =>
	"provider_id" in offer
		? {
				id: offer.provider_id,
				name: offer.provider_name,
				logoPath: offer.provider_logo_path,
			}
		: { id: offer.id, name: offer.name, logoPath: offer.logo_path }

/** A brand's other entries (Amazon Video under Amazon Prime Video) count as the saved one. */
const BASE_OF = new Map<number, number>(
	Object.entries(duplicateProviderMapping).flatMap(([base, copies]) =>
		copies.map((copy) => [copy, Number(base)] as const),
	),
)
const baseOf = (id: number) => BASE_OF.get(id) ?? id

/**
 * The viewer's saved service ids, each brand once by its main id; empty for a guest, for a member who saved none, and
 * while the settings load.
 */
export function useViewerServiceIds(): readonly number[] {
	const { user } = useUser()
	const settings = useUserSettings()
	const saved = user ? (settings.data?.streaming_providers_default ?? "") : ""
	return useMemo(
		() => [
			...new Set(
				saved
					.split(",")
					.map(Number)
					.filter((id) => Number.isInteger(id) && id > 0)
					.map(baseOf),
			),
		],
		[saved],
	)
}

/**
 * Which of a title's services are the viewer's. `applies` is false for a guest or a member without saved services:
 * show nothing then, not "Not on your services". With `applies`, an empty `yours` means the title is on none of them.
 */
export function useYourServices(
	offers: readonly ServiceOffer[] | null | undefined,
): {
	applies: boolean
	yours: PosterService[]
} {
	const ids = useViewerServiceIds()
	return useMemo(() => {
		if (!ids.length) return { applies: false, yours: [] }
		const mine = new Set(ids)
		const byBase = new Map<number, PosterService>()
		for (const offer of offers ?? []) {
			const service = toService(offer)
			const base = baseOf(service.id)
			if (mine.has(base) && !byBase.has(base)) byBase.set(base, service)
		}
		return { applies: true, yours: [...byBase.values()] }
	}, [ids, offers])
}

// The logo box and the "+N" per size; "auto" follows the card's container queries.
const BOX: Record<PartSize, string> = {
	S: "size-5 rounded",
	M: "size-5 rounded",
	L: "size-6 rounded-md",
	auto: "size-5 rounded",
}
const MORE_TEXT: Record<PartSize, string> = {
	S: "text-[10px] leading-4",
	M: "text-[10px] leading-4",
	L: "text-[11px] leading-5",
	auto: "text-[10px] leading-4",
}

/** How many logos a size shows before "+N": L three, M two, S none (no room beside the pill). */
export const LOGOS_SHOWN = { S: 0, M: 2, L: 3 } as const

/** A poster card's logos ("auto"): two from 11rem, one from 6rem, none under 6rem; "+N" from 7.5rem (~40% of the card). */
const CARD_LOGOS = 2

/**
 * A row of service logos. With `newOn` (#489, the service the title just arrived on for the viewer) that logo leads,
 * ringed in sky blue. `size="auto"` follows the card's width: none under 6rem, one from 6rem, two from 11rem, and
 * "+N" for the rest from 7.5rem.
 */
export function ServiceLogos({
	services,
	size = "auto",
	max,
	newOn,
	className = "",
}: {
	services: readonly PosterService[]
	size?: PartSize
	/** Overrides the size's number of logos. */
	max?: number
	newOn?: number | null
	className?: string
}) {
	if (!services.length || (size === "S" && max == null)) return null
	const ordered =
		newOn == null
			? services
			: [...services].sort(
					(a, b) =>
						Number(baseOf(b.id) === baseOf(newOn)) -
						Number(baseOf(a.id) === baseOf(newOn)),
				)
	const isNew = (service: PosterService) =>
		newOn != null && baseOf(service.id) === baseOf(newOn)
	const logo = (service: PosterService, extra = "") => (
		<TmdbImage
			key={service.id}
			kind="logo"
			path={service.logoPath}
			width={24}
			ratio={1}
			title={isNew(service) ? `New on ${service.name}` : service.name}
			alt={isNew(service) ? `New on ${service.name}` : service.name}
			className={`${BOX[size]} shrink-0 shadow shadow-black/50 ${isNew(service) ? "ring-2 ring-sky-400" : "ring-1 ring-black/40"} ${extra}`}
		/>
	)
	const more = (count: number, extra = "") =>
		count > 0 && (
			<span
				className={`rounded bg-gray-950/90 px-1 font-bold text-gray-200 ${MORE_TEXT[size]} ${extra}`}
				aria-label={`and ${count} more`}
			>
				+{count}
			</span>
		)

	if (size !== "auto" || max != null) {
		const shown = ordered.slice(
			0,
			max ?? LOGOS_SHOWN[size === "auto" ? "L" : size],
		)
		return (
			<span className={`flex items-center gap-1 ${className}`}>
				{shown.map((service) => logo(service))}
				{more(ordered.length - shown.length)}
			</span>
		)
	}
	// Auto: the second logo and the counts switch with the card's width.
	return (
		<span
			className={`hidden items-center gap-1 @min-[6rem]/card:flex ${className}`}
		>
			{ordered
				.slice(0, CARD_LOGOS)
				.map((service, index) =>
					logo(service, index > 0 ? "hidden @min-[11rem]/card:block" : ""),
				)}
			{more(
				ordered.length - 1,
				"hidden @min-[7.5rem]/card:inline @min-[11rem]/card:hidden",
			)}
			{more(ordered.length - CARD_LOGOS, "hidden @min-[11rem]/card:inline")}
		</span>
	)
}

/** The title's logos for the viewer's own services; nothing for a guest or a member without saved services. */
export function YourServiceLogos({
	offers,
	size = "auto",
	newOn,
	className,
}: {
	offers: readonly ServiceOffer[] | null | undefined
	size?: PartSize
	newOn?: number | null
	className?: string
}) {
	const { yours } = useYourServices(offers)
	return (
		<ServiceLogos
			services={yours}
			size={size}
			newOn={newOn}
			className={className}
		/>
	)
}
