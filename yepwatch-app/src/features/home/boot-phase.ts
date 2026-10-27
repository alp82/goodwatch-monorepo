import { createContext } from "react";
/** boot: the boot word covers the app. enter: it dissolves while the page builds in. ready: done. */
export const BootPhase = createContext<"boot" | "enter" | "ready">("ready");
/** The home page calls this once its first content is ready, so the boot dissolves into a complete page. */
export const BootPageReady = createContext<() => void>(() => undefined);
