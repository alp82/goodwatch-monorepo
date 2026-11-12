import { useCallback, useEffect, useId, useState } from 'react';
import { AppState } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { transientFailure, unanswered } from '../../core/continuous/backoff';
import { browserOffline, onBackOnline } from '../../core/continuous/network';
import { OFFLINE_WORDS, QUIET_OUTAGE_MS, RECONNECTING_WORDS } from '../../core/continuous/connection-words';
import { useLate, useLateSince } from '../../core/useLate';
import { RoomFailure } from '../../core/continuous/api';
import { ConnectionDetails } from '../rooms/ConnectionDetails';
import { CreateRoom } from '../../core/continuous/create-room';
import { ResendResume } from '../../core/continuous/resend-resume';
import { newRoomSave } from './new-room-save';
import { useAccount } from '../../core/continuous/account';
import { roomRegistry } from '../../core/continuous/room-registry';
import { useRetryCountdown } from '../../core/continuous/useRetryCountdown';
import { MoodComposer } from './MoodComposer';
import { useBackAction } from '../shell/sheet-back';
import { newRoomInFront, preloadStartPages } from './nav';

/** The draft owns the screen until the complete create-and-save operation succeeds. */
export function NewRoom() {
  const account = useAccount();
  return <NewRoomDraft key={account.generation} account={account} />;
}

function NewRoomDraft({ account }: { account: ReturnType<typeof useAccount> }) {
  const [flow] = useState(() => new CreateRoom());
  const [text, setText] = useState<string | null>(null);
  const client = useQueryClient();
  const instance = useId();
  const draftKey = ['new-room-draft', account.generation, instance] as const;
  // Local and offline-aware: neither waits for React Query's online state (a paused create sat on Saving…).
  const draft = useQuery({ queryKey: draftKey, queryFn: () => flow.draft(), networkMode: 'always' });
  const [attempt] = useState(() => ({ current: null as AbortController | null }));
  // A slow or restarting server: the save keeps sending the same request by itself (create-room.ts). Offline:
  // an unanswered save goes again once the browser is back online. Both only while this page is in front:
  // leaving stops them (the saved request stays for a manual retry); the app out of the front (inactive or
  // background) pauses them until it is back (resend-resume.ts).
  const [resume] = useState(() => new ResendResume<string>());
  useFocusEffect(useCallback(() => { newRoomInFront(true); resume.focus(); return () => { newRoomInFront(false); resume.leave(); }; }, [resume]));
  // When the first failed attempt of this save began (null: none failed): drives the one connection line.
  const [troubleSince, setTroubleSince] = useState<number | null>(null);
  // Opened straight from an address: the room this draft becomes loads its code meanwhile.
  useEffect(preloadStartPages, []);
  const mutation = useMutation(newRoomSave({
    flow, resume, client, draftKey, text: () => text, setText, setTroubleSince, attempt,
    identity: async () => ({ nickname: (await roomRegistry.load()).nickname ?? account.name ?? '', member: account.member }),
    open: (id) => router.replace({ pathname: '/room/[id]', params: { id } }),
  }));
  useEffect(() => resume.connect({ send: mutation.mutate, abort: () => attempt.current?.abort() }), [resume, mutation.mutate, attempt]);
  const retrySeconds = useRetryCountdown(draft.data?.retryAt ?? 0);
  useEffect(() => onBackOnline(() => resume.online()), [resume]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => resume.appState(state));
    return () => { subscription.remove(); resume.leave(); };
  }, [resume]);
  const back = () => { resume.leave(); if (router.canGoBack()) router.back(); else router.replace('/'); };
  useBackAction(back);
  const failure = mutation.error;
  const cancelled = failure?.name === 'AbortError';
  const offline = mutation.isError && !cancelled && unanswered(failure) && browserOffline();
  // Offline says so only after the quiet period (connection-words.ts); the room is created by itself when back.
  const offlineLate = useLate(offline, QUIET_OUTAGE_MS);
  const error = mutation.isError && !cancelled ? offline ? (offlineLate ? OFFLINE_WORDS : undefined) : transientFailure(failure) ? 'Couldn’t reach YepWatch. Your request is saved. Try again.' : failure instanceof RoomFailure && failure.code !== 'catalog_unavailable'
    ? failure.message : 'Couldn’t save this mood. Try again; your text is kept.' : undefined;
  // Saved: the button keeps saying Saving… until the room replaces this screen (no frame of Create room again).
  // Paused (the app left the front mid-save, e.g. iOS inactive under Control Center): it goes again by itself
  // when back, so no frame of Try again meanwhile.
  const saving = mutation.isPending || mutation.isSuccess || (cancelled && resume.phase === 'paused');
  // Owner rule Q24a: nothing for an outage under QUIET_OUTAGE_MS, then one small line floating over the page
  // (no layout shift, no countdown); the room still opens by itself when the answer comes.
  const reconnecting = useLateSince(saving ? troubleSince : null, QUIET_OUTAGE_MS);
  return <MoodComposer first text={text ?? draft.data?.text ?? ''} onTextChange={setText} pick={(value) => resume.pick(value)} back={back}
    saving={saving} note={reconnecting ? RECONNECTING_WORDS : undefined} disabled={saving || retrySeconds > 0 || !account.ready || draft.isPending}
    error={error} details={error && failure instanceof RoomFailure && failure.diagnostic ? <ConnectionDetails diagnostic={failure.diagnostic} /> : undefined}
    action={mutation.isError ? 'Try again' : 'Create room'} />;
}

