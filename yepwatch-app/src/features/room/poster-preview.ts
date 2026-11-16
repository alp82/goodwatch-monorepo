import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { RoomSnapshot, RoomPosterPreview } from '@goodwatch/yepwatch-contracts/proposal';
import type { RoomAccess } from '../../core/credentials';
import { continuousApi } from '../../core/continuous/api';

/**
 * Only catalog inputs: a vote, presence tick or unrelated room revision never refetches posters. Each
 * person's seen setting and GoodWatch link are private, so they aren't in the shared snapshot: the server's
 * cache key covers them, and a change there shows on the next preview read.
 */
export function posterPreviewInputs(shared: RoomSnapshot['shared'] | undefined) {
  return JSON.stringify(shared ? [shared.screens, shared.constraints,
    shared.disabledServiceIds, shared.ideas.filter(i => i.on).map(i => [i.id, i.text, i.attributes]),
    shared.participants.map(p => [p.participantId, p.serviceIds, p.dropped]),
  ] : null);
}

export function usePosterPreview(access: RoomAccess | null | undefined, shared: RoomSnapshot['shared'] | undefined) {
  const inputs = posterPreviewInputs(shared);
  const [quietInputs, setQuietInputs] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setQuietInputs(inputs), 400);
    return () => clearTimeout(timer);
  }, [inputs]);
  const setup = Boolean(access && shared?.phase === 'setup' && !shared.candidates.length);
  const enabled = Boolean(setup && shared?.screens.some(s => s.country && s.confirmed && s.serviceIds.length) && quietInputs === inputs);
  const owner = `${access?.roomId}:${access?.participantId}`;
  const [last, setLast] = useState<{ owner: string; candidates: RoomPosterPreview['candidates'] } | null>(null);
  const preview = useQuery({
    queryKey: ['room-poster-preview', access?.roomId, access?.participantId, quietInputs],
    enabled,
    queryFn: async ({ signal }) => {
      if (!access) throw new Error('Room access required');
      const result = await continuousApi.roomPreview(access, signal);
      setLast({ owner, candidates: result.candidates });
      return result;
    },
    placeholderData: keepPreviousData,
    retry: false,
    // Stop on cards, or after three empty answers for these inputs. New inputs have their own query.
    refetchInterval: query => enabled && !query.state.data?.candidates.length && query.state.dataUpdateCount < 3 ? 10_000 : false,
  });
  if (!setup) return [];
  const cards = preview.isPlaceholderData && last?.owner !== owner ? undefined : preview.data?.candidates;
  return cards ?? (last?.owner === owner ? last.candidates : []);
}
