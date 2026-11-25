// Value tests of Modulus's pure rules: configurator, BOM, budgets and prices, review, know-how levels, working days, deals.
import { describe, expect, it } from 'vitest';
import { computeBom } from './bom';
import { evaluate, type CfgRule } from './configurator';
import { conversionRate, nextLetter, weightedPipeline } from './deals';
import { levelOf, proposeForCatalogue, unsoldSince, type Trace } from './knowhow';
import { priceConfiguration, priceLine } from './offer';
import { budgetRows, budgetTotal, computedTotal, listInForce, marginRate, materialOf } from './pricing';
import { closestCases, dueOn, lateDays, missingAnswers } from './quotes';
import { reviewCleared, reviewOf } from './review';
import { DEFAULT_SETTINGS, settingsOf } from './settings';
import { addWorkingDays, workingDaysBetween } from './working-days';

const O = (id: string) => ({ id, code: id, label: id });
const rule = (r: Partial<CfgRule> & Pick<CfgRule, 'id' | 'optionId' | 'kind'>): CfgRule => ({ targetOptionId: null, conditionKey: null, conditionOp: null, conditionValue: null, explanation: 'x', ...r });
const RULES = [
  rule({ id: 'r1', optionId: 'ENV1', kind: 'excludes', targetOptionId: 'ENV2' }),
  rule({ id: 'r2', optionId: 'CAP1', kind: 'requires', targetOptionId: 'SEC2' }),
  rule({ id: 'r3', optionId: 'AUT2', kind: 'one_of', targetOptionId: 'AUT3' }),
  rule({ id: 'r4', optionId: 'SEC1', kind: 'mandatory_if', conditionKey: 'capacity', conditionOp: '>=', conditionValue: 40 }),
];
const AVAIL = ['ENV1', 'ENV2', 'CAP1', 'SEC2', 'AUT2', 'AUT3', 'SEC1'].map(O);

describe('configurator', () => {
  it('a mandatory option comes with a large machine, a required one with its option', () => {
    const e = evaluate(AVAIL, RULES, ['CAP1'], { capacity: 40 });
    expect(e.selected.sort()).toEqual(['CAP1', 'SEC1', 'SEC2']);
    expect(e.state.SEC1.locked && e.state.SEC2.locked).toBe(true);
    expect(evaluate(AVAIL, RULES, [], { capacity: 20 }).selected).toEqual([]);
  });
  it('an exclusion disables, a pair that breaks a rule is a violation citing it', () => {
    expect(evaluate(AVAIL, RULES, ['ENV1'], {}).state.ENV2.disabled).toBe(true);
    const e = evaluate(AVAIL, RULES, ['AUT2', 'AUT3'], {});
    expect(e.violations.map((v) => v.ruleId)).toEqual(['r3']);
    expect(evaluate(AVAIL, RULES, ['ENV1', 'ENV2'], {}).violations[0]).toMatchObject({ kind: 'excludes', option: 'ENV1', target: 'ENV2' });
  });
  it('an option not available on the machine is dropped', () => {
    expect(evaluate([O('A')], [], ['A', 'B'], {}).selected).toEqual(['A']);
  });
});

describe('BOM of a configuration', () => {
  const base = [{ article: 'ART-1', designation: 'a', quantity: 1, unit: 'u' }, { article: 'ART-2', designation: 'b', quantity: 2, unit: 'u' }];
  it('adds, replaces, removes — computed, quantities × machines', () => {
    const r = computeBom(base, [
      { option: 'O1', op: 'replace', article: 'ART-3', designation: 'c', quantity: 1, unit: 'u', replaces: 'ART-1' },
      { option: 'O2', op: 'add', article: 'ART-2', designation: 'b', quantity: 1, unit: 'u', replaces: null },
      { option: 'O3', op: 'remove', article: 'ART-9', designation: 'z', quantity: null, unit: null, replaces: null },
    ], 3);
    expect(r.lines.map((l) => [l.article, l.quantity, l.origin])).toEqual([['ART-3', 3, 'O1'], ['ART-2', 9, null]]);
    expect(r.errors).toEqual(['O3: ART-9']);
  });
});

