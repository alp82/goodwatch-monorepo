// How a blog post's Markdown looks: the long-form classes of the privacy page and the about page, nothing new. The
// site has no typography plugin, so every element gets its classes here. The study's own pieces are in here too, so a
// post uses them by name without importing them.
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

function Anchor({ href = "", children, ...rest }: ComponentProps<"a">) {
	if (href.startsWith("/"))
		return (
			<Link to={href} prefetch="intent" className={linkClass}>
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
	h2: ({ children }: { children?: ReactNode }) => (
		<h2
			id={headingId(children)}
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
	li: ({ children }: { children?: ReactNode }) => (
		<li className="leading-relaxed">{children}</li>
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
