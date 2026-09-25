// Profile settings: claim a handle or change it, and set a display name. The handle is the public profile address,
// /u/:handle, where the person's shared lists appear.
import {
	CheckCircleIcon,
	ExclamationCircleIcon,
} from "@heroicons/react/20/solid"
import {
	json,
	type LoaderFunctionArgs,
	type MetaFunction,
} from "@remix-run/node"
import { Link, useLoaderData } from "@remix-run/react"
import React from "react"
import { useClaimHandle } from "~/routes/api.handle"
import { getProfileByUserId } from "~/server/share-lists/store.server"
import { profilePath } from "~/ui/share-card/links"
import { getUserIdFromRequest } from "~/utils/auth"
import { useHandleAvailability } from "~/ui/share-lists/useHandleAvailability"
import { HANDLE_HOLD_DAYS, HANDLE_MAX } from "~/utils/handles"

export { pageHeaders as headers } from "~/utils/headers"

const DISPLAY_NAME_MAX = 50

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await getUserIdFromRequest({ request })
	const profile = userId ? await getProfileByUserId(userId) : null
	return json(
		{
			profile: profile && {
				handle: profile.handle,
				displayName: profile.displayName,
			},
		},
		{ headers: { "Cache-Control": "private, no-store" } },
	)
}

export const meta: MetaFunction = () => [
	{ title: "Profile Settings | GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

export default function SettingsProfile() {
	const loaded = useLoaderData<typeof loader>()
	const [saved, setSaved] = React.useState(loaded.profile)
	const [handleInput, setHandleInput] = React.useState(saved?.handle ?? "")
	const [displayName, setDisplayName] = React.useState(saved?.displayName ?? "")
	const claim = useClaimHandle()

	const {
		handle,
		problem,
		isCurrent,
		checking,
		available,
		unavailable,
		checkFailed,
		unavailableReason,
	} = useHandleAvailability(handleInput, saved?.handle ?? null)

	const nameChanged =
		(displayName.trim() || null) !== (saved?.displayName ?? null)
	const changed = !isCurrent || nameChanged
	const canSave =
		!!handle && !problem && available && changed && !claim.isPending

	const onSubmit = (event: React.FormEvent) => {
		event.preventDefault()
		if (!canSave) return
		claim.mutate(
			{ handle, displayName: displayName.trim() || null },
			{
				onSuccess: (profile) => {
					setSaved({ handle: profile.handle, displayName: profile.displayName })
					setHandleInput(profile.handle)
					setDisplayName(profile.displayName ?? "")
				},
			},
		)
	}

	let status: React.ReactNode = null
	if (problem) status = <Status tone="error">{problem}</Status>
	else if (!handle) status = null
	else if (isCurrent)
		status = <Status tone="muted">This is your handle.</Status>
	else if (checking) status = <Status tone="muted">Checking…</Status>
	else if (checkFailed)
		status = (
			<Status tone="error">Couldn't check that handle. Try again.</Status>
		)
	else if (unavailable)
		status = (
			<Status tone="error">
				{unavailableReason}
			</Status>
		)
	else if (available)
		status = <Status tone="ok">@{handle} is available.</Status>

	return (
		<div className="px-2 md:px-4 lg:px-8">
			<form
				onSubmit={onSubmit}
				className="flex max-w-lg flex-col gap-6 text-base text-gray-300"
			>
				<div>
					<h2 className="font-bold tracking-tight text-gray-100 text-base sm:text-lg md:text-xl lg:text-2xl">
						Public profile
					</h2>
					<p className="mt-2 text-gray-400">
						Your handle is the address of your public profile, where the lists
						you share appear.
						{saved && (
							<>
								{" "}
								<Link
									to={profilePath(saved.handle)}
									className="font-semibold text-indigo-300 underline underline-offset-4 hover:text-indigo-200"
								>
									View your profile
								</Link>
							</>
						)}
					</p>
				</div>

				<div className="flex flex-col gap-1">
					<label
						htmlFor="profile-handle"
						className="text-sm font-medium text-gray-300"
					>
						Handle
					</label>
					<div className="flex items-center rounded-md bg-white shadow-sm focus-within:ring-2 focus-within:ring-indigo-500">
						<span className="pl-3 text-gray-500" aria-hidden>
							@
						</span>
						<input
							id="profile-handle"
							value={handleInput}
							onChange={(e) =>
								setHandleInput(e.target.value.replace(/\s/g, "").toLowerCase())
							}
							maxLength={HANDLE_MAX + 1}
							autoComplete="off"
							autoCapitalize="none"
							spellCheck={false}
							placeholder="your_handle"
							aria-describedby="profile-handle-status profile-handle-help"
							aria-invalid={!!problem || unavailable}
							className="block w-full min-w-0 rounded-md border-0 bg-transparent py-2 pr-3 pl-1 text-gray-800 focus:ring-0"
						/>
					</div>
					<div
						id="profile-handle-status"
						aria-live="polite"
						className="min-h-6"
					>
						{status}
					</div>
					<p id="profile-handle-help" className="text-sm text-gray-500">
						goodwatch.app/u/
						<span className="text-gray-300">{handle || "your_handle"}</span> · 3
						to 30 lowercase letters, digits, and underscores, starting with a
						letter.
					</p>
					{saved && !isCurrent && handle && (
						<p className="mt-2 border-l-4 border-blue-700 bg-blue-950 px-4 py-2 text-sm text-blue-200">
							Your profile and list links move to the new handle. For{" "}
							{HANDLE_HOLD_DAYS} days, links with @{saved.handle} redirect to
							it, and only you can switch back to @{saved.handle}.
						</p>
					)}
				</div>

				<div className="flex flex-col gap-1">
					<label
						htmlFor="profile-name"
						className="text-sm font-medium text-gray-300"
					>
						Display name{" "}
						<span className="font-normal text-gray-500">(optional)</span>
					</label>
					<input
						id="profile-name"
						value={displayName}
						onChange={(e) =>
							setDisplayName(e.target.value.slice(0, DISPLAY_NAME_MAX))
						}
						placeholder="How your name appears on your profile"
						className="block w-full rounded-md border-0 bg-white px-3 py-2 text-gray-800 shadow-sm focus:ring-2 focus:ring-indigo-500"
					/>
				</div>

				<div className="flex flex-wrap items-center gap-4">
					<button
						type="submit"
						disabled={!canSave}
						className="rounded-md border border-indigo-700 bg-indigo-700 px-4 py-2 font-medium text-gray-100 hover:bg-indigo-800 hover:text-white disabled:cursor-default disabled:opacity-50 disabled:hover:bg-indigo-700"
					>
						{claim.isPending
							? "Saving…"
							: saved
								? "Save changes"
								: "Claim handle"}
					</button>
					{claim.isError && <Status tone="error">{claim.error.message}</Status>}
					{claim.isSuccess && !changed && <Status tone="ok">Saved.</Status>}
				</div>
			</form>
		</div>
	)
}

function Status({
	tone,
	children,
}: { tone: "ok" | "error" | "muted"; children: React.ReactNode }) {
	const Icon =
		tone === "ok"
			? CheckCircleIcon
			: tone === "error"
				? ExclamationCircleIcon
				: null
	const color =
		tone === "ok"
			? "text-emerald-400"
			: tone === "error"
				? "text-red-400"
				: "text-gray-400"
	return (
		<p className={`flex items-center gap-1.5 text-sm ${color}`}>
			{Icon && <Icon className="size-4 shrink-0" aria-hidden />}
			{children}
		</p>
	)
}
