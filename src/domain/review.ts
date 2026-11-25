// Offer review (D-8): is it required, and the checklist computed from the offer — amount beyond the threshold, margin ≥ the
// minimum, options "never done" or "to avoid", discount beyond the threshold (D-4: the general management validates too), the
// validity of the price list. The decision (go / no-go) and its author are recorded; the checklist is stored with it. Pure.
import type { FrozenConfiguration } from './offer';
import type { Settings } from './settings';

export interface ReviewItem {
  label: string;
  ok: boolean;
  detail: string;
}

export interface ReviewCheck {
  required: boolean;
  needsGeneralManagement: boolean;
  items: ReviewItem[];
  /** Options "never done" or "to avoid" (codes). */
  riskyOptions: string[];
}

export function reviewOf(c: FrozenConfiguration, s: Settings, o: { priceListValidTo: string | null; validUntil: string | null }): ReviewCheck {
  const risky = [...new Set(c.lines.flatMap((l) => l.options.filter((x) => x.level === 'never' || x.level === 'avoid').map((x) => x.code)))];
  const avoid = c.lines.flatMap((l) => l.options.filter((x) => x.level === 'avoid').map((x) => x.code));
  const margin = c.saleKeur > 0 ? Math.round(((c.saleKeur - c.budgetKeur) / c.saleKeur) * 1000) / 10 : null;
  const above = c.saleKeur > s.reviewAboveKeur;
  const needsGm = c.discountPct > s.discountGeneralPct;
  const items: ReviewItem[] = [
    { label: 'Amount beyond the review threshold', ok: true, detail: `${c.saleKeur} k€ / ${s.reviewAboveKeur} k€` },
    { label: 'Margin at or above the minimum', ok: margin != null && margin >= s.minMarginPct, detail: margin == null ? '—' : `${margin} % / ${s.minMarginPct} %` },
    { label: 'Options never done', ok: risky.length === avoid.length, detail: risky.filter((x) => !avoid.includes(x)).join(', ') || '—' },
    { label: 'Options to avoid', ok: avoid.length === 0, detail: avoid.join(', ') || '—' },
    { label: 'Discount within the threshold of the sales direction', ok: !needsGm, detail: `${c.discountPct} % / ${s.discountGeneralPct} %` },
    { label: 'Price list valid until the end of the offer', ok: !!o.priceListValidTo && (!o.validUntil || o.priceListValidTo >= o.validUntil), detail: o.priceListValidTo ?? '—' },
    { label: 'Every price and budget known', ok: c.gaps.length === 0, detail: c.gaps.join(', ') || '—' },
  ];
  return { required: above || risky.length > 0 || needsGm, needsGeneralManagement: needsGm, items, riskyOptions: risky };
}

export interface ReviewDecisionLite {
  /** sales_director | general_management */
  level: string;
  /** go | no_go */
  decision: string;
  decidedAt: Date;
}

/** Whether the latest decisions allow the offer to be sent (a go of each level required, the last word of each level counts). */
export function reviewCleared(check: ReviewCheck, decisions: readonly ReviewDecisionLite[]): boolean {
  if (!check.required) return true;
  const last = (level: string) => [...decisions].filter((d) => d.level === level).sort((a, b) => +b.decidedAt - +a.decidedAt)[0];
  if (last('sales_director')?.decision !== 'go') return false;
  return !check.needsGeneralManagement || last('general_management')?.decision === 'go';
}
