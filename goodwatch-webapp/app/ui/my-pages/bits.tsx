// Pieces My shows, My movies and My library share (#385): the page head with the ways to the other pages, the note
// for an empty list, a poster, and what a guest sees in place of a member's page.
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import type { SignUpMessage } from "~/ui/sign-up-prompt/messages"

/** The display face of the page names and the page width, as on Watch next (ui/watch-next/style.ts). Kept here so
 * that these pages do not pull that module out of the chunk the home and Watch next share. */
export const DISPLAY = "font-['Gabarito'] font-black tracking-[-0.03em]"
export const WRAP = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"
export const tmdbImage = (path: string, size: string) =>
	`https://image.tmdb.org/t/p/${size}${path}`

export const MY_SHOWS = "/my-shows"
export const MY_MOVIES = "/my-movies"
export const MY_LIBRARY = "/my-library"

export const plural = (n: number, one: string, many = `${one}s`) =>
	`${n.toLocaleString("en-US")} ${n === 1 ? one : many}`

export interface HeadLink {
	label: string
	to: string
}

/** A quiet key in a page's head that leads to one of the other pages. */
export const LinkKey = ({ link }: { link: HeadLink }) => (
	<Link
		to={link.to}
		prefetch="intent"
		className="inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-xl px-3 text-sm font-bold text-gray-300 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
	>
		{link.label}
		<ChevronRightIcon className="h-4 w-4" aria-hidden />
	</Link>
)

export function PageHead({
	name,
	line,
	links = [],
}: { name: string; line: ReactNode; links?: HeadLink[] }) {
	return (
		<header
			className={`${WRAP} flex flex-wrap items-end gap-x-6 gap-y-3 pb-4 pt-6`}
			data-page-head
		>
			<div className="min-w-0">
				<h1 className={`${DISPLAY} text-4xl text-white md:text-5xl`}>{name}</h1>
				<p className="mt-1 text-sm text-gray-400">{line}</p>
			</div>
			<span className="grow" />
			{links.map((link) => (
				<LinkKey key={link.to} link={link} />
			))}
		</header>
	)
}

export const Empty = ({
	title,
	children,
}: { title: string; children: ReactNode }) => (
	<div
		className="rounded-2xl border border-dashed border-white/15 p-6"
		data-empty
	>
		<h2 className={`${DISPLAY} text-2xl text-white`}>{title}</h2>
		<div className="mt-1 max-w-xl text-sm text-gray-400">{children}</div>
	</div>
)

export const Poster = ({
	path,
	size = "w92",
	className = "",
}: { path: string | null; size?: string; className?: string }) =>
	path ? (
		<img
			src={tmdbImage(path, size)}
			alt=""
			loading="lazy"
			decoding="async"
			className={`bg-white/5 object-cover ${className}`}
		/>
	) : (
		<span className={`block bg-white/10 ${className}`} />
	)

/**
 * What a guest sees on My shows and My library: the page's name, what it is, and the sign-up prompt. The pages hold
 * a member's watch state, which a guest does not have.
 */
export function GuestPage({
	name,
	line,
	words,
}: { name: string; line: string; words: SignUpMessage }) {
	return (
		<div className="pb-24" data-guest-page>
			<PageHead name={name} line={line} />
			<div className={WRAP}>
				<SignUpPrompt
					feature="watchNext"
					words={words}
					size="card"
					className="max-w-xl"
				/>
			</div>
		</div>
	)
}
