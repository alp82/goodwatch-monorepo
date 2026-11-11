import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { continuousApi as api, RoomFailure } from '../../core/continuous/api';
import { useAccount, signOut } from '../../core/continuous/account';
import { roomRegistry } from '../../core/continuous/room-registry';
import type { DeletionRecovery } from '../../core/continuous/room-registry-store';
import { deletionStateSchema, type DeletionState } from '../../core/continuous/deletion-state';
import { loadAccess } from '../../core/credentials';
import { queryClient } from '../../core/providers';
import { AppFrame } from '../shell/Frame';
import { Action } from '../shell/parts';
import { GText, glow } from '../glow/theme';
import { LegalLinks } from './LegalLinks';

const isGone = (error: unknown) => error instanceof RoomFailure && (error.status === 404 || error.status === 410);
export function DeleteAccount() {
  const account = useAccount();
  const [recovery, setRecovery] = useState<DeletionRecovery | null>(null);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const deletion = useQuery({ queryKey: ['account-deletion', account.generation], enabled: account.member, retry: false,
    queryFn: async () => { const result = await api.deletionStatus(); if (!result.accountTag) throw new Error('Could not verify the YepWatch account for deletion.'); return { accountTag: result.accountTag, deletion: result.deletion ? deletionStateSchema.parse(result.deletion) : null }; } });
  useEffect(() => { void roomRegistry.recovery().then(setRecovery).catch(() => setError('Could not read the recovery copy. Please retry.')); }, []);
  const remote = deletion.data?.deletion;
  const state = remote ?? (recovery?.confirmed ? recovery.state : null);
  const deleteData = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      if (account.member && !deletion.data) throw new Error('Wait until your YepWatch account has been verified before deleting it.');
      const saved = await roomRegistry.prepareDeletion(account.member ? 'account' : 'guest', account.member ? deletion.data!.accountTag : undefined);
      let deadline: DeletionState = { requestedAt: Date.now(), purgeAfter: Date.now() + 30 * 86400_000, phase: 'pending', recoveryId: 'device-only' };
      if (account.member) deadline = deletionStateSchema.parse((await api.deleteAccount()).deletion);
      else for (const room of saved.snapshot.rooms) {
        if (room.expiresAt <= Date.now()) continue;
        const access = await loadAccess(room.roomId);
        if (!access) throw new Error('A room credential is missing. Contact support before deleting this device’s records.');
        try { deadline = deletionStateSchema.parse((await api.deleteGuest(access)).deletion); }
        catch (e) { if (!isGone(e)) throw e; }
      }
      await roomRegistry.confirmDeletion(deadline);
      if (account.member || account.lapsed) await signOut();
      queryClient.clear();
      setRecovery(await roomRegistry.recovery()); setConfirm('');
      setMessage('Your YepWatch deletion is scheduled. Your GoodWatch account is unchanged.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Deletion has not been confirmed. Retry or sign in to check its status.'); }
    finally { setBusy(false); }
  };
  const restore = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      if (recovery?.kind === 'guest') {
        for (const room of recovery.snapshot.rooms) {
          if (room.expiresAt <= Date.now()) continue;
          const access = await loadAccess(room.roomId);
          if (access) try { await api.restoreGuest(access); } catch (e) { if (!isGone(e)) throw e; }
        }
      } else {
        if (!account.member || !remote) throw new Error('Sign in with the same account to find your scheduled YepWatch deletion.');
        if (recovery && (deletion.data?.accountTag !== recovery.accountTag || (recovery.confirmed && remote.recoveryId !== recovery.state.recoveryId))) throw new Error('This device’s recovery copy belongs to a different deletion. Sign in with the original account.');
        await api.restoreAccount();
      }
      await roomRegistry.restoreDeletion();
      setRecovery(null); setMessage('Your YepWatch data is restored. Expired rooms stay expired.');
      await queryClient.invalidateQueries();
    } catch (e) { setError(e instanceof Error ? e.message : 'Restoration has not been confirmed. Please retry.'); }
    finally { setBusy(false); }
  };
  return <AppFrame header={{ back: () => router.canGoBack() ? router.back() : router.replace('/') }} width={680} gap={20} testID="delete-account-page">
    <GText size={30} bold>Delete YepWatch account</GText>
    <GText size={16} style={{ lineHeight: 25 }}>This affects only YepWatch. Your GoodWatch account, ratings and viewing records stay intact.</GText>
    <GText size={16} style={{ lineHeight: 25 }}>We remove you from active rooms and hide your YepWatch profile and history. You have 30 days to restore your data. After that, a cleanup job permanently removes it. Other people keep their own decisions.</GText>
    {state ? <View style={{ gap: 14 }}>
      <GText bold size={20}>Deletion scheduled</GText>
      <GText>Recovery deadline: {new Date(state.purgeAfter).toLocaleString()}</GText>
      <GText color={glow.muted}>Signing in does not cancel deletion. Use Restore explicitly. Expired rooms cannot be reopened.</GText>
      {state.phase === 'pending' && state.purgeAfter > now ? <>
        {recovery?.kind === 'guest' || (account.member && remote) ? <Action label="Restore YepWatch data" onPress={() => void restore()} disabled={busy} gold />
          : <Action label="Sign in to restore YepWatch data" onPress={() => void account.signIn('/delete-account')} disabled={busy || account.busy} />}
      </> : <GText>Permanent removal has started. Recovery is no longer available.</GText>}
    </View> : <View style={{ gap: 14 }}>
      {!account.member ? <><GText color={glow.muted}>Sign in to delete account data across devices. Without sign-in, this deletes the guest data remembered on this device/browser only.</GText>
        <Action label="Sign in to delete account data" onPress={() => void account.signIn('/delete-account')} disabled={busy || account.busy} /></> : null}
      <GText>Type DELETE to confirm.</GText>
      <TextInput accessibilityLabel="Type DELETE to confirm" value={confirm} onChangeText={setConfirm} autoCapitalize="characters" autoCorrect={false}
        style={{ minHeight: 48, padding: 12, color: glow.ink, borderWidth: 1, borderColor: glow.line, borderRadius: 10 }} />
      <Action label={account.member ? 'Delete YepWatch account' : 'Delete this device’s YepWatch data'} onPress={() => void deleteData()} disabled={busy || !account.ready || (account.member && !deletion.data) || confirm !== 'DELETE'} />
    </View>}
    {busy ? <GText>Confirming your request…</GText> : null}
    {message ? <View accessibilityRole="alert"><GText color={glow.amber}>{message}</GText></View> : null}
    {error || account.error || deletion.error ? <View accessibilityRole="alert"><GText color="#fca5a5">{error || account.error || (deletion.error instanceof Error ? deletion.error.message : '')}</GText></View> : null}
    <LegalLinks />
  </AppFrame>;
}
