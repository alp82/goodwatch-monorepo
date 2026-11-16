/** Only these screen names can leave the device. Never forward route parameters or URLs. */
const pages: Record<string, string> = {
  '/': 'Home', '/new': 'Create room', '/privacy': 'Privacy', '/terms': 'Terms',
  '/support': 'Support', '/delete-account': 'Delete account', '/beta': 'Beta', '/taste': 'Taste',
};
const roomPages: Record<string, string> = {
  '': 'Room', mood: 'Room mood', room: 'Room settings', kinds: 'Room kinds',
  matches: 'Matches', services: 'Room services', streaming: 'Streaming',
};
export function analyticsScreen(pathname: string): { path: string; title: string } | null {
  const path = pathname.split(/[?#]/)[0].replace(/\/$/, '') || '/';
  if (pages[path]) return { path, title: pages[path] };
  if (/^\/r\/[^/]+$/.test(path)) return { path: '/invite', title: 'Join room' };
  const room = /^\/room\/[^/]+(?:\/([^/]+))?$/.exec(path);
  if (!room || !Object.hasOwn(roomPages, room[1] ?? '')) return null;
  const part = room[1] ?? '';
  return { path: `/room${part ? `/${part}` : ''}`, title: roomPages[part] };
}

export const analyticsEvents = ['room_created', 'room_joined', 'room_returned', 'round_started',
  'vote_submitted', 'proposal_submitted', 'agreement_submitted', 'match_interest_changed',
  'match_confirmation_submitted', 'favorite_submitted', 'room_left', 'app_open'] as const;
export type AnalyticsEvent = typeof analyticsEvents[number];
export type AnalyticsPayload = {
  type: 'pageview' | 'custom_event'; pathname: string; page_title: string; event_name?: AnalyticsEvent;
};
const commandEvents: Record<string, AnalyticsEvent> = {
  start: 'round_started', vote: 'vote_submitted', propose: 'proposal_submitted',
  agree: 'agreement_submitted', leave: 'room_left',
  set_in: 'match_interest_changed', confirm_in: 'match_confirmation_submitted', pick_favorite: 'favorite_submitted',
};
export function analyticsCommand(type: string): AnalyticsEvent | undefined { return Object.hasOwn(commandEvents, type) ? commandEvents[type] : undefined; }

/** No arbitrary properties, identifiers, free text, errors or command payloads are accepted. */
export function createAnalytics(enabled: () => boolean, send: (payload: AnalyticsPayload) => Promise<void>) {
  let screen: ReturnType<typeof analyticsScreen> = null;
  const deliver = (payload: AnalyticsPayload) => {
    try { if (enabled()) void send(payload).catch(() => undefined); } catch { /* Analytics cannot break the app. */ }
  };
  return {
    screen(pathname: string) {
      const next = analyticsScreen(pathname);
      if (screen?.path === next?.path) return;
      screen = next;
      if (screen) deliver({ type: 'pageview', pathname: screen.path, page_title: screen.title });
    },
    event(name: AnalyticsEvent) {
      if (!analyticsEvents.includes(name)) return;
      deliver({ type: 'custom_event', pathname: screen?.path ?? '/', page_title: screen?.title ?? 'Home', event_name: name });
    },
  };
}
