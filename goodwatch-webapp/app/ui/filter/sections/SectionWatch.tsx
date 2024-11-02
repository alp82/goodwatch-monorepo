import React, { useEffect } from "react"
import type { DiscoverParams, WatchedType } from "~/server/discover.server"
import {
	type WatchOption,
	discoverFilters,
	watchOptions,
} from "~/server/types/discover-types"
import { GoogleSignInButton } from "~/ui/auth/GoogleSignInButton"
import EditableSection from "~/ui/filter/sections/EditableSection"
import RadioBlock from "~/ui/form/RadioBlock"
import { Tag } from "~/ui/tags/Tag"
import { Ping } from "~/ui/wait/Ping"
import { Spinner } from "~/ui/wait/Spinner"
import { useUser } from "~/utils/auth"
import { useNav } from "~/utils/navigation"

interface SectionWatchParams {
	params: DiscoverParams
	editing: boolean
	onEdit: () => void
	onClose: () => void
}

export default function SectionWatch({
	params,
	editing,
	onEdit,
	onClose,
}: SectionWatchParams) {
	const { user, loading } = useUser()
	const isUserLoggedIn = Boolean(user)

	// initialization

	const [watchedType, setWatchedType] = React.useState<WatchedType>(
		params.watchedType || watchOptions[0].name,
	)
	const selectedWatchOption = watchOptions.find(
		(option) => option.name === watchedType,
	)

	useEffect(() => {
		if (params.watchedType !== watchedType) {
			setWatchedType(params.watchedType)
		}
	}, [params.watchedType])

	// update handlers

	const { updateQueryParams } = useNav<Pick<DiscoverParams, "watchedType">>()

	useEffect(() => {
		if (editing && !params.watchedType) {
			updateQueryParams({
				watchedType: watchOptions[0].name,
			})
		}
	}, [editing])

	useEffect(() => {
		if (params.watchedType) return

		updateQueryParams({
			watchedType,
		})
	}, [watchedType])

	const handleChangeWatchedType = (watchOption: WatchOption) => {
		const watchedType = watchOption.name
		setWatchedType(watchedType)
		updateQueryParams({
			watchedType,
		})
	}

	const handleRemoveAll = () => {
		updateQueryParams({
			watchedType: undefined,
		})
		onClose()
	}

	// rendering

	return (
		<>
			<EditableSection
				label={discoverFilters.watch.label}
				color={discoverFilters.watch.color}
				visible={Boolean(params.watchedType)}
				active={isUserLoggedIn}
				editing={editing && isUserLoggedIn}
				onEdit={onEdit}
				onClose={onClose}
				onRemoveAll={handleRemoveAll}
			>
				{(isEditing) => (
					<div className="flex flex-col flex-wrap gap-2">
						{loading ? (
							<div className="relative h-8">
								<Ping size="small" />
							</div>
						) : isUserLoggedIn ? (
							<>
								{isEditing && (
									<RadioBlock
										options={watchOptions}
										value={selectedWatchOption}
										onChange={handleChangeWatchedType}
									/>
								)}
								<div className="flex flex-wrap items-center gap-2">
									<Tag
										color={selectedWatchOption?.color}
										icon={selectedWatchOption?.icon}
									>
										{selectedWatchOption?.label}
									</Tag>
								</div>
							</>
						) : (
							<div className="flex flex-col gap-4">
								<GoogleSignInButton />
								{discoverFilters.watch.loginInstructions}
							</div>
						)}
					</div>
				)}
			</EditableSection>
		</>
	)
}
