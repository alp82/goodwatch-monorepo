export function Backdrop({ url }: { url: string }) {
  return (
    <div
      aria-hidden
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}
    >
      <div
        style={{
          position: 'absolute',
          inset: -30,
          backgroundImage: `url(${JSON.stringify(url)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'saturate(.35) blur(10px)',
          opacity: 0.5,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(180deg,rgba(6,6,6,.35) 0%,rgba(6,6,6,.1) 40%,rgba(6,6,6,.75) 100%)',
        }}
      />
    </div>
  );
}
