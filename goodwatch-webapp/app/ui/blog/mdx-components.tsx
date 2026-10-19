// How a blog post's Markdown looks: the long-form classes of the privacy page and the about page, nothing new. The
// site has no typography plugin, so every element gets its classes here. The study's own pieces are in here too, so a
// post uses them by name without importing them.
// Footnotes ([^name] in a post) come from remark-gfm: a numbered link to an <li id> in a section at the end, and a
// link back. Their ids and data attributes pass through, so those links keep working.
import { Link } from "@remix-run/react"
import type { ComponentProps, ReactNode } from "react"
import { StudyChart } from "./StudyChart"
import {
	CountryTable,
	Downloads,
	KeyNumbers,
	StudyCredits,
	TitleLink,
	TitleRun,
} from "./StudyParts"

const linkClass = "font-semibold text-amber-500 hover:text-amber-400"

/** An id for a heading from its text, such as "free-with-ads" for "Free with ads". */
export const headingId = (children: ReactNode) =>
	typeof children === "string"
		? children
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-|-$/g, "")
		: undefined

// A file on the site, such as a CSV: a plain link the browser downloads, not a page the router opens.
const FILE = /\.[a-z0-9]{2,5}$/i

function Anchor({
	href = "",
	children,
	className,
	...rest
}: ComponentProps<"a">) {
	const footnote =
		"data-footnote-ref" in rest || "data-footnote-backref" in rest
	if (href.startsWith("#"))
		return (
			<a
				href={href}
				className={footnote ? "text-amber-500 hover:text-amber-400" : linkClass}
				{...rest}
			>
				{children}
			</a>
		)
	if (href.startsWith("/") && FILE.test(href))
		return (
			<a href={href} download className={linkClass} {...rest}>
				{children}
			</a>
		)
	if (href.startsWith("/"))
		return (
			<Link to={href} prefetch="intent" className={linkClass} {...rest}>
				{children}
			</Link>
		)
	return (
		<a
			href={href}
			className={linkClass}
			target="_blank"
			rel="noreferrer"
			{...rest}
		>
			{children}
		</a>
	)
}

export const postComponents = {
	h2: ({ children, className, id }: ComponentProps<"h2">) =>
		// The footnotes' own heading is visually hidden; keep it that way.
		className?.includes("sr-only") ? (
			<h2 id={id} className="sr-only">
				{children}
			</h2>
		) : (
			<h2
				id={id ?? headingId(children)}
				className="mt-14 mb-4 scroll-mt-24 text-2xl font-bold tracking-tight text-white"
			>
				{children}
			</h2>
		),
	h3: ({ children }: { children?: ReactNode }) => (
		<h3 className="mt-8 mb-2 text-xl font-bold tracking-tight text-white">
			{children}
		</h3>
	),
	p: ({ children }: { children?: ReactNode }) => (
		<p className="my-4 leading-relaxed">{children}</p>
	),
	ul: ({ children }: { children?: ReactNode }) => (
		<ul className="my-4 flex list-disc flex-col gap-2 pl-6 marker:text-amber-500">
			{children}
		</ul>
	),
	ol: ({ children }: { children?: ReactNode }) => (
		<ol className="my-4 flex list-decimal flex-col gap-2 pl-6 marker:text-gray-500">
			{children}
		</ol>
	),
	li: ({ children, id }: ComponentProps<"li">) => (
		<li id={id} className="scroll-mt-24 leading-relaxed">
			{children}
		</li>
	),
	sup: ({ children }: { children?: ReactNode }) => (
		<sup className="ml-0.5 text-xs font-semibold not-italic">{children}</sup>
	),
	section: ({ children, ...rest }: ComponentProps<"section">) =>
		"data-footnotes" in rest ? (
			<section
				aria-label="Footnotes"
				className="mt-12 border-t border-white/10 pt-4 text-sm text-gray-400"
			>
				{children}
			</section>
		) : (
			<section>{children}</section>
		),
	strong: ({ children }: { children?: ReactNode }) => (
		<strong className="font-semibold text-white">{children}</strong>
	),
	a: Anchor,
	Chart: StudyChart,
	CountryTable,
	Downloads,
	KeyNumbers,
	StudyCredits,
	TitleLink,
	TitleRun,
}
