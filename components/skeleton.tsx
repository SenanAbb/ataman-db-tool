export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted ${className}`}
      aria-hidden="true"
    />
  );
}

export function SectionSkeleton({ label }: { label: string }) {
  return (
    <section className="mt-8">
      <p className="mb-3 text-xs text-foreground/60">Cargando {label}…</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="mt-4 h-64" />
    </section>
  );
}
