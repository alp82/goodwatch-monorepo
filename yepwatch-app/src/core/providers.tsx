import { QueryClient, QueryClientProvider, notifyManager, focusManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import { type ReactNode } from 'react';
// Native: a cache change (a live frame, a command's answer) renders in the same task, not a timer later.
// React Query batches through setTimeout(0), which React Native runs on the next frame (up to ~16 ms
// before a friend's vote shows); React still batches the updates of one task into one render.
if (Platform.OS !== 'web') notifyManager.setScheduler((run) => queueMicrotask(run));
if (Platform.OS !== 'web') focusManager.setEventListener((setFocused) => {
  setFocused(AppState.currentState === 'active');
  const subscription = AppState.addEventListener('change', state => setFocused(state === 'active'));
  return () => subscription.remove();
});
export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30000, refetchOnWindowFocus: false, refetchOnReconnect: false }, mutations: { retry: false } } });
export const roomKey = (id: string) => ['room', id] as const;
export function Providers({ children }: { children: ReactNode }) { return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>; }
