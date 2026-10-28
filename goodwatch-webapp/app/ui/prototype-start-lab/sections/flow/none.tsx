// PROTOTYPE (start page lab) · Round 17: opening flow "none": today's page (the chosen stage, no boot screen). LabPage
// renders the stage itself for this key; the component is never used.
import type { BlockVariant } from "../../lab/types"

export const variant: BlockVariant = { key: "none", name: "None (today's page)", C: () => null }
