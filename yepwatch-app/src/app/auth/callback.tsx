import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { Button, Heading, Notice, Page } from '../../components/ui';
import { accountRedeeming, finishAccount, finishMember } from '../../core/continuous/member';
import { isAccountCallback } from '../../core/continuous/member-state';
import { accountSignedIn } from '../../core/continuous/account';

const linkGraceMs = 1000;

/**
 * A GoodWatch return link that opened the app by itself (the sign-in sheet usually catches it first).
 * Device sign-in goes back to the screen underneath; an older room-bound link reopens its room.
 */
export default function AuthCallback() {
  const url = Linking.useURL();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const leave = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };
    if (!url) {
      // Android hands a warm app's return link to both the sign-in sheet and the router. The router opens
      // this screen after the link event, so useURL stays null: the sheet redeems the link, this screen leaves.
      const timer = setTimeout(() => {
        void (accountRedeeming() ?? Promise.resolve()).catch(() => undefined).then(() => { if (active) leave(); });
      }, linkGraceMs);
      return () => { active = false; clearTimeout(timer); };
    }
    const done = isAccountCallback(url)
      ? finishAccount(url).then(accountSignedIn).then(() => { if (active) leave(); })
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
