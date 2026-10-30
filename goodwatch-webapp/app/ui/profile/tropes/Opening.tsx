// The open band's "What it is": the opening of the TV Tropes description, with TV Tropes' own links, spoilers covered
// until tapped (the general description belongs to no single title, so seen state doesn't apply), emphasis and lists.
// One link closes it: "Read it on TV Tropes" when the opening is the whole text, else "Keep reading on TV Tropes"
// with how many paragraphs follow. Spec: docs/implementation/trope-description-doc.md, step 3.
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid"
import { Fragment, useState } from "react"
import {
	type LinkRun,
	type MarkedText,
	type TropeOpening,
	markRuns,
} from "~/utils/trope-opening"

const LINK =
	"text-sky-200 underline decoration-sky-300/60 decoration-1 underline-offset-[3px] hover:text-sky-100 hover:decoration-sky-200"

function Parts({ run }: { run: LinkRun }) {
	return run.parts.map((p) =>
		p.em ? (
			<em key={p.key}>{p.text}</em>
		) : (
			<Fragment key={p.key}>{p.text}</Fragment>
		),
	)
}

function Links({ links, live }: { links: LinkRun[]; live: boolean }) {
	return links.map((run) =>
		run.href && live ? (
			<a
				key={run.key}
				href={run.href}
				target="_blank"
				rel="noreferrer"
				className={LINK}
			>
				<Parts run={run} />
				<span className="sr-only"> (opens TV Tropes in a new tab)</span>
			</a>
		) : (
			<Parts key={run.key} run={run} />
		),
	)
}

/** Covered until tapped; links inside stay plain text until then, so a tap never opens one by accident. */
function Spoiler({ links }: { links: LinkRun[] }) {
	const [open, setOpen] = useState(false)
	if (open) return <Links links={links} live />
	return (
		<button
			type="button"
			onClick={() => setOpen(true)}
			aria-label="Spoiler, tap to show"
			className="inline cursor-pointer rounded-sm bg-white/10 text-left blur-[4px] select-none"
		>
			<span aria-hidden>
				<Links links={links} live={false} />
			</span>
		</button>
	)
}

function Marked({ m }: { m: MarkedText }) {
	return markRuns(m).map((run) =>
		run.spoiler ? (
			<Spoiler key={run.key} links={run.links} />
		) : (
			<Links key={run.key} links={run.links} live />
		),
	)
}

export function DescriptionOpening({
	opening,
	url,
	className = "",
}: { opening: TropeOpening; url: string; className?: string }) {
	const { blocks, more } = opening
	return (
		<div className={className}>
			<div className="space-y-3 text-[16px] leading-relaxed text-gray-200 sm:text-[17px]">
				{blocks.map((b, i) =>
					b.kind === "list" ? (
						// biome-ignore lint/suspicious/noArrayIndexKey: blocks never reorder
						<ul key={i} className="space-y-1.5">
							{b.items.map((item, k) => (
								<li
									// biome-ignore lint/suspicious/noArrayIndexKey: items never reorder
									key={k}
									className="relative pl-4"
									style={
										item.depth
											? { marginLeft: `${item.depth * 1.25}rem` }
											: undefined
									}
								>
									<span
										aria-hidden
										className="absolute top-[0.7em] left-0.5 size-1.5 rounded-full bg-sky-400/60"
									/>
									<Marked m={item} />
								</li>
							))}
						</ul>
					) : b.kind === "heading" ? (
						<p
							// biome-ignore lint/suspicious/noArrayIndexKey: blocks never reorder
							key={i}
							className="pt-1 text-xs font-bold tracking-[0.12em] text-gray-400 uppercase"
						>
							{b.text}
						</p>
					) : (
						// biome-ignore lint/suspicious/noArrayIndexKey: blocks never reorder
						<p key={i}>
							<Marked m={b} />
						</p>
					),
				)}
			</div>
			{url && (
				<a
					href={url}
					target="_blank"
					rel="noreferrer"
					className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-sky-300 hover:text-sky-200"
				>
					{more ? "Keep reading on TV Tropes" : "Read it on TV Tropes"}
					{more > 0 && (
						<span className="font-normal text-gray-500">
							· {more} more {more === 1 ? "paragraph" : "paragraphs"}
						</span>
					)}
					<ArrowTopRightOnSquareIcon className="size-4" aria-hidden />
					<span className="sr-only">(opens in a new tab)</span>
				</a>
			)}
		</div>
	)
}
