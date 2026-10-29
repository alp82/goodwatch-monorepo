// The little living room's pages without their code in the site's first load: the error boundary is in root, so a
// direct import would put the room in every page's scripts. The server and the first paint show a dark room-sized
// block with the page's heading for screen readers and crawlers; the browser then loads the room. If its code can't
// load, the plain error page takes over.
import { Component, type ReactNode, Suspense, lazy, useEffect, useState } from "react"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

const NotFoundTv = lazy(reloadOnStaleChunk(() => import("./NotFoundTv")))
const ErrorTv = lazy(reloadOnStaleChunk(() => import("./ErrorTv")))
const SignedOutTv = lazy(reloadOnStaleChunk(() => import("./SignedOutTv")))

class Fallback extends Component<{ plain: ReactNode; children: ReactNode }, { failed: boolean }> {
	state = { failed: false }
	static getDerivedStateFromError() {
		return { failed: true }
	}
	render() {
		return this.state.failed ? this.props.plain : this.props.children
	}
}

/** The scene's size before the room loads, so nothing moves when it does. */
function Blank() {
	return <div className="bg-[#1a0f0a]" style={{ height: "calc(100svh - 64px)" }} />
}

export function LazyTv({
	page,
	heading,
	path,
	plain,
}: {
	page: "not-found" | "error" | "signed-out"
	/** The page's H1: the room shows everything else on its TV. */
	heading: string
	/** The broken address, for the 404's guesses. */
	path?: string
	/** What shows if the room's code can't load. */
	plain: ReactNode
}) {
	const [browser, setBrowser] = useState(false)
	useEffect(() => setBrowser(true), [])
	return (
		<div className="w-full">
			<h1 className="sr-only">{heading}</h1>
			{browser ? (
				<Fallback plain={plain}>
					<Suspense fallback={<Blank />}>
						{page === "not-found" ? <NotFoundTv path={path ?? ""} /> : page === "error" ? <ErrorTv /> : <SignedOutTv />}
					</Suspense>
				</Fallback>
			) : (
				<Blank />
			)}
		</div>
	)
}
