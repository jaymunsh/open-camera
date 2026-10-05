import { useState, type ReactNode } from 'react';

export function StudioDisclosure({ title, summary, initiallyOpen, children }: { title: string; summary: string; initiallyOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initiallyOpen);
  return <details className="studio-disclosure" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary><span>{title}</span><small>{summary}</small><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg></summary>
    <div className="studio-disclosure-body">{children}</div>
  </details>;
}
