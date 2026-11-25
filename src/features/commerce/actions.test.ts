// The Server Functions on a fresh demonstration database: rights checked server-side (U-1, U-2, D-4, D-15), the configurator
// rules applied again, the review required before sending (D-8), what is sent and sold frozen, the quotation flow, the
// audit trail written in the same transaction.
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { RoleKey } from '@/config/roles';
import { auditEntries, dealLineOptions, dealLines, deals, offers, options, quoteRequests, soldConfigurations, users } from '@/server/db/schema';
import { testDatabase, type TestDatabase } from '@/test/db';

let t: TestDatabase;
let as: { role: RoleKey; userId: string; name: string } = { role: 'sales', userId: '', name: '' };
let ids: Record<string, string> = {};

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/session', () => ({
  getViewer: async () => ({ userId: as.userId, name: as.name, email: 'x@demo.example', initials: 'XX', role: as.role, roles: [as.role], demo: true }),
}));

const fd = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
};
const actAs = (role: RoleKey, name: string) => { as = { role, userId: ids[name], name }; };
const FORBIDDEN = { ok: false, error: 'You do not have the right to do this' };

beforeAll(async () => {
  t = await testDatabase();
  ids = Object.fromEntries((await t.db.select().from(users)).map((u) => [u.name, u.id]));
});
afterAll(() => t.close());

