// How to get the ratings file out of IMDb. Shown below the upload.
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid"
import type { ReactNode } from "react"
import { IMDB_EXPORTS_URL, IMDB_RATINGS_URL } from "~/domain/imdb-import"
import { ImdbExportHowToLink } from "~/ui/imports/ImdbExportHowToLink"
import { FocusHeading } from "./FocusHeading"
import { secondaryButton } from "./shared"

function ImdbLink({ href, children }: { href: string; children: ReactNode }) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className={secondaryButton}
		>
			{children}
			<ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0" aria-hidden />
			<span className="sr-only">(opens in a new tab)</span>
		</a>
	)
}

function Step({ number, children }: { number: number; children: ReactNode }) {
	return (
		<li className="flex gap-3">
			<span
				aria-hidden
				className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-800 text-sm font-bold text-white"
			>
				{number}
			</span>
			<div className="flex min-w-0 flex-col items-start gap-2">{children}</div>
		</li>
	)
}

export function ImdbExportSteps({ focus = false }: { focus?: boolean }) {
	return (
		<section
			aria-labelledby="imdb-export-heading"
			className="flex flex-col gap-4"
		>
			<FocusHeading id="imdb-export-heading" focus={focus}>
				How to get your file from IMDb
			</FocusHeading>
			<ol className="flex flex-col gap-4">
				<Step number={1}>
					<p>
						Open your ratings on IMDb and choose{" "}
						<span className="font-semibold text-gray-100">Export</span>.
					</p>
					<ImdbLink href={IMDB_RATINGS_URL}>Open your IMDb ratings</ImdbLink>
				</Step>
				<Step number={2}>
					<p>
						Wait while IMDb prepares your file. This takes a few minutes. You
						can leave this page and come back when it's ready.
					</p>
				</Step>
				<Step number={3}>
					<p>Open your exports on IMDb and download the CSV file.</p>
					<ImdbLink href={IMDB_EXPORTS_URL}>Open IMDb exports</ImdbLink>
				</Step>
			</ol>
			<ImdbExportHowToLink className="self-start text-left font-semibold" />
			<p className="text-sm text-gray-400">
				Your IMDb ratings don't need to be public, and GoodWatch never asks for
				your IMDb password.
			</p>
		</section>
	)
}
