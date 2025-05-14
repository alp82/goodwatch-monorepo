import type React from "react"

export interface UserActionDetails {
	tmdb_id: number
	media_type: "movie" | "tv"
}

export interface UserActionProps {
	children: React.ReactElement
	details: UserActionDetails
	onChange?: () => void
}
