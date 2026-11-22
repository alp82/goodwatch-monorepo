// The heavy display face (Gabarito 900, the `font-display` theme token) for big brand numbers and hero and card names,
// and the page width. Page h1s use `PageTitle` and section headings use `SectionHeading` (~/ui/heading)
// instead. On their own here so that a lazy chunk (the footer cinema, /stats, Watch next) can take them without bits.tsx
// and the sign-up prompt it brings.
export const DISPLAY = "font-display font-black tracking-[-0.03em]"
export const WRAP = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"

/** The profile's button box (height, padding, gap, text size). The main action is a `<PrimaryButton>` with it. */
export const BUTTON_BOX = "inline-flex min-h-10 items-center gap-1.5 px-4 text-sm"
