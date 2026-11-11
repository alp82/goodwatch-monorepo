/** Carry the local editor's words across admission without putting them in the address. */
let draft: { roomId: string; text: string } | null = null;
export function rememberMoodDraft(roomId: string, text: string) { draft = { roomId, text }; }
export function readMoodDraft(roomId: string) {
  if (draft?.roomId !== roomId) return '';
  return draft.text;
}
export function clearMoodDraft(roomId: string) { if (draft?.roomId === roomId) draft = null; }
