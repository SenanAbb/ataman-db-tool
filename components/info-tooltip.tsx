'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';

export function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="rounded-full p-0.5 text-foreground/40 hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent"
        aria-label="¿Qué hace esta consulta?"
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>
      {open ? (
        <span
          role="tooltip"
          className="absolute right-0 top-full z-30 mt-1 w-80 whitespace-normal rounded-md border border-border bg-card p-3 text-xs leading-relaxed text-foreground shadow-lg"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
