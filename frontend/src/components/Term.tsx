import { useId, useState, type ReactNode } from 'react';
import { GLOSSARY, type GlossaryKey } from '../lib/glossary';

/** A glossary term: dotted underline, definition on hover or keyboard focus. */
export function Term({ k, children }: { k: GlossaryKey; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const entry = GLOSSARY[k];
  return (
    <span
      className="term-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="term"
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
      >
        {children ?? entry.term}
      </button>
      {open && (
        <span role="tooltip" id={id} className="term-tip">
          <strong>{entry.term}</strong>
          {entry.text}
        </span>
      )}
    </span>
  );
}
