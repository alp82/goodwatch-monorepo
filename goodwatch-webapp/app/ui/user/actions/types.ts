import type React from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"

export interface UserActionProps {
	children: React.ReactElement
	media: MovieResult | ShowResult
	onChange?: () => void
}
