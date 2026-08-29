export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow">No network</p>
      <h1 className="mt-3 font-serif text-2xl text-brand-gold">Cached shell</h1>
      <p className="mt-3 max-w-sm text-sm text-brand-slate">
        BLACKMIRROR is running from the device cache. Open a session from the
        inspections list — field data is stored in IndexedDB until signal returns.
      </p>
      <a
        href="/inspections"
        className="mt-8 border border-brand-gold px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold"
      >
        Open inspections
      </a>
    </div>
  );
}