describe('deals and offers', () => {
  let ref = '';
  it('an account manager opens a deal; case 1 needs a CAPEX need; a reader may not', async () => {
    const A = await import('./actions');
    actAs('reader', 'Anne Duval');
    expect(await A.createDealAction(null, fd({ saleCase: '3', prospectName: 'Démo', prospectCountry: 'FR', site: 'Site X', need: 'Une unité' }))).toEqual(FORBIDDEN);
    actAs('sales', 'Julien Faure');
    expect(await A.createDealAction(null, fd({ saleCase: '1', customer: '', prospectName: 'X', prospectCountry: 'FR', site: 'Site X', need: 'Une unité' }))).toEqual({ ok: false, error: 'Case 1 comes from the machine need of an Arche CAPEX' });
    expect(await A.createDealAction(null, fd({ saleCase: '3', prospectName: 'Carrière Essai', prospectCountry: 'fr', site: 'Carrière Essai', need: 'Une unité fixe 40 t/h', origin: 'tender', probability: '40' }))).toEqual({ ok: true });
    const [d] = await t.db.select().from(deals).where(eq(deals.ref, 'AF-2026-0052'));
    expect(d).toMatchObject({ saleCase: 3, state: 'open', ownerName: 'Julien Faure', origin: 'tender' });
    ref = d.ref;
  });

  it('the configurator rules are applied again: a mandatory option is imposed, an exclusion refused with the rule', async () => {
    const A = await import('./actions');
    actAs('sales', 'Julien Faure');
    expect(await A.saveLineAction(null, fd({ ref, machine: 'EMP-400', quantity: '1', options: ['OPT-ENV-01', 'OPT-ENV-02'] }))).toEqual({ ok: false, error: 'Rule broken: OPT-ENV-01 excludes OPT-ENV-02 — Les deux kits climatiques sont incompatibles' });
    expect(await A.saveLineAction(null, fd({ ref, machine: 'EMP-400', quantity: '1', options: ['OPT-CAP-01'] }))).toEqual({ ok: true });
    const [l] = await t.db.select().from(dealLines).innerJoin(deals, eq(deals.id, dealLines.dealId)).where(eq(deals.ref, ref));
    const opts = await t.db.select({ code: options.code }).from(dealLineOptions).innerJoin(options, eq(options.id, dealLineOptions.optionId)).where(eq(dealLineOptions.lineId, l.deal_lines.id));
    expect(opts.map((o) => o.code).sort()).toEqual(['OPT-CAP-01', 'OPT-SEC-01', 'OPT-SEC-02']);
    expect(l.deals.state).toBe('quoting');
  });

  it('an offer beyond 150 k€ is sent only after a review go; once sent it is frozen', async () => {
    const A = await import('./actions');
    actAs('sales', 'Julien Faure');
    expect(await A.createOfferAction(null, fd({ ref, discount: '5', validity: '60', currency: 'EUR' }))).toEqual({ ok: true });
    expect(await A.sendOfferAction(null, fd({ ref, letter: 'A' }))).toEqual({ ok: false, error: 'A review go of the sales direction is required' });
    expect(await A.reviewOfferAction(null, fd({ ref, letter: 'A', decision: 'go' }))).toEqual(FORBIDDEN);
    actAs('sales_director', 'Sophie Vidal');
    expect(await A.reviewOfferAction(null, fd({ ref, letter: 'A', decision: 'no_go' }))).toEqual({ ok: false, error: 'A no-go needs a comment' });
    expect(await A.reviewOfferAction(null, fd({ ref, letter: 'A', decision: 'go', comment: 'Marge correcte' }))).toEqual({ ok: true });
    actAs('sales', 'Julien Faure');
    expect(await A.sendOfferAction(null, fd({ ref, letter: 'A' }))).toEqual({ ok: true });
    const [o] = await t.db.select().from(offers).innerJoin(deals, eq(deals.id, offers.dealId)).where(and(eq(deals.ref, ref), eq(offers.letter, 'A')));
    expect(o.offers).toMatchObject({ state: 'sent', discountPct: 5 });
    expect(o.offers.totalSaleKeur).toBeGreaterThan(1300);
    expect(o.offers.content!.lines[0].options.map((x) => x.code)).toContain('OPT-SEC-01');
    expect(o.deals.state).toBe('offer_sent');
    expect(await A.updateOfferAction(null, fd({ ref, letter: 'A', discount: '9', validity: '60', currency: 'EUR' }))).toEqual({ ok: false, error: 'A sent offer is frozen: create a new offer' });
  });

  it('the order makes the sold configuration v1, frozen; an amendment is v2 with its reason', async () => {
    const A = await import('./actions');
    actAs('sales', 'Julien Faure');
    expect(await A.recordOrderAction(null, fd({ ref, letter: 'A', orderedOn: '2026-11-24', customerRef: 'BC-ESSAI-01' }))).toEqual({ ok: true });
    const [d] = await t.db.select().from(deals).where(eq(deals.ref, ref));
    expect(d).toMatchObject({ state: 'won', probability: 100 });
    const [cv] = await t.db.select().from(soldConfigurations).where(eq(soldConfigurations.dealId, d.id));
    expect(cv).toMatchObject({ version: 1, customerOrderRef: 'BC-ESSAI-01' });
    expect(await A.amendAction(null, fd({ ref: cv.ref, line: '1', add: ['OPT-SRV-01'], reason: 'Le client ajoute les pièces de rechange' }))).toEqual({ ok: true });
    const versions = await t.db.select().from(soldConfigurations).where(eq(soldConfigurations.ref, cv.ref));
    expect(versions.map((v) => v.version).sort()).toEqual([1, 2]);
    const v2 = versions.find((v) => v.version === 2)!;
    expect(v2.totalSaleKeur).toBeGreaterThan(cv.totalSaleKeur);
    expect(v2.amendmentReason).toBe('Le client ajoute les pièces de rechange');
    expect(await t.db.$count(auditEntries, eq(auditEntries.objectRef, `${cv.ref} v2`))).toBe(1);
  });

  it('a deal of another team is not found for an account manager (U-2)', async () => {
    const A = await import('./actions');
    actAs('sales', 'Julien Faure');
    expect(await A.updateDealAction(null, fd({ ref: 'AF-2026-0049', probability: '90', site: 'Site x', need: 'Une unité' }))).toEqual({ ok: false, error: 'Deal not found' });
  });
});

