import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { Button, Heading, Notice, Page } from '../../components/ui';
import { finishAccount, finishMember } from '../../core/continuous/member';
import { isAccountCallback } from '../../core/continuous/member-state';
import { accountKey } from '../../core/continuous/account';
import { queryClient } from '../../core/providers';

/**
 * A GoodWatch return link that opened the app by itself (the sign-in sheet usually catches it first).
 * Device sign-in goes back to the screen underneath; an older room-bound link reopens its room.
 */
export default function AuthCallback() {
  const url = Linking.useURL();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!url) return;
    let active = true;
    const leave = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };
    const done = isAccountCallback(url)
      ? finishAccount(url).then((status) => { queryClient.setQueryData(accountKey, status); if (active) leave(); })
      : finishMember(url).then((id) => { if (active) router.replace({ pathname: '/room/[id]', params: { id } }); });
    done.catch(() => {
      if (active) setError('GoodWatch sign-in could not be verified. You are still signed in as before. Try again from Profile.');
    });
    return () => {
      active = false;
    };
  }, [url]);
  return (
    <Page>
      {error ? <>
        <Heading>Signing in with GoodWatch</Heading>
        <Notice error>{error}</Notice>
        <Button onPress={() => router.replace('/')}>Back to start</Button>
      </> : null}
    </Page>
  );
}
