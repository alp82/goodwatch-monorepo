import { ChevronLeftIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import { type ProfilePart, type ProfileShell, seesPart } from "~/domain/profile"
import { WRAP } from "~/ui/my-pages/bits"
import { assetUrl } from "~/utils/asset-url"
// The parts of every profile tab under the profile header (ProfileHeader.tsx): the picture, the tab's small head (the
// header holds the h1), the notice in place of a part the viewer may not see, and the About block (bio, links, since)
// at the top of a visitor's Taste profile. Nothing here may widen a phone's layout.
import { LINK_SERVICE_INFO, linkUrl } from "./links"
import { HiddenPart } from "./parts"

const AVATAR_GRADIENT: Record<string, [string, string, string]> = {
	amber: ["#fbbf24", "#b45309", "#451a03"],
	rose: ["#fb7185", "#be123c", "#4c0519"],
	violet: ["#a78bfa", "#6d28d9", "#2e1065"],
	sky: ["#38bdf8", "#0369a1", "#082f49"],
	emerald: ["#34d399", "#047857", "#022c22"],
	slate: ["#e2e8f0", "#64748b", "#0f172a"],
}

export function ProfileAvatar({
	handle,
	avatar,
	size = "lg",
}: {
	handle: string
	avatar: ProfileShell["avatar"]
	size?: "sm" | "md" | "lg"
}) {
	const box = {
		sm: "size-11 text-lg ring-2",
		md: "size-16 text-3xl ring-4",
		lg: "size-14 text-2xl ring-4 sm:size-20 sm:text-4xl",
	}[size]
	const cls = `${box} shrink-0 rounded-full ring-gray-950 shadow-xl`
	if (avatar.url)
		return (
			<img
				src={avatar.url}
				alt=""
				data-member-avatar
				className={`${cls} object-cover object-top`}
			/>
		)
	const [from, to, ink] = AVATAR_GRADIENT[avatar.color] ?? AVATAR_GRADIENT.amber
	return (
		<span
			aria-hidden
			className={`${cls} flex items-center justify-center font-extrabold`}
			style={{
				background: `linear-gradient(135deg, ${from}, ${to})`,
				color: ink,
			}}
		>
			{handle.charAt(0).toUpperCase()}
		</span>
	)
}

/** A tab's small head under the profile header: its name, a line, and its keys at the end ("Rate more", Share). */
export function TabHead({
	title,
	line,
	back,
	links,
}: {
	title: string
	line?: ReactNode
	/** A way back to the page above ("‹ Scores"). */
	back?: { label: string; to: string }
	links?: ReactNode
}) {
	return (
		<div className={`${WRAP} flex flex-wrap items-end gap-x-4 gap-y-2 pt-5 pb-4`}>
			<div className="min-w-0 flex-1 basis-60">
				{back && (
					<Link
						to={back.to}
						prefetch="intent"
						className="-ml-1 mb-0.5 inline-flex min-h-8 items-center gap-0.5 pr-2 text-sm text-gray-400 hover:text-white"
					>
						<ChevronLeftIcon className="size-4" aria-hidden />
						{back.label}
					</Link>
				)}
				<h2 className="text-xl font-bold text-white md:text-2xl">{title}</h2>
				{line && <p className="mt-0.5 text-sm text-gray-400">{line}</p>}
			</div>
			{links && (
				<div className="flex shrink-0 flex-wrap items-center gap-2">{links}</div>
			)}
		</div>
	)
}

/** "2019-03" → "March 2019". */
export const monthYear = (ym: string) => {
	const [y, m] = ym.split("-").map(Number)
	return new Date(Date.UTC(y, (m || 1) - 1, 1)).toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	})
}

function LinkLogos({ shell }: { shell: ProfileShell }) {
	const links = shell.links.filter((l) => l.value.trim())
	if (!links.length) return null
	return (
		<ul className="flex gap-1.5">
			{links.map((l) => {
				const service = LINK_SERVICE_INFO[l.service]
				return (
					<li key={l.service}>
						<a
							href={linkUrl(l)}
							rel="noreferrer me nofollow noopener"
							target="_blank"
							aria-label={`${service.name} profile (opens in a new tab)`}
							title={`${service.name} (opens in a new tab)`}
							className="flex size-9 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/15 hover:bg-white/[0.12] sm:size-10"
						>
							{service.logo ? (
								<img
									src={assetUrl(service.logo)}
									alt=""
									className="size-5 object-contain"
								/>
							) : (
								<span className="text-sm font-black text-gray-200">
									{service.letter}
								</span>
							)}
						</a>
					</li>
				)
			})}
		</ul>
	)
}


/** A visitor's first look at whose profile this is: the bio, the links and since when. Nothing when all are empty. */
export function ProfileAbout({ shell }: { shell: ProfileShell }) {
	const links = shell.links.some((l) => l.value.trim())
	if (!shell.bio && !links && !shell.since) return null
	return (
		<div className="flex flex-wrap items-center gap-x-6 gap-y-3">
			<div className="min-w-0 flex-1 basis-72">
				{shell.bio && (
					<p className="max-w-2xl text-base text-gray-200">{shell.bio}</p>
				)}
				{shell.since && (
					<p className="text-sm text-gray-400">
						On GoodWatch since {monthYear(shell.since)}
					</p>
				)}
			</div>
			<LinkLogos shell={shell} />
		</div>
	)
}

const PART_NAMES: Record<ProfilePart, string> = {
	scores: "their scores",
	seen: "what they've seen",
	wishlist: "their Wishlist",
	shows: "their shows",
	lists: "their lists",
	taste: "their taste",
	hours: "their time watched",
	activity: "their activity",
}

/**
 * A profile tab's body: its small head and the page, or the notice when the viewer may not see the tab's part. The
 * profile header and the Taste row above it come from the profile layout (routes/u.$handle.tsx).
 */
export function ProfileTabPage({
	shell,
	title,
	line,
	links,
	part,
	children,
}: {
	shell: ProfileShell
	/** The tab's name in its small head; leave it out for a tab without one. */
	title?: string
	line?: ReactNode
	/** Keys at the head's end, such as the Share menu. */
	links?: ReactNode
	part?: ProfilePart
	children: ReactNode
}) {
	const allowed = !part || seesPart(shell, part)
	return (
		<div className="text-white">
			{title && (
				<TabHead
					title={title}
					line={allowed ? line : undefined}
					links={allowed ? links : undefined}
				/>
			)}
			{allowed ? (
				children
			) : (
				<div className={`${WRAP} pt-8 pb-32`}>
					<HiddenPart
						handle={shell.handle}
						part={part ? PART_NAMES[part] : ""}
						members={
							!!part &&
							shell.visibility[part] === "members" &&
							shell.viewer === "guest"
						}
					/>
				</div>
			)}
		</div>
	)
}
