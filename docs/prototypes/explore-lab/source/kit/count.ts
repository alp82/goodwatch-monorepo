// PROTOTYPE - throwaway (prototype/explore-r9). Counts as people read them: the same buckets as Discover's
// distribution bar and hide counts (`ui/discover-bar/hide-count.ts`): 0–9 as they are, then tens, hundreds, whole
// "k" and "M", never rounded up (25,412 → 25k). Round 9: the owner never wants exact counts like 25,412 on screen.
import { hideBucket } from "~/ui/discover-bar/hide-count"

export const count = (n: number): string => hideBucket(n).text
