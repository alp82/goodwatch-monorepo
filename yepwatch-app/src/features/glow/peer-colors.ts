import { createContext, useCallback, useContext } from 'react';
import { peerColor } from './model';

/** The room's roster (participant ids in join order, people who left included); null outside a room. */
export const PeerRoster = createContext<readonly string[] | null>(null);

/** A friend's color in this room (model.ts peerColor). */
export function usePeerColor() {
  const roster = useContext(PeerRoster);
  return useCallback((id: string) => peerColor(id, roster), [roster]);
}
