// Small server-compatible pieces of the pages: tabs driven by the URL, a notice, money that a role may not see.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { EyeSlash } from '@phosphor-icons/react/dist/ssr';
import { Callout } from '@/components/app/Callout';
import { fmtKeur } from '@/lib/format';
import type { Lang, T } from '@/i18n/translate';
import s from './pages.module.css';

export function Tabs({ base, current, tabs }: { base: string; current: string; tabs: { id: string; label: ReactNode }[] }) {
  return (
    <nav className={s.tabs} aria-label="Tabs">
      {tabs.map((x, i) => (
        <Link key={x.id} href={i === 0 ? base : `${base}${base.includes('?') ? '&' : '?'}tab=${x.id}`} className={`${s.tab} ${x.id === current ? s.tabOn : ''}`} aria-current={x.id === current ? 'page' : undefined} scroll={false}>
          {x.label}
        </Link>
      ))}
    </nav>
  );
}

export function Notice({ title, warn, children }: { title?: ReactNode; warn?: boolean; children?: ReactNode }) {
  return (
    <Callout variant={warn ? 'emphasis' : 'outlined'} tone={warn ? 'accent' : 'neutral'} alignStart role="note">
      <div>
        {title && <strong>{title}</strong>}
        {title && children ? ' — ' : null}
        {children}
      </div>
    </Callout>
  );
}

/** An amount in k€, or "hidden" for a role that may not see it (D-15, U-2). */
export function Money({ v, show, t, lang }: { v: number | null | undefined; show: boolean; t: T; lang: Lang }) {
  if (!show) return <span className={s.muted} title={t('Hidden for your profile')}><EyeSlash size={12} aria-hidden /> {t('hidden')}</span>;
  return <>{fmtKeur(v, lang)}</>;
}

export const pct = (share: number | null | undefined, lang: Lang) => (share == null ? '—' : `${(share * 100).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 1 })} %`);
