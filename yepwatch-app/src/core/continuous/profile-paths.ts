import { API_PREFIX, paths } from '@goodwatch/yepwatch-contracts/proposal';

/**
 * Requests that carry the taste profile header: the profile's own routes, the admissions that seat this device in a
 * room (create, join, resume), where the server links the device's profile to its place there after answering, and
 * whole room reads (opening a room). Own-part reads after a live update (`?known=`), commands and everything else
 * never see it.
 */
export function carriesProfile(path: string, method: 'GET' | 'POST' | 'DELETE'): boolean {
  const [bare, query = ''] = path.split('?');
  if (bare === paths.profile || bare.startsWith(`${paths.profile}/`)) return true;
  if (bare === paths.rooms) return method === 'POST';
  const room = bare.startsWith(`${API_PREFIX}/rooms/`) ? bare.slice(API_PREFIX.length + 7).split('/') : null;
  if (!room || !room[0]) return false;
  // Whole reads only (opening a room), never the own-part reads after each live update (`?known=`).
  if (room.length === 1) return method === 'GET' && !new URLSearchParams(query).has('known');
  return room.length === 2 && method === 'POST' && (room[1] === 'join' || room[1] === 'resume');
}
