// PROTOTYPE (Discover lab): the "titles" section. Round 20 locked g; the others live in git history.
import type { SectionVariant } from "../../types"
import { TitlesG } from "./g"

export const VARIANTS: SectionVariant[] = [{ key: "g", name: "Suggestions list", label: "Titles", searchButton: true, ownType: true, View: TitlesG }]
