// PROTOTYPE - throwaway. Props every fingerprint display variant receives.
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import type * as F from "~/ui/fingerprint/fingerprintText"

export type VariantProps = { t: F.TitleInput; media: MovieResult | ShowResult }
