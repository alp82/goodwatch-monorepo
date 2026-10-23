import { Share } from 'react-native';
export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'manual';
export async function shareInvitation(url: string): Promise<ShareResult> {
  try {
    const result = await Share.share({ message: url });
    return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
  } catch {
    return 'manual';
  }
}