describe('quotation requests (docs/spec/03)', () => {
  it('opened on a deal, qualified once complete, estimated, answered: the specific option joins the line', async () => {
    const A = await import('./actions');
    actAs('sales', 'Julien Faure');
    expect(await A.createQuoteAction(null, fd({ deal: 'AF-2026-0047', title: 'Pesage embarqué', machine: 'MEMU-80', category: 'automation', cls: 'indicative' }))).toEqual({ ok: true });
    const [r] = await t.db.select().from(quoteRequests).where(eq(quoteRequests.ref, 'DC-2026-0022'));
    expect(r).toMatchObject({ state: 'qualification', targetDays: 5, origin: 'deal' });
    actAs('engineering', 'Marc Lenoir');
    expect(await A.qualifyQuoteAction(null, fd({ ref: r.ref, feasibility: 'feasible', level: 'never' }))).toEqual({ ok: false, error: 'The request is incomplete: required answers are missing' });
    expect(await A.saveAnswersAction(null, fd({ ref: r.ref }))).toEqual(FORBIDDEN);
    actAs('sales', 'Julien Faure');
    const { questions, questionnaires } = await import('@/server/db/schema');
    const qs = await t.db.select().from(questions).innerJoin(questionnaires, eq(questionnaires.id, questions.questionnaireId)).where(eq(questions.required, true));
    const mine = qs.filter((x) => x.questionnaires.id === r.commonQuestionnaireId || x.questionnaires.id === r.familyQuestionnaireId);
    const answers = Object.fromEntries(mine.map((x) => [`q_${x.questions.id}`, x.questions.answerType === 'number' ? '10' : x.questions.choices ? x.questions.choices.split('·')[0].trim() : 'oui']));
    expect(await A.saveAnswersAction(null, fd({ ref: r.ref, ...answers }))).toEqual({ ok: true });
    actAs('engineering', 'Marc Lenoir');
    expect(await A.qualifyQuoteAction(null, fd({ ref: r.ref, feasibility: 'feasible', level: 'never', note: 'Faisable' }))).toEqual({ ok: true });
    actAs('estimator', 'Camille Arnaud');
    expect(await A.answerQuoteAction(r.ref)).toEqual({ ok: false, error: 'Save the estimate first' });
    expect(await A.saveEstimateAction(null, fd({ ref: r.ref, material: '8', subcontracting: '0', engineeringHours: '40', workshopHours: '20', siteHours: '8', expenses: '1', sale: '18', weeks: '2', deltas: 'ART-910330; Capteur de pesage; 4; u' }))).toEqual({ ok: true });
    expect(await A.answerQuoteAction(r.ref)).toEqual({ ok: true });
    const [o] = await t.db.select().from(options).where(eq(options.code, 'SPE-2026-0022'));
    expect(o).toMatchObject({ origin: 'specific', extraWeeks: 2 });
    expect(await t.db.$count(dealLineOptions, eq(dealLineOptions.optionId, o.id))).toBe(1);
  });
});

describe('administration', () => {
  it('settings by the administrator only; price list validated by the sales direction', async () => {
    const A = await import('./actions');
    actAs('sales', 'Julien Faure');
    expect(await A.resetSettingsAction()).toEqual(FORBIDDEN);
    actAs('admin', 'Paul Vasseur');
    expect(await A.resetSettingsAction()).toEqual({ ok: true });
    actAs('estimator', 'Camille Arnaud');
    expect(await A.validatePriceListAction('GRILLE-2027')).toEqual(FORBIDDEN);
    actAs('sales_director', 'Sophie Vidal');
    expect(await A.validatePriceListAction('GRILLE-2027')).toEqual({ ok: true });
    expect(await A.validatePriceListAction('GRILLE-2027')).toEqual({ ok: false, error: 'Only a price list to validate can be validated' });
  });
  it('engineering publishes a draft version, which retires the version in force', async () => {
    const A = await import('./actions');
    actAs('estimator', 'Camille Arnaud');
    expect(await A.publishVersionAction('EMP-200')).toEqual(FORBIDDEN);
    actAs('engineering', 'Marc Lenoir');
    expect(await A.publishVersionAction('EMP-200')).toEqual({ ok: true });
    const { machineVersions, machines } = await import('@/server/db/schema');
    const vs = await t.db.select().from(machineVersions).innerJoin(machines, eq(machines.id, machineVersions.machineId)).where(eq(machines.code, 'EMP-200'));
    expect(vs.map((v) => [v.machine_versions.version, v.machine_versions.state]).sort()).toEqual([[1, 'retired'], [2, 'retired'], [3, 'retired'], [4, 'published']]);
  });
});
