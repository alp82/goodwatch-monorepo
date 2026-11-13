/** Apps open invitations without a web page: nothing was asked for early (see early-invite.web.ts). */
export function earlyInviteResponse(_url: string, _init: RequestInit, _fetcher: (url: string, init: RequestInit) => Promise<Response>): Promise<Response> | null {
  return null;
}
