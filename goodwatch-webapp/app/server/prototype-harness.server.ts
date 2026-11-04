// PROTOTYPE - throwaway (ui/discover/prototype-preferences/README.md). True only under
// scripts/prototype-discover-preferences.sh: a development server with no databases or credentials. Background jobs
// (import cleanup and reconciler, fingerprint population, title snapshot, warmups, metrics) don't start there at all.
// Production and every other server are unaffected.
export const prototypeHarness =
	process.env.NODE_ENV !== "production" &&
	process.env.GW_PROTOTYPE_DISCOVER_PREFERENCES === "1"
