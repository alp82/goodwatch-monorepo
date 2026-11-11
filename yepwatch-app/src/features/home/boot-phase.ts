import { createContext } from "react";
/** boot: the cover hides the app. enter: it dissolves over the ready page. ready: done. */
export const BootPhase = createContext<"boot" | "enter" | "ready">("ready");
/**
 * A page that loads before it can be shown (see `bootPage`) calls this with its key once its first
 * content is ready, so the startup dissolves into a complete page.
 */
export const BootPageReady = createContext<(key: string) => void>(() => undefined);

/**
 * The startup waits for these pages to be ready: the start page, an invitation's join page and a room
 * (any of its pages). Other addresses show as soon as the app is up. A key per page, so readiness of a
 * page that is being replaced (the start page handing over to a room) never counts for the next one.
 */
export function bootPage(pathname: string): string | null {
  if (pathname === "/") return "home";
  const invite = /^\/r\/([^/]+)$/.exec(pathname);
  if (invite) return `invite:${invite[1]}`;
  const room = /^\/room\/([^/]+)/.exec(pathname);
  return room ? `room:${room[1]}` : null;
}
