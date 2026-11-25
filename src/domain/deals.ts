// Deals (docs/spec/02 § 1, D-2: a simple pipeline): the transitions of a deal, the weighted pipeline and the indicators —
// computed, never stored (docs/spec/02 § 5). Pure.
import { ACTIVE_DEAL_STATES, type DealState } from './vocab';

/** Allowed manual transitions (won comes from the order; lost and abandoned need a reason). */
export const DEAL_NEXT: Record<DealState, readonly DealState[]> = {
  open: ['quoting', 'lost', 'abandoned'],
  quoting: ['offer_sent', 'lost', 'abandoned'],
  offer_sent: ['quoting', 'won', 'lost', 'abandoned'],
  won: [],
  lost: [],
  abandoned: [],
};

export const canMove = (from: DealState, to: DealState) => DEAL_NEXT[from].includes(to);

export interface DealKpi {
  state: DealState;
  amountKeur: number | null;
  probability: number;
  closedOn: string | null;
}

/** Σ amount × probability of the active deals, in k€. */
export const weightedPipeline = (deals: readonly DealKpi[]) =>
  Math.round(deals.filter((d) => ACTIVE_DEAL_STATES.includes(d.state)).reduce((n, d) => n + ((d.amountKeur ?? 0) * d.probability) / 100, 0));

/** Won / closed over the deals closed since `since` (ISO); null when none is closed. */
export function conversionRate(deals: readonly DealKpi[], since: string): { rate: number | null; won: number; closed: number } {
  const closed = deals.filter((d) => ['won', 'lost', 'abandoned'].includes(d.state) && d.closedOn && d.closedOn >= since);
  const won = closed.filter((d) => d.state === 'won').length;
  return { rate: closed.length ? Math.round((won / closed.length) * 1000) / 1000 : null, won, closed: closed.length };
}

/** The next free letter of an offer (A, B, … Z); null when 26 are used. */
export function nextLetter(used: readonly string[]): string | null {
  for (let i = 0; i < 26; i++) {
    const l = String.fromCharCode(65 + i);
    if (!used.includes(l)) return l;
  }
  return null;
}
