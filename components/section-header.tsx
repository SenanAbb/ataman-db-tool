export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {description ? <p className="mt-1 text-xs text-foreground/60">{description}</p> : null}
    </div>
  );
}