describe('budgets and prices (D-7, D-14)', () => {
  const rates = DEFAULT_SETTINGS.rates;
  it('entered and computed per post, with the gap', () => {
    const rows = budgetRows([
      { post: 'material', enteredKeur: 380, hours: null, basis: null },
      { post: 'workshop_hours', enteredKeur: 90, hours: 1600, basis: null },
      { post: 'expenses', enteredKeur: 19, hours: null, basis: null },
    ], 392, rates);
    expect(rows.map((r) => [r.post, r.computedKeur, r.gapKeur])).toEqual([['material', 392, 12], ['workshop_hours', 96, 6], ['expenses', null, null]]);
    expect(budgetTotal(rows)).toBe(489);
    expect(computedTotal(rows)).toBe(507);
  });
  it('material at the last purchase prices; unknown when an article has no price', () => {
    expect(materialOf([{ article: 'A', designation: '', quantity: 2, unit: 'u' }], new Map([['A', 9]]))).toBe(18);
    expect(materialOf([{ article: 'B', designation: '', quantity: 1, unit: 'u' }], new Map())).toBeNull();
  });
  it('the published list in force, margin rate', () => {
    const lists = [{ id: '1', code: 'G26', state: 'published', validFrom: '2026-01-01', validTo: '2026-12-31' }, { id: '2', code: 'G27', state: 'to_validate', validFrom: '2027-01-01', validTo: '2027-12-31' }];
    expect(listInForce(lists, '2026-11-24')?.code).toBe('G26');
    expect(listInForce(lists, '2027-02-01')).toBeNull();
    expect(marginRate(900, 640)).toBe(0.289);
  });
  it('a configuration priced: lines, discount, lead time = type + longest option', () => {
    const l = priceLine({ number: 1, machine: 'EMP-200', version: 3, label: 'x', quantity: 2, leadWeeks: 26, machineSaleKeur: 900, machineBudgetKeur: 640, bom: [],
      options: [{ code: 'A', label: 'a', origin: 'catalogue', saleKeur: 60, budgetKeur: 41, extraWeeks: 3, level: 'mastered' }, { code: 'B', label: 'b', origin: 'catalogue', saleKeur: 45, budgetKeur: 29, extraWeeks: 2, level: 'done' }] });
    expect([l.unitSaleKeur, l.unitBudgetKeur, l.leadWeeks]).toEqual([1005, 710, 29]);
    const c = priceConfiguration([l], { priceList: 'G', discountPct: 6, payment: null, currency: 'EUR', rate: null, assumptions: null, reservations: null });
    expect([c.grossSaleKeur, c.saleKeur, c.budgetKeur, c.gaps]).toEqual([2010, 1889.4, 1420, []]);
    const gap = priceLine({ ...l, options: [{ code: 'S', label: 's', origin: 'specific', saleKeur: null, budgetKeur: null, extraWeeks: 0, level: 'never' }] });
    expect(gap.unitSaleKeur).toBeNull();
  });
});

describe('offer review (D-8, D-4)', () => {
  const content = (sale: number, discount: number, level: 'never' | 'done') => priceConfiguration([priceLine({ number: 1, machine: 'M', version: 1, label: '', quantity: 1, leadWeeks: 10, machineSaleKeur: sale, machineBudgetKeur: sale * 0.7, bom: [],
    options: [{ code: 'X', label: '', origin: 'catalogue', saleKeur: 1, budgetKeur: 0.5, extraWeeks: 0, level }] })], { priceList: 'G', discountPct: discount, payment: null, currency: 'EUR', rate: null, assumptions: null, reservations: null });
  it('required beyond 150 k€ or with an option never done; a discount beyond 10 % needs the general management', () => {
    expect(reviewOf(content(100, 0, 'done'), DEFAULT_SETTINGS, { priceListValidTo: '2026-12-31', validUntil: '2026-12-01' }).required).toBe(false);
    expect(reviewOf(content(100, 0, 'never'), DEFAULT_SETTINGS, { priceListValidTo: null, validUntil: null }).required).toBe(true);
    const big = reviewOf(content(900, 12, 'done'), DEFAULT_SETTINGS, { priceListValidTo: '2026-12-31', validUntil: '2027-02-22' });
    expect([big.required, big.needsGeneralManagement]).toEqual([true, true]);
    expect(big.items.find((x) => x.label.startsWith('Price list'))!.ok).toBe(false);
    const at = (h: number) => new Date(2026, 10, 20, h);
    expect(reviewCleared(big, [{ level: 'sales_director', decision: 'go', decidedAt: at(9) }])).toBe(false);
    expect(reviewCleared(big, [{ level: 'sales_director', decision: 'go', decidedAt: at(9) }, { level: 'general_management', decision: 'go', decidedAt: at(10) }])).toBe(true);
    expect(reviewCleared(big, [{ level: 'sales_director', decision: 'go', decidedAt: at(9) }, { level: 'sales_director', decision: 'no_go', decidedAt: at(11) }, { level: 'general_management', decision: 'go', decidedAt: at(10) }])).toBe(false);
  });
});

