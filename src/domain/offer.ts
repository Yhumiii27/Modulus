// What an offer and a sold configuration freeze (docs/spec/02 § 2–3): per line the machine version, its options with their
// sale price, budget and know-how level, the BOM computed; the totals, discount, lead time, payment terms, currency and rate,
// assumptions and reservations. Pure: built from what the data layer computed; stored as is when the offer is sent (jsonb,
// immutable by trigger). Budgets are cost data (D-15): the publications for Arche never read them.
import type { ComputedBomLine } from './bom';
import type { KnowhowLevel, OptionOrigin } from './vocab';

export interface FrozenOption {
  code: string;
  label: string;
  origin: OptionOrigin;
  saleKeur: number | null;
  budgetKeur: number | null;
  extraWeeks: number;
  level: KnowhowLevel;
}

export interface FrozenLine {
  number: number;
  machine: string;
  version: number;
  label: string;
  quantity: number;
  machineSaleKeur: number | null;
  machineBudgetKeur: number | null;
  options: FrozenOption[];
  /** Unit sale price and budget of one machine with its options. */
  unitSaleKeur: number | null;
  unitBudgetKeur: number | null;
  leadWeeks: number;
  bom: ComputedBomLine[];
}

export interface FrozenConfiguration {
  priceList: string | null;
  lines: FrozenLine[];
  grossSaleKeur: number;
  discountPct: number;
  saleKeur: number;
  budgetKeur: number;
  leadWeeks: number;
  payment: { deposit: number; delivery: number; acceptance: number } | null;
  currency: string;
  rate: number | null;
  assumptions: string | null;
  reservations: string | null;
  /** What is still missing for the offer to be complete (a price, a budget, an answer to a quotation request). */
  gaps: string[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export interface LineInput {
  number: number;
  machine: string;
  version: number;
  label: string;
  quantity: number;
  leadWeeks: number;
  machineSaleKeur: number | null;
  machineBudgetKeur: number | null;
  options: FrozenOption[];
  bom: ComputedBomLine[];
}

/** A line priced: unit price = machine + options; lead time = the type's lead time + the longest extra of its options. */
export function priceLine(l: LineInput): FrozenLine {
  const sales = [l.machineSaleKeur, ...l.options.map((o) => o.saleKeur)];
  const budgets = [l.machineBudgetKeur, ...l.options.map((o) => o.budgetKeur)];
  return {
    ...l,
    unitSaleKeur: sales.some((x) => x == null) ? null : r1(sales.reduce<number>((n, x) => n + (x ?? 0), 0)),
    unitBudgetKeur: budgets.some((x) => x == null) ? null : r1(budgets.reduce<number>((n, x) => n + (x ?? 0), 0)),
    leadWeeks: l.leadWeeks + l.options.reduce((m, o) => Math.max(m, o.extraWeeks), 0),
  };
}

/** The configuration of a deal priced with a discount (D-4: a %, on the total). */
export function priceConfiguration(lines: readonly FrozenLine[], o: {
  priceList: string | null; discountPct: number; payment: FrozenConfiguration['payment']; currency: string; rate: number | null;
  assumptions: string | null; reservations: string | null;
}): FrozenConfiguration {
  const gaps: string[] = [];
  for (const l of lines) {
    if (l.machineSaleKeur == null) gaps.push(`${l.machine}: no sale price`);
    for (const x of l.options) if (x.saleKeur == null) gaps.push(`${x.code}: no sale price`);
  }
  if (!lines.length) gaps.push('no line');
  const gross = r1(lines.reduce((n, l) => n + (l.unitSaleKeur ?? 0) * l.quantity, 0));
  const budget = r1(lines.reduce((n, l) => n + (l.unitBudgetKeur ?? 0) * l.quantity, 0));
  return {
    priceList: o.priceList, lines: [...lines], grossSaleKeur: gross, discountPct: o.discountPct, saleKeur: r1(gross * (1 - o.discountPct / 100)), budgetKeur: budget,
    leadWeeks: lines.reduce((m, l) => Math.max(m, l.leadWeeks), 0), payment: o.payment, currency: o.currency, rate: o.rate, assumptions: o.assumptions,
    reservations: o.reservations, gaps,
  };
}

/** Amount in the offer's currency (D-14: the rate of the day, fixed in the offer). */
export const inCurrency = (keur: number, rate: number | null) => (rate ? r1(keur * rate) : keur);
