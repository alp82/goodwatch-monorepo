// The page a link-preview client gets for /new or a share link (NewPreviewData). Link previews read only its head;
// a person whose in-app browser looks like one is sent on to the page the link leads to.
import { Link, useNavigate } from "@remix-run/react"
import { useEffect } from "react"
import type { NewPreviewData } from "~/server/new-on-services-page.server"

export function NewPreviewPage({ data }: { data: NewPreviewData }) {
	const navigate = useNavigate()
	useEffect(() => {
		navigate(data.to, { replace: true })
	}, [navigate, data.to])
	return (
		<main className="mx-auto max-w-3xl px-4 py-16">
			<h1 className="text-3xl font-bold">{data.copy.heading}</h1>
			<p className="mt-4">
				<Link to={data.to} className="text-amber-400 underline">
					{data.copy.description}
				</Link>
			</p>
		</main>
	)
}
