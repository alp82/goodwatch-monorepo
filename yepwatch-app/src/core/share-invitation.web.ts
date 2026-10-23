export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'manual';
/** Call directly from the tap so browser user activation is retained. */
export async function shareInvitation(url: string): Promise<ShareResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Join my YepWatch room', url });
      return 'shared';
    } catch (error) {
      // Dismissing the sheet is intentional; don't copy unexpectedly.
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'manual';
  }
}
