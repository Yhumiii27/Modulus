// Everything Modulus reads, in one fixed number of queries (the volume is small: tens of machines, hundreds of deals a year),
// and what the pure rules of src/domain compute from it: the price list in force, sale prices, budgets entered and computed,
// the BOM of a configuration, the know-how levels, the configuration of a deal priced. Computed on every read, never stored
// (CLAUDE.md: "Computed, never copied"); frozen only into a sent offer or a sold configuration. Used by the pages (through
// src/server/dal/world.ts, memoised per request), the Server Functions (inside their transaction) and the demo seed.
// No `server-only`: the seed and the tests load it under plain Node.
import { computeBom, type BomDelta, type BomLine } from '@/domain/bom';
import { evaluate, type CfgRule, type Characteristics } from '@/domain/configurator';
import { EMPTY_TRACE, levelOf, mergeTraces, type Trace } from '@/domain/knowhow';
import { priceConfiguration, priceLine, type FrozenConfiguration, type FrozenLine, type FrozenOption } from '@/domain/offer';
import { budgetRows, budgetTotal, computedTotal, listInForce, materialOf, round1, type BudgetEntry, type BudgetRow } from '@/domain/pricing';
import { SETTINGS_KEY, settingsOf, type Settings } from '@/domain/settings';
import type { BudgetPost, ConditionOp, KnowhowLevel, OptionOrigin, RuleKind } from '@/domain/vocab';
import {
  appSettings, articlePrices, bomLines, characteristicDefs, costBudgets, customers, dealLineOptions, dealLines, dealMembers, deals, feedbackOptions,
  knowhowNotes, machineTypes, machineVersions, machines, offerReviews, offers, optionBomDeltas, optionMachines, optionRules, options, priceListItems,
  priceLists, projectFeedback, questionnaires, questions, quoteAnswers, quoteBomDeltas, quoteEstimates, quoteMessages, quoteRequests, soldConfigurations,
  versionCharacteristics,
} from '@/server/db/schema';
import type { DB, Tx } from '@/server/db/types';

export type MachineRow = typeof machines.$inferSelect;
export type VersionRow = typeof machineVersions.$inferSelect;
export type OptionRow = typeof options.$inferSelect;
export type DealRow = typeof deals.$inferSelect;
export type OfferRow = typeof offers.$inferSelect;
export type QuoteRow = typeof quoteRequests.$inferSelect;
export type SoldRow = typeof soldConfigurations.$inferSelect;
export type CustomerRow = typeof customers.$inferSelect;
export type QuestionRow = typeof questions.$inferSelect;
export type EstimateRow = typeof quoteEstimates.$inferSelect;

const group = <T, K>(rows: readonly T[], key: (r: T) => K) => {
  const m = new Map<K, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
};

/** Runs the reads: in parallel on the pool, one after the other inside a transaction (one connection). */
async function all<const T extends readonly (() => Promise<unknown>)[]>(q: DB | Tx, reads: T): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  if ('rollback' in q) {
    const out: unknown[] = [];
    for (const r of reads) out.push(await r());
    return out as never;
  }
  return Promise.all(reads.map((r) => r())) as never;
}

async function loadRows(q: DB | Tx) {
  const [
    types, charDefs, machineRows, versionRows, versionCharRows, bomRows, priceRows, optionRows, optionMachineRows, ruleRows, deltaRows, budgetRowsDb, listRows,
    itemRows, customerRows, dealRows, memberRows, lineRows, lineOptionRows, offerRows, reviewRows, soldRows, questionnaireRows, questionRows, quoteRows,
    answerRows, estimateRows, quoteDeltaRows, messageRows, feedbackRows, feedbackOptionRows, noteRows, settingRows,
  ] = await all(q, [
    () => q.select().from(machineTypes), () => q.select().from(characteristicDefs), () => q.select().from(machines), () => q.select().from(machineVersions),
    () => q.select().from(versionCharacteristics), () => q.select().from(bomLines), () => q.select().from(articlePrices), () => q.select().from(options), () => q.select().from(optionMachines),
    () => q.select().from(optionRules), () => q.select().from(optionBomDeltas), () => q.select().from(costBudgets), () => q.select().from(priceLists), () => q.select().from(priceListItems),
    () => q.select().from(customers), () => q.select().from(deals), () => q.select().from(dealMembers), () => q.select().from(dealLines), () => q.select().from(dealLineOptions),
    () => q.select().from(offers), () => q.select().from(offerReviews), () => q.select().from(soldConfigurations), () => q.select().from(questionnaires), () => q.select().from(questions),
    () => q.select().from(quoteRequests), () => q.select().from(quoteAnswers), () => q.select().from(quoteEstimates), () => q.select().from(quoteBomDeltas), () => q.select().from(quoteMessages),
    () => q.select().from(projectFeedback), () => q.select().from(feedbackOptions), () => q.select().from(knowhowNotes), () => q.select().from(appSettings),
  ]);
  return {
    types, charDefs, machineRows, versionRows, versionCharRows, bomRows, priceRows, optionRows, optionMachineRows, ruleRows, deltaRows, budgetRowsDb, listRows,
    itemRows, customerRows, dealRows, memberRows, lineRows, lineOptionRows, offerRows, reviewRows, soldRows, questionnaireRows, questionRows, quoteRows,
    answerRows, estimateRows, quoteDeltaRows, messageRows, feedbackRows, feedbackOptionRows, noteRows, settingRows,
  };
}

