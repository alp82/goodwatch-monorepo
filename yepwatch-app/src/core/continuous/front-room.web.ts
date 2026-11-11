/**
 * Web: the address is the memory. A reloaded tab, or a closed one the browser reopens, is already at
 * the room's address; a start page typed or opened on purpose stays the start page.
 */
export async function loadFrontRoom(): Promise<string | null> { return null; }
export async function saveFrontRoom(_roomId: string | null) { /* nothing to remember */ }
