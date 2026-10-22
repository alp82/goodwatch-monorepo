export interface StoredInvite {
  code: string;
  path: string;
}
const key = (id: string) => `yepwatch.v2.invite.${id}`;
/** An invitation is a private tab-scoped capability; never an account grant, bearer or analytics field. */
export async function saveInvite(id: string, invite: StoredInvite) {
  sessionStorage.setItem(key(id), JSON.stringify(invite));
}
export async function loadInvite(id: string): Promise<StoredInvite | null> {
  const raw = sessionStorage.getItem(key(id));
  return raw ? JSON.parse(raw) : null;
}