export type Rows = Awaited<ReturnType<typeof loadRows>>;

/** Loads and indexes Modulus's data for the business date `today`. */
export async function loadModulus(q: DB | Tx, today: string) {
  const r = await loadRows(q);
  const settings: Settings = settingsOf(r.settingRows.find((s) => s.key === SETTINGS_KEY)?.value);
  const typeBy = new Map(r.types.map((t) => [t.code, t]));
  const machineBy = new Map(r.machineRows.map((m) => [m.id, m]));
  const machineByCode = new Map(r.machineRows.map((m) => [m.code, m]));
  const versionBy = new Map(r.versionRows.map((v) => [v.id, v]));
  const versionsOf = group(r.versionRows, (v) => v.machineId);
  for (const l of versionsOf.values()) l.sort((a, b) => b.version - a.version);
  const optionBy = new Map(r.optionRows.map((o) => [o.id, o]));
  const optionByCode = new Map(r.optionRows.map((o) => [o.code, o]));
  const optionMachinesBy = group(r.optionMachineRows, (x) => x.optionId);
  const optionsOfMachine = group(r.optionMachineRows, (x) => x.machineId);
  const bomOf = group(r.bomRows, (b) => b.versionId);
  const charsOf = group(r.versionCharRows, (c) => c.versionId);
  const deltasOf = group(r.deltaRows, (d) => d.optionId);
  const quoteDeltasOf = group(r.quoteDeltaRows, (d) => d.requestId);
  const prices = new Map(r.priceRows.map((p) => [p.article, p.unitPriceKeur]));
  const estimateBy = new Map(r.estimateRows.map((e) => [e.requestId, e]));
  const quoteBy = new Map(r.quoteRows.map((x) => [x.id, x]));
  const listNow = listInForce(r.listRows, today);
  const itemsOf = group(r.itemRows, (i) => i.priceListId);
  const customerBy = new Map(r.customerRows.map((c) => [c.id, c]));
  const dealBy = new Map(r.dealRows.map((d) => [d.id, d]));
  const membersOf = group(r.memberRows, (m) => m.dealId);
  const linesOf = group(r.lineRows, (l) => l.dealId);
  for (const l of linesOf.values()) l.sort((a, b) => a.number - b.number);
  const lineOptionsOf = group(r.lineOptionRows, (l) => l.lineId);
  const offersOf = group(r.offerRows, (o) => o.dealId);
  for (const l of offersOf.values()) l.sort((a, b) => a.letter.localeCompare(b.letter));
  const reviewsOf = group(r.reviewRows, (x) => x.offerId);
  const questionsOf = group(r.questionRows, (x) => x.questionnaireId);
  for (const l of questionsOf.values()) l.sort((a, b) => a.position - b.position);
  const answersOf = group(r.answerRows, (a) => a.requestId);
  const messagesOf = group(r.messageRows, (m) => m.requestId);
  for (const l of messagesOf.values()) l.sort((a, b) => +a.createdAt - +b.createdAt);
  const soldVersions = group(r.soldRows, (s) => s.ref);
  for (const l of soldVersions.values()) l.sort((a, b) => a.version - b.version);
  const feedbackOf = group(r.feedbackRows, (f) => f.soldRef);
  const feedbackOptionsOf = group(r.feedbackOptionRows, (f) => f.feedbackId);

  // ── Catalogue ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const published = (machineId: string) => versionsOf.get(machineId)?.find((v) => v.state === 'published') ?? null;
  const latest = (machineId: string) => versionsOf.get(machineId)?.[0] ?? null;
  const listItems = (listId: string | null | undefined) => (listId ? itemsOf.get(listId) ?? [] : []);
  const saleOfMachine = (machineId: string, listId: string | null | undefined = listNow?.id) => listItems(listId).find((i) => i.machineId === machineId)?.saleKeur ?? null;
  const estimateBudget = (e: EstimateRow) =>
    round1(e.materialKeur + e.subcontractingKeur + e.expensesKeur + (e.engineeringHours * settings.rates.engineering_hours + e.workshopHours * settings.rates.workshop_hours + e.siteHours * settings.rates.site_hours) / 1000);
  const saleOfOption = (optionId: string, listId: string | null | undefined = listNow?.id) => {
    const o = optionBy.get(optionId);
    if (!o) return null;
    if (o.origin === 'specific') return o.quoteRequestId ? estimateBy.get(o.quoteRequestId)?.saleKeur ?? null : null;
    return listItems(listId).find((i) => i.optionId === optionId)?.saleKeur ?? null;
  };
  const bomOfVersion = (versionId: string): BomLine[] =>
    (bomOf.get(versionId) ?? []).sort((a, b) => a.mark.localeCompare(b.mark)).map((b) => ({ article: b.article, designation: b.designation, quantity: b.quantity, unit: b.unit, subassembly: b.subassembly, mark: b.mark }));
  const deltasOfOption = (optionId: string): BomDelta[] => {
    const o = optionBy.get(optionId);
    if (!o) return [];
    if (o.origin === 'specific' && o.quoteRequestId)
      return (quoteDeltasOf.get(o.quoteRequestId) ?? []).map((d) => ({ option: o.code, op: d.op as never, article: d.article, designation: d.designation, quantity: d.quantity, unit: d.unit, replaces: null }));
    return (deltasOf.get(optionId) ?? []).map((d) => ({ option: o.code, op: d.op as never, article: d.article, designation: d.designation, quantity: d.quantity, unit: d.unit, replaces: d.replaces }));
  };
  const budgetEntries = (f: (b: (typeof r.budgetRowsDb)[number]) => boolean): BudgetEntry[] =>
    r.budgetRowsDb.filter(f).map((b) => ({ post: b.post as BudgetPost, enteredKeur: b.enteredKeur, hours: b.hours, basis: b.basis }));
  const budgetOfVersion = (versionId: string): { rows: BudgetRow[]; entered: number | null; computed: number | null } => {
    const entries = budgetEntries((b) => b.machineVersionId === versionId);
    if (!entries.length) return { rows: [], entered: null, computed: null };
    const rows = budgetRows(entries, materialOf(bomOfVersion(versionId), prices), settings.rates);
    return { rows, entered: budgetTotal(rows), computed: computedTotal(rows) };
  };
  const budgetOfOption = (optionId: string): { rows: BudgetRow[]; entered: number | null; computed: number | null } => {
    const o = optionBy.get(optionId);
    if (o?.origin === 'specific') {
      const e = o.quoteRequestId ? estimateBy.get(o.quoteRequestId) : undefined;
      const v = e ? estimateBudget(e) : null;
      return { rows: [], entered: v, computed: v };
    }
    const entries = budgetEntries((b) => b.optionId === optionId);
    if (!entries.length) return { rows: [], entered: null, computed: null };
    const deltaBom = deltasOfOption(optionId).filter((d) => d.op !== 'remove').map((d) => ({ article: d.article, designation: d.designation, quantity: d.quantity ?? 0, unit: d.unit ?? 'u' }));
    const rows = budgetRows(entries, materialOf(deltaBom, prices), settings.rates);
    return { rows, entered: budgetTotal(rows), computed: computedTotal(rows) };
  };
  const characteristicsOf = (versionId: string): Characteristics => {
    const v = versionBy.get(versionId);
    const out: Characteristics = { capacity: v?.nominalCapacity ?? null };
    for (const c of charsOf.get(versionId) ?? []) {
      const n = Number(String(c.value).replace(',', '.').replace(/[^\d.\-]/g, ''));
      if (!Number.isNaN(n) && /\d/.test(c.value)) out[c.key] = n;
    }
    return out;
  };
  const cfgRules: CfgRule[] = r.ruleRows.map((x) => ({
    id: x.id, optionId: x.optionId, kind: x.kind as RuleKind, targetOptionId: x.targetOptionId, conditionKey: x.conditionKey, conditionOp: x.conditionOp as ConditionOp | null,
    conditionValue: x.conditionValue, explanation: x.explanation,
  }));
  /** Options available on a machine: active catalogue options linked to it, plus the specific options of `dealId`. */
  const availableOptions = (machineId: string, dealId?: string | null) => {
    const ids = new Set((optionsOfMachine.get(machineId) ?? []).map((x) => x.optionId));
    return r.optionRows.filter((o) => {
      if (!ids.has(o.id) || !o.active) return false;
      if (o.origin === 'catalogue') return true;
      const qr = o.quoteRequestId ? quoteBy.get(o.quoteRequestId) : undefined;
      return !!dealId && qr?.dealId === dealId;
    }).sort((a, b) => a.code.localeCompare(b.code));
  };

  // ── Know-how traces (docs/spec/04) ───────────────────────────────────────────────────────────────────────────────
  const traces = new Map<string, Trace>();
  const key = (machineId: string, optionId: string) => `${machineId}|${optionId}`;
  const trace = (machineId: string, optionId: string) => {
    const k = key(machineId, optionId);
    let t = traces.get(k);
    if (!t) {
      t = { ...EMPTY_TRACE, deliveries: [], inCatalogue: optionBy.get(optionId)?.origin === 'catalogue' };
      traces.set(k, t);
    }
    return t;
  };
  for (const om of r.optionMachineRows) trace(om.machineId, om.optionId);
  for (const o of r.offerRows.filter((x) => x.state !== 'draft' && x.content))
    for (const l of o.content!.lines) {
      const m = machineByCode.get(l.machine);
      for (const x of l.options) {
        const op = optionByCode.get(x.code);
        if (m && op) trace(m.id, op.id).quoted++;
      }
    }
  for (const qr of r.quoteRows.filter((x) => x.state === 'answered')) {
    const op = r.optionRows.find((o) => o.quoteRequestId === qr.id);
    if (op) trace(qr.machineId, op.id).quoted++;
  }
  const lastSold = new Map<string, string>();
  for (const versions of soldVersions.values()) {
    const cur = versions[versions.length - 1];
    const fbs = feedbackOf.get(cur.ref) ?? [];
    const fb = [...fbs].sort((a, b) => (a.stage === 'warranty_end' ? -1 : 1) - (b.stage === 'warranty_end' ? -1 : 1))[0];
    const fopts = fb ? feedbackOptionsOf.get(fb.id) ?? [] : [];
    for (const l of cur.content.lines) {
      const m = machineByCode.get(l.machine);
      for (const x of l.options) {
        const op = optionByCode.get(x.code);
        if (!m || !op) continue;
        const t = trace(m.id, op.id);
        t.sold++;
        if (!lastSold.has(op.id) || lastSold.get(op.id)! < cur.orderedOn) lastSold.set(op.id, cur.orderedOn);
        const fo = fopts.find((f) => f.optionId === op.id);
        if (fo?.delivered) {
          t.deliveries.push({ soldRef: cur.ref, gap: fo.actualKeur != null && fo.budgetKeur > 0 ? Math.round((fo.actualKeur / fo.budgetKeur - 1) * 1000) / 1000 : null });
          if (fb?.majorDifficulty && fo.actualKeur != null && fo.actualKeur > fo.budgetKeur * (1 + settings.avoidGapPct / 100)) t.majorDifficulty = true;
        }
      }
    }
  }
  const avoidOf = (optionId: string, machineId: string | null) => {
    const notes = r.noteRows.filter((n) => n.optionId === optionId && (n.kind === 'avoid' || n.kind === 'clear_avoid') && (n.machineId == null || n.machineId === machineId))
      .sort((a, b) => +b.createdAt - +a.createdAt);
    return notes[0]?.kind === 'avoid';
  };
  const traceOf = (machineId: string, optionId: string): Trace => ({ ...(traces.get(key(machineId, optionId)) ?? { ...EMPTY_TRACE, inCatalogue: optionBy.get(optionId)?.origin === 'catalogue' }), avoidMarked: avoidOf(optionId, machineId) });
  const levelAt = (machineId: string, optionId: string): KnowhowLevel => levelOf(traceOf(machineId, optionId), settings);
  const optionTrace = (optionId: string): Trace => ({
    ...mergeTraces([...traces.entries()].filter(([k]) => k.endsWith(`|${optionId}`)).map(([, t]) => t)),
    inCatalogue: optionBy.get(optionId)?.origin === 'catalogue', avoidMarked: avoidOf(optionId, null),
  });
  const optionLevel = (optionId: string): KnowhowLevel => levelOf(optionTrace(optionId), settings);

  // ── A deal's configuration priced (draft offer) ────────────────────────────────────────────────────────────────────
  const frozenLines = (dealId: string, listId = listNow?.id ?? null): FrozenLine[] =>
    (linesOf.get(dealId) ?? []).map((l) => {
      const v = versionBy.get(l.machineVersionId)!;
      const m = machineBy.get(v.machineId)!;
      const opts = (lineOptionsOf.get(l.id) ?? []).map((x) => optionBy.get(x.optionId)!).filter(Boolean).sort((a, b) => a.code.localeCompare(b.code));
      const bom = computeBom(bomOfVersion(v.id), opts.flatMap((o) => deltasOfOption(o.id)), 1);
      const fo: FrozenOption[] = opts.map((o) => ({
        code: o.code, label: o.label, origin: o.origin as OptionOrigin, saleKeur: saleOfOption(o.id, listId), budgetKeur: budgetOfOption(o.id).entered,
        extraWeeks: o.origin === 'specific' && o.quoteRequestId ? estimateBy.get(o.quoteRequestId)?.extraWeeks ?? o.extraWeeks : o.extraWeeks, level: levelAt(m.id, o.id),
      }));
      return priceLine({
        number: l.number, machine: m.code, version: v.version, label: v.label, quantity: l.quantity, leadWeeks: v.leadWeeks, machineSaleKeur: saleOfMachine(m.id, listId),
        machineBudgetKeur: budgetOfVersion(v.id).entered, options: fo, bom: bom.lines,
      });
    });
  const configurationOf = (dealId: string, o: { discountPct: number; currency: string; rate: number | null; assumptions: string | null; reservations: string | null }): FrozenConfiguration => {
    const lines = frozenLines(dealId);
    const first = lines[0] ? machineByCode.get(lines[0].machine) : undefined;
    const type = first ? typeBy.get(first.typeCode) : undefined;
    return priceConfiguration(lines, {
      priceList: listNow?.code ?? null, discountPct: o.discountPct, payment: type ? { deposit: type.depositPct, delivery: type.deliveryPct, acceptance: type.acceptancePct } : null,
      currency: o.currency, rate: o.rate, assumptions: o.assumptions, reservations: o.reservations,
    });
  };
  /** The amount of a deal: its latest sent offer, else its configuration priced. */
  const dealAmount = (dealId: string): number | null => {
    const sent = (offersOf.get(dealId) ?? []).filter((o) => o.state !== 'draft');
    const last = sent[sent.length - 1];
    if (last?.totalSaleKeur != null) return last.totalSaleKeur;
    const c = configurationOf(dealId, { discountPct: 0, currency: 'EUR', rate: null, assumptions: null, reservations: null });
    return c.lines.length ? c.saleKeur : null;
  };
  const evaluateLine = (versionId: string, dealId: string | null, chosen: Iterable<string>) => {
    const v = versionBy.get(versionId)!;
    return evaluate(availableOptions(v.machineId, dealId), cfgRules, chosen, characteristicsOf(versionId));
  };

  return {
    today, settings, rows: r, typeBy, machineBy, machineByCode, versionBy, versionsOf, optionBy, optionByCode, optionMachinesBy, bomOf, charsOf, deltasOf, prices,
    estimateBy, quoteBy, listNow, itemsOf, customerBy, dealBy, membersOf, linesOf, lineOptionsOf, offersOf, reviewsOf, questionsOf, answersOf, messagesOf,
    soldVersions, feedbackOf, feedbackOptionsOf, published, latest, saleOfMachine, saleOfOption, bomOfVersion, deltasOfOption, budgetOfVersion, budgetOfOption,
    estimateBudget, characteristicsOf, cfgRules, availableOptions, traceOf, levelAt, optionTrace, optionLevel, lastSold, frozenLines, configurationOf, dealAmount,
    evaluateLine,
  };
}

export type ModulusWorld = Awaited<ReturnType<typeof loadModulus>>;