describe('know-how levels (D-12)', () => {
  const t = (o: Partial<Trace>): Trace => ({ inCatalogue: true, quoted: 0, sold: 0, deliveries: [], avoidMarked: false, majorDifficulty: false, ...o });
  const d = (gap: number) => ({ gap, soldRef: 'CV' });
  it('from never done to mastered, and to avoid', () => {
    const s = DEFAULT_SETTINGS;
    expect(levelOf(t({}), s)).toBe('never');
    expect(levelOf(t({ quoted: 2 }), s)).toBe('quoted');
    expect(levelOf(t({ quoted: 1, sold: 1 }), s)).toBe('sold');
    expect(levelOf(t({ sold: 1, deliveries: [d(0.05)] }), s)).toBe('done');
    expect(levelOf(t({ sold: 3, deliveries: [d(0.02), d(0.03), d(0.05)] }), s)).toBe('mastered');
    expect(levelOf(t({ inCatalogue: false, sold: 3, deliveries: [d(0.02), d(0.03), d(0.05)] }), s)).toBe('done');
    expect(levelOf(t({ sold: 1, deliveries: [d(0.34)] }), s)).toBe('avoid');
    expect(levelOf(t({ avoidMarked: true }), s)).toBe('avoid');
    expect(levelOf(t({ sold: 1, deliveries: [d(0.34)] }), settingsOf({ avoidGapPct: 50 }))).toBe('done');
  });
  it('a specific option sold twice with a controlled gap is proposed; an option unsold for 24 months is flagged', () => {
    expect(proposeForCatalogue(t({ inCatalogue: false, sold: 2, deliveries: [d(0.02), d(0.14)] }), DEFAULT_SETTINGS)).toBe(true);
    expect(proposeForCatalogue(t({ inCatalogue: false, sold: 1, deliveries: [d(0.02)] }), DEFAULT_SETTINGS)).toBe(false);
    expect(unsoldSince(null, '2024-02-02', '2026-11-24', DEFAULT_SETTINGS)).toBe(true);
    expect(unsoldSince('2025-06-01', '2024-02-02', '2026-11-24', DEFAULT_SETTINGS)).toBe(false);
    expect(unsoldSince(null, '2026-01-01', '2026-11-24', DEFAULT_SETTINGS)).toBe(false);
  });
});

describe('quotation requests (D-11)', () => {
  it('working days skip the weekend', () => {
    expect(addWorkingDays('2026-11-13', 5)).toBe('2026-11-20');
    expect(addWorkingDays('2026-11-03', 15)).toBe('2026-11-24');
    expect(workingDaysBetween('2026-11-20', '2026-11-24')).toBe(2);
    expect(workingDaysBetween('2026-11-24', '2026-11-20')).toBe(-2);
  });
  it('due date, lateness, missing answers, closest cases', () => {
    expect(dueOn('2026-11-13', 5)).toBe('2026-11-20');
    expect(lateDays('2026-11-13', 5, '2026-11-24')).toBe(2);
    expect(lateDays('2026-11-20', 15, '2026-11-24')).toBe(0);
    expect(missingAnswers([{ id: 'a', text: '', required: true, theme: 'need' }, { id: 'b', text: '', required: false, theme: 'need' }], new Map([['a', ' ']])).map((x) => x.id)).toEqual(['a']);
    const cases = closestCases({ title: 'Dosage additif démarrage froid', category: 'automation', machine: 'EMP-200' }, [
      { code: 'X', label: 'Dosage additif continu', category: 'automation', machine: null },
      { code: 'Y', label: 'Cabine climatisée', category: 'comfort', machine: 'EMP-200' },
    ]);
    expect(cases.map((c) => c.code)).toEqual(['X']);
  });
});

describe('deals (D-2)', () => {
  it('weighted pipeline of the active deals, conversion rate, offer letters', () => {
    const ds = [
      { state: 'quoting' as const, amountKeur: 1000, probability: 60, closedOn: null },
      { state: 'won' as const, amountKeur: 500, probability: 100, closedOn: '2026-06-02' },
      { state: 'lost' as const, amountKeur: 900, probability: 0, closedOn: '2026-08-01' },
      { state: 'offer_sent' as const, amountKeur: null, probability: 50, closedOn: null },
    ];
    expect(weightedPipeline(ds)).toBe(600);
    expect(conversionRate(ds, '2025-11-24')).toEqual({ rate: 0.5, won: 1, closed: 2 });
    expect(nextLetter(['A', 'B'])).toBe('C');
  });
});
