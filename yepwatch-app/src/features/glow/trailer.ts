/** Only canonical YouTube identities enter either embedded player. */
export function youtubeId(value: string | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase();
    const id =
      host === 'youtu.be'
        ? u.pathname.slice(1)
        : ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(
            host
          )
        ? u.pathname === '/watch'
          ? u.searchParams.get('v')
          : u.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1]
        : null;
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
/** One external destination for native and web; discard embed, autoplay and tracking parameters. */
export function externalTrailerUrl(value: string | null): string | null {
  const id = youtubeId(value);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}
