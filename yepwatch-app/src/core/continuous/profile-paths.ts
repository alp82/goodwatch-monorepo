import { API_PREFIX, paths } from '@goodwatch/yepwatch-contracts/proposal';

/**
 * Requests that carry the taste profile header: the profile's own routes and the admissions that seat this device in
 * a room (create, join), where the server links the device's profile to its place there. Returns (`resume`, which a
 * member's create is followed by at once) and room reads don't, for now: each link takes the room's write turn on the
 * server, and two links of a new profile within Crate's refresh second answer 503 "Profile is busy"
 * (proposal-taste-profile.ts touch() reads by `id = ANY(?)`, which doesn't see a row inserted less than a second ago).
 * `LINK_AGAIN` turns them on once the server links without that race. Nothing else sees the header.
 */
const LINK_AGAIN = false;
export function carriesProfile(path: string, method: 'GET' | 'POST' | 'DELETE'): boolean {
  const [bare, query = ''] = path.split('?');
  if (bare === paths.profile || bare.startsWith(`${paths.profile}/`)) return true;
  if (bare === paths.rooms) return method === 'POST';
  const room = bare.startsWith(`${API_PREFIX}/rooms/`) ? bare.slice(API_PREFIX.length + 7).split('/') : null;
  if (!room || !room[0]) return false;
  // Whole reads only (opening a room), never the own-part reads after each live update (`?known=`).
  if (room.length === 1) return LINK_AGAIN && method === 'GET' && !new URLSearchParams(query).has('known');
  return room.length === 2 && method === 'POST' && (room[1] === 'join' || (LINK_AGAIN && room[1] === 'resume'));
}
