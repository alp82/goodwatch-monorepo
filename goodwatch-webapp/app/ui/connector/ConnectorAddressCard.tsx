import { ArrowRightIcon } from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"
import { CopyField } from "~/ui/connector/CopyField"
import { CONNECTOR_URL, USE_WITH_AI_PATH } from "~/ui/connector/connector"

// The connector address to copy, and the way to the step-by-step setup on /use-with-ai. Under the list of apps in
// the Connected apps tab (#570).
export function ConnectorAddressCard({
	title = "Connect a new app",
	helpLink = true,
}: {
	title?: string
	helpLink?: boolean
}) {
	return (
		<div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 sm:p-5">
			<p className="font-semibold text-gray-100">{title}</p>
			<p className="mt-1 text-sm text-gray-400">
				In Claude, ChatGPT or another AI app, add GoodWatch with this address.
				You sign in to GoodWatch and allow it once.
			</p>
			<div className="mt-3">
				<CopyField text={CONNECTOR_URL} label="Copy the connector address" />
			</div>
			{helpLink && (
				<Link
					to={USE_WITH_AI_PATH}
					prefetch="intent"
					className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-500 hover:text-amber-400"
				>
					Step by step for Claude, ChatGPT and more
					<ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
				</Link>
			)}
		</div>
	)
}
