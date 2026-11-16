import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { analytics } from './analytics';

export function useAnalytics(pathname: string, visible: boolean, tasteOpen: boolean) {
  useEffect(() => {
    if (visible) analytics.screen(tasteOpen ? '/taste' : pathname);
  }, [pathname, visible, tasteOpen]);
  useEffect(() => {
    if (!visible || Platform.OS === 'web') return;
    analytics.event('app_open');
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') analytics.event('app_open');
    });
    return () => subscription.remove();
  }, [visible]);
}
