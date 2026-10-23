import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { Button, Heading, Notice, Page } from '../../components/ui';
import { finishMember } from '../../core/continuous/member';
export default function AuthCallback() {
  const url = Linking.useURL();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!url) return;
    let active = true;
    void finishMember(url)
      .then((id) => {
        if (active) router.replace({ pathname: '/room/[id]', params: { id } });
      })
      .catch(() => {
        if (active)
          setError(
            'Account linking could not be verified. Your guest identity has not been replaced. Reopen your room to retry.'
          );
      });
    return () => {
      active = false;
    };
  }, [url]);
  return (
    <Page>
      <Heading>Signing in with GoodWatch</Heading>
      <Notice error={Boolean(error)}>{error || 'Verifying the sign-in for your room…'}</Notice>
      {error && <Button onPress={() => router.replace('/')}>Return to YepWatch</Button>}
    </Page>
  );
}
