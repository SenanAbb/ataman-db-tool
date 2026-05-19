interface Column<T> {
  key: keyof T;
  label: string;
  align?: 'left' | 'right';
  format?: (v: T[keyof T], row: T) => string;
}

interface Props<T extends object> {
  title?: string;
  columns: Column<T>[];
  rows: T[];
  empty?: string;
}

export function MetricTable<T extends object>({ title, columns, rows, empty }: Props<T>) {
  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      {title ? (
        <h3 className="border-b border-border px-4 py-2 text-sm font-medium text-foreground/80">
          {title}
        </h3>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted">
            <tr>
              {columns.map((c) => (
                <th
                  key={String(c.key)}
                  className={`px-4 py-2 font-medium text-foreground/80 ${
                    c.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-foreground/60">
                  {empty ?? 'Sin datos'}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="border-t border-border/40 hover:bg-muted/60">
                  {columns.map((c) => {
                    const raw = row[c.key];
                    const text = c.format ? c.format(raw, row) : String(raw);
                    const isNumeric = c.align === 'right';
                    return (
                      <td
                        key={String(c.key)}
                        className={`px-4 py-2 ${
                          isNumeric ? 'text-right font-mono tabular-nums' : 'text-left'
                        }`}
                      >
                        {text}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
