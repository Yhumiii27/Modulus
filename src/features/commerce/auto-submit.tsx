'use client';
// A GET form that submits itself on every change (the configurator applies the rules server-side at each choice).
import type { ReactNode } from 'react';

export function AutoSubmitForm({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <form method="get" className={className} onChange={(e) => e.currentTarget.requestSubmit()}>
      {children}
    </form>
  );
}
