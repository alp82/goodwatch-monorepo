// PROTOTYPE - throwaway (prototype/explore-r5). The one contract of a place card, for every family. A page renders
// `<Part slot="card" {...card} href={...} />` and never needs to know which card variant is picked; a card variant
// reads what its design needs and ignores the rest. The types live in the kit (kit/types.ts), because the kit's own
// PlaceCard hands over to the picked card variant too.
export type { CardData, CardProps } from "../../kit/types"
