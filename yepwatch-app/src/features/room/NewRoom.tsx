import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { transientFailure, unanswered } from '../../core/continuous/backoff';
import { browserOffline, onBackOnline } from '../../core/continuous/network';
import { RoomFailure } from '../../core/continuous/api';
import { ConnectionDetails } from '../rooms/ConnectionDetails';
import { CreateRoom } from '../../core/continuous/create-room';
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
  const attempt = useRef<AbortController | null>(null);
  const cancel = useCallback(() => { attempt.current?.abort(); }, []);
  useFocusEffect(useCallback(() => { newRoomInFront(true); return () => { newRoomInFront(false); cancel(); }; }, [cancel]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') cancel(); });
    return () => { subscription.remove(); cancel(); };
  }, [cancel]);
  // Opened straight from an address: the room this draft becomes loads its code meanwhile.
  useEffect(preloadStartPages, []);
  const mutation = useMutation({
    networkMode: 'always',
    mutationFn: async (text: string) => {
      const controller = new AbortController();
      attempt.current = controller;
      const local = await roomRegistry.load();
      try { return await flow.save(text, { nickname: local.nickname ?? account.name ?? '', member: account.member, signal: controller.signal }); }
      catch (error) {
        if (controller.signal.aborted) { const cancelled = new Error('Room setup was interrupted.'); cancelled.name = 'AbortError'; throw cancelled; }
        throw error;
      }
    },
    onSuccess: (snapshot, submittedText) => {
      setText(submittedText);
      client.setQueryData(draftKey, { text: submittedText, retryAt: 0 });
      if (!attempt.current?.signal.aborted) router.replace({ pathname: '/room/[id]', params: { id: snapshot.shared.roomId } });
    },
    onError: async () => {
      try { client.setQueryData(draftKey, await flow.draft()); }
      catch { client.setQueryData(draftKey, { text: text ?? '', retryAt: flow.retryAt }); }
    },
  });
  const retrySeconds = useRetryCountdown(draft.data?.retryAt ?? 0);
  // Offline: the saved request goes again by itself as soon as the browser is back online.
  const resend = useRef(() => {});
  resend.current = () => {
    const failed = mutation.error;
    if (mutation.isError && failed?.name !== 'AbortError' && unanswered(failed) && mutation.variables !== undefined) mutation.mutate(mutation.variables);
  };
  useEffect(() => onBackOnline(() => resend.current()), []);
  const back = () => { cancel(); if (router.canGoBack()) router.back(); else router.replace('/'); };
  useBackAction(back);
  const failure = mutation.error;
  const cancelled = failure?.name === 'AbortError';
  const error = mutation.isError && !cancelled ? unanswered(failure) && browserOffline() ? 'You’re offline. Your room is saved and gets created when you’re back online.' : transientFailure(failure) ? 'Couldn’t reach YepWatch. Your request is saved. Try again.' : failure instanceof RoomFailure && failure.code !== 'catalog_unavailable'
    ? failure.message : 'Couldn’t save this mood. Try again; your text is kept.' : undefined;
  // Saved: the button keeps saying Saving… until the room replaces this screen (no frame of Create room again).
  const saving = mutation.isPending || mutation.isSuccess;
  return <MoodComposer first text={text ?? draft.data?.text ?? ''} onTextChange={setText} pick={(value) => mutation.mutate(value)} back={back}
    saving={saving} disabled={saving || retrySeconds > 0 || !account.ready || draft.isPending}
    error={error} details={error && failure instanceof RoomFailure && failure.diagnostic ? <ConnectionDetails diagnostic={failure.diagnostic} /> : undefined}
    action={retrySeconds ? `Retry in ${retrySeconds}s` : mutation.isError ? 'Try again' : 'Create room'} />;
}
