// Prices and budgets (docs/spec/01 § 4): the budget per post entered and computed (BOM × last purchase prices + standard hours ×
// hourly rates, D-7) with their gap, the sale price from the price list in force (D-14, euros), the margin, and the totals of a
// configuration. Pure; amounts in k€.
import type { BomLine } from './bom';
import { BUDGET_POSTS, isHourPost, type BudgetPost } from './vocab';

export interface BudgetEntry {
  post: BudgetPost;
  enteredKeur: number;
  hours: number | null;
  basis: string | null;
}

export interface BudgetRow {
  post: BudgetPost;
  enteredKeur: number;
  /** Computed value, null when the post has no basis (subcontracting, expenses: entered only). */
  computedKeur: number | null;
  gapKeur: number | null;
  basis: string | null;
}

export type Rates = Record<'engineering_hours' | 'workshop_hours' | 'site_hours', number>;

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Material cost of a BOM at the last purchase prices; null when an article has no price. */
export function materialOf(bom: readonly BomLine[], prices: ReadonlyMap<string, number>): number | null {
  let total = 0;
  for (const l of bom) {
    const p = prices.get(l.article);
    if (p == null) return null;
    total += p * l.quantity;
  }
  return r1(total);
}

/** Budget rows of a machine version or an option: entered vs computed per post, in the order of BUDGET_POSTS. */
export function budgetRows(entries: readonly BudgetEntry[], material: number | null, rates: Rates): BudgetRow[] {
  return BUDGET_POSTS.flatMap((post) => {
    const e = entries.find((x) => x.post === post);
    if (!e) return [];
    const computed = post === 'material' ? material : isHourPost(post) && e.hours != null ? r1((e.hours * rates[post]) / 1000) : null;
    return [{ post, enteredKeur: e.enteredKeur, computedKeur: computed, gapKeur: computed == null ? null : r1(computed - e.enteredKeur), basis: e.basis }];
  });
}

export const budgetTotal = (rows: readonly BudgetRow[]) => r1(rows.reduce((n, r) => n + r.enteredKeur, 0));
export const computedTotal = (rows: readonly BudgetRow[]) => r1(rows.reduce((n, r) => n + (r.computedKeur ?? r.enteredKeur), 0));

/** Margin rate (sale − budget) / sale, as a share; null without a sale price or a budget. */
export const marginRate = (sale: number | null | undefined, budget: number | null | undefined) =>
  sale && budget != null ? Math.round(((sale - budget) / sale) * 1000) / 1000 : null;

export interface PriceListLite {
  id: string;
  code: string;
  state: string;
  validFrom: string;
  validTo: string;
}

/** The published price list in force on a day (the latest start when two overlap). */
export function listInForce<T extends PriceListLite>(lists: readonly T[], day: string): T | null {
  return [...lists].filter((l) => l.state === 'published' && l.validFrom <= day && l.validTo >= day).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0] ?? null;
}

export { r1 as round1 };
