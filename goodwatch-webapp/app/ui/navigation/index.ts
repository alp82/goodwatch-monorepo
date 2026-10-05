// The site navigation while REC_NAVIGATION is on: the phone dock with Tonight's pick, the hub sheet and desktop
// Browse panel, the header, and the search entry. With the flag off, ui/main/Header.tsx and ui/nav/BottomNav.tsx serve.
export { HubDialog, SearchDialog } from "./LazyDialogs"
export { DockStrip, MobileDock, useHasDock } from "./MobileDock"
export { NavigationProvider } from "./NavigationContext"
export { SiteHeader } from "./SiteHeader"
