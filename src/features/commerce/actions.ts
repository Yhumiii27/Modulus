'use server';
// Server Functions of Modulus (docs/spec/01–04). Each one validates its input (zod) and the viewer's right server-side, re-reads
// what it changes inside its transaction (a deal through its team, U-2), applies the pure rules of src/domain again (the
// configurator, the review, the frozen states), writes and records its audit row in the same transaction, then revalidates.
import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { canMove } from '@/domain/deals';
import { nextLetter } from '@/domain/deals';
import { missingAnswers } from '@/domain/quotes';
import { can, canSeeDealPrices, FORBIDDEN } from '@/domain/rights';
import { DEFAULT_SETTINGS, SETTINGS_KEY, SettingsSchema } from '@/domain/settings';
import {
  ANSWER_TYPES, BUDGET_POSTS, CONDITION_OPS, CURRENCIES, DEAL_ORIGINS, DELTA_OPS, ESTIMATE_CLASSES, FEASIBILITIES, FORMATS, KNOWHOW_LEVELS, LOSS_REASONS,
  OPTION_CATEGORIES, QUESTION_THEMES, RULE_KINDS, TEAM_ROLES, UNITS, familyKey, isHourPost, type DealState,
} from '@/domain/vocab';
import { amend, offerReview, recordOrder, sendOffer, type Actor } from '@/server/commerce/core';
import { loadModulus, type ModulusWorld } from '@/server/commerce/world';
import { Refusal, all, audit, bool, isoDay, nextRef, num, opt, reasonOf, run, str, tx, viewerWith, type ActionResult } from '@/server/commerce/write';
import {
  appSettings, bomLines, characteristicDefs, costBudgets, customers, dealLineOptions, dealLines, dealMembers, deals, feedbackOptions, knowhowNotes, machineVersions,
  machines, offerReviews, offers, optionBomDeltas, optionMachines, optionRules, options, priceListItems, priceLists, projectFeedback, questionnaires, questions,
  quoteAnswers, quoteBomDeltas, quoteEstimates, quoteMessages, quoteRequests, soldConfigurations, users, versionCharacteristics,
} from '@/server/db/schema';
import type { Tx } from '@/server/db/types';
import type { Viewer } from '@/server/viewer';

type Prev = ActionResult | null;

const actorOf = (v: Viewer): Actor => ({ userId: v.userId, name: v.name, role: v.role });
const world = (t: Tx, today: string) => loadModulus(t, today);

/** The deal of a reference as the viewer may change it (its team or the sales direction, U-2); otherwise "not found". */
function dealFor(w: ModulusWorld, v: Viewer, ref: string) {
  const d = w.rows.dealRows.find((x) => x.ref === ref);
  const team = d ? (w.membersOf.get(d.id) ?? []).some((m) => m.userId === v.userId) || d.ownerId === v.userId : false;
  if (!d || !canSeeDealPrices(v.roles, team)) throw new Refusal('Deal not found');
  return d;
}
const activeDeal = (d: { state: string }) => {
  if (!['open', 'quoting', 'offer_sent'].includes(d.state)) throw new Refusal('The deal is closed');
};

const dealPaths = (ref: string) => ['/', '/deals', `/deals/${ref}`];

// ── Catalogue (engineering) ──────────────────────────────────────────────────────────────────────────────────────────

export async function createMachineAction(_: Prev, fd: FormData): Promise<ActionResult> {
  let code = '';
  return run(async () => {
    const v = await viewerWith('catalogue');
    const i = z.object({
      code: z.string().regex(FORMATS.machineCode, 'Machine code: type, dash, then capitals and digits (EMP-200)'), type: z.string().regex(FORMATS.typeCode, 'Unknown machine type'),
      label: z.string().min(3, 'A label is required').max(120), capacity: z.number().positive('The capacity is positive'), unit: z.string().min(1, 'A unit is required').max(12),
      lead: z.number().int().min(1, 'A lead time in weeks is required').max(260), description: z.string().max(2000).nullable(),
    }).parse({ code: str(fd, 'code').toUpperCase(), type: str(fd, 'type'), label: str(fd, 'label'), capacity: num(fd, 'capacity'), unit: str(fd, 'unit'), lead: num(fd, 'lead'), description: opt(fd, 'description') });
    if (!i.code.startsWith(`${i.type}-`)) throw new Refusal('The code starts with the machine type');
    code = i.code;
    await tx(async (t) => {
      const [m] = await t.insert(machines).values({ code: i.code, typeCode: i.type }).returning({ id: machines.id });
      const [ver] = await t.insert(machineVersions).values({ machineId: m.id, version: 1, label: i.label, nominalCapacity: i.capacity, capacityUnit: i.unit, leadWeeks: i.lead, description: i.description, createdByName: v.name, note: 'Première version' }).returning({ id: machineVersions.id });
      await audit(t, v, { objectRef: `${i.code} v1`, change: 'machine created (draft)', area: 'Catalogue', entityType: 'machine_version', entityId: ver.id });
    });
  }, ['/catalogue', `/catalogue/${code}`]);
}

/** A new draft version, copied from the latest one (BOM, characteristics, budgets). */
export async function newVersionAction(code: string): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('catalogue');
    await tx(async (t, today) => {
      const w = await world(t, today);
      const m = w.machineByCode.get(code);
      if (!m) throw new Refusal('Machine not found');
      const last = w.latest(m.id)!;
      if (last.state === 'draft') throw new Refusal('A draft version already exists');
      const [nv] = await t.insert(machineVersions).values({
        machineId: m.id, version: last.version + 1, label: last.label, variant: last.variant, description: last.description, nominalCapacity: last.nominalCapacity,
        capacityUnit: last.capacityUnit, leadWeeks: last.leadWeeks, createdByName: v.name, note: null,
      }).returning({ id: machineVersions.id });
      const bom = w.rows.bomRows.filter((b) => b.versionId === last.id);
      if (bom.length) await t.insert(bomLines).values(bom.map((b) => ({ versionId: nv.id, subassembly: b.subassembly, mark: b.mark, article: b.article, designation: b.designation, quantity: b.quantity, unit: b.unit })));
      const chars = w.rows.versionCharRows.filter((c) => c.versionId === last.id);
      if (chars.length) await t.insert(versionCharacteristics).values(chars.map((c) => ({ ...c, versionId: nv.id })));
      const budgets = w.rows.budgetRowsDb.filter((b) => b.machineVersionId === last.id);
      if (budgets.length) await t.insert(costBudgets).values(budgets.map((b) => ({ machineVersionId: nv.id, post: b.post, enteredKeur: b.enteredKeur, hours: b.hours, basis: b.basis, updatedByName: v.name })));
      await audit(t, v, { objectRef: `${code} v${last.version + 1}`, change: `new draft version copied from v${last.version}`, area: 'Catalogue', entityType: 'machine_version', entityId: nv.id });
    });
  }, ['/catalogue', `/catalogue/${code}`]);
}

/** The draft version's sheet: label, capacity, lead time, note, datasheet and characteristics. */
export async function updateVersionAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const code = str(fd, 'code');
  return run(async () => {
    const v = await viewerWith('catalogue');
    const i = z.object({
      label: z.string().min(3, 'A label is required').max(120), capacity: z.number().positive('The capacity is positive'), lead: z.number().int().min(1).max(260),
      note: z.string().max(500).nullable(), datasheet: z.string().regex(FORMATS.codexRef, 'A Codex reference: capitals, digits, dots and dashes').nullable(), description: z.string().max(2000).nullable(),
    }).parse({ label: str(fd, 'label'), capacity: num(fd, 'capacity'), lead: num(fd, 'lead'), note: opt(fd, 'note'), datasheet: opt(fd, 'datasheet')?.toUpperCase() ?? null, description: opt(fd, 'description') });
    await tx(async (t, today) => {
      const w = await world(t, today);
      const m = w.machineByCode.get(code);
      const draft = m ? w.latest(m.id) : null;
      if (!m || !draft || draft.state !== 'draft') throw new Refusal('Only a draft version can be changed');
      await t.update(machineVersions).set({ label: i.label, nominalCapacity: i.capacity, leadWeeks: i.lead, note: i.note, datasheetRef: i.datasheet, description: i.description, updatedAt: new Date() }).where(eq(machineVersions.id, draft.id));
      for (const def of w.rows.charDefs.filter((c) => c.typeCode === m.typeCode)) {
        const value = opt(fd, `char_${def.key}`);
        await t.delete(versionCharacteristics).where(and(eq(versionCharacteristics.versionId, draft.id), eq(versionCharacteristics.key, def.key)));
        if (value) await t.insert(versionCharacteristics).values({ versionId: draft.id, key: def.key, value: value.slice(0, 120) });
      }
      await audit(t, v, { objectRef: `${code} v${draft.version}`, change: 'draft version changed', area: 'Catalogue', entityType: 'machine_version', entityId: draft.id });
    });
  }, ['/catalogue', `/catalogue/${code}`]);
}

/** Publishes the draft (frozen from now on) and retires the version in force; deals and CAPEX keep the version they chose. */
export async function publishVersionAction(code: string): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('catalogue');
    await tx(async (t, today) => {
      const w = await world(t, today);
      const m = w.machineByCode.get(code);
      const draft = m ? w.latest(m.id) : null;
      if (!m || !draft || draft.state !== 'draft') throw new Refusal('No draft version to publish');
      if (!(w.bomOf.get(draft.id) ?? []).length) throw new Refusal('A version is published with its BOM');
      const cur = w.published(m.id);
      if (cur) await t.update(machineVersions).set({ state: 'retired', retiredAt: new Date() }).where(eq(machineVersions.id, cur.id));
      await t.update(machineVersions).set({ state: 'published', publishedAt: new Date() }).where(eq(machineVersions.id, draft.id));
      await audit(t, v, { objectRef: `${code} v${draft.version}`, change: `published${cur ? `, v${cur.version} retired` : ''}`, area: 'Catalogue', entityType: 'machine_version', entityId: draft.id });
    });
  }, ['/', '/catalogue', `/catalogue/${code}`, '/configurator']);
}

export async function addBomLineAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const code = str(fd, 'code');
  return run(async () => {
    const v = await viewerWith('catalogue');
    const i = z.object({
      article: z.string().regex(FORMATS.article, 'A Keystone article: ART- then 6 digits'), designation: z.string().min(2, 'A designation is required').max(200),
      quantity: z.number().positive('The quantity is positive'), unit: z.enum(UNITS), subassembly: z.string().min(1, 'A sub-assembly is required').max(60), mark: z.string().min(1, 'A mark is required').max(12),
    }).parse({ article: str(fd, 'article').toUpperCase(), designation: str(fd, 'designation'), quantity: num(fd, 'quantity'), unit: str(fd, 'unit') || 'u', subassembly: str(fd, 'subassembly'), mark: str(fd, 'mark') });
    await tx(async (t, today) => {
      const w = await world(t, today);
      const m = w.machineByCode.get(code);
      const draft = m ? w.latest(m.id) : null;
      if (!m || !draft || draft.state !== 'draft') throw new Refusal('Only the BOM of a draft version can be changed');
      await t.insert(bomLines).values({ versionId: draft.id, ...i });
      await audit(t, v, { objectRef: `${code} v${draft.version}`, change: `BOM: + ${i.article} × ${i.quantity} ${i.unit}`, area: 'Catalogue', entityType: 'machine_version', entityId: draft.id });
    });
  }, [`/catalogue/${code}`]);
}

export async function removeBomLineAction(code: string, lineId: string): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('catalogue');
    await tx(async (t) => {
      const [l] = await t.select().from(bomLines).where(eq(bomLines.id, lineId));
      if (!l) throw new Refusal('Line not found');
      await t.delete(bomLines).where(eq(bomLines.id, lineId));
      await audit(t, v, { objectRef: code, change: `BOM: − ${l.article}`, area: 'Catalogue', entityType: 'machine_version', entityId: l.versionId });
    });
  }, [`/catalogue/${code}`]);
}

export async function createOptionAction(_: Prev, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('catalogue');
    const i = z.object({
      code: z.string().regex(/^OPT-[A-Z]{3}-[0-9]{2}$/, 'Option code: OPT-, three capitals, dash, two digits'), label: z.string().min(3, 'A label is required').max(160),
      category: z.enum(OPTION_CATEGORIES), weeks: z.number().int().min(0).max(104), machines: z.array(z.string()).min(1, 'At least one machine'), description: z.string().max(2000).nullable(),
    }).parse({ code: str(fd, 'code').toUpperCase(), label: str(fd, 'label'), category: str(fd, 'category'), weeks: num(fd, 'weeks') ?? 0, machines: all(fd, 'machines'), description: opt(fd, 'description') });
    await tx(async (t) => {
      const ms = await t.select().from(machines).where(inArray(machines.code, i.machines));
      if (ms.length !== i.machines.length) throw new Refusal('Unknown machine');
      const [o] = await t.insert(options).values({ code: i.code, label: i.label, category: i.category, extraWeeks: i.weeks, description: i.description }).returning({ id: options.id });
      await t.insert(optionMachines).values(ms.map((m) => ({ optionId: o.id, machineId: m.id })));
      await audit(t, v, { objectRef: i.code, change: `option created for ${i.machines.join(', ')}`, area: 'Catalogue', entityType: 'option', entityId: o.id });
    });
  }, ['/catalogue', '/configurator']);
}

export async function addRuleAction(_: Prev, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('catalogue');
    const i = z.object({
      option: z.string(), kind: z.enum(RULE_KINDS), target: z.string().nullable(), key: z.string().regex(FORMATS.characteristicKey).nullable(), op: z.enum(CONDITION_OPS).nullable(),
      value: z.number().nullable(), explanation: z.string().min(3, 'An explanation is required').max(300),
    }).parse({ option: str(fd, 'option'), kind: str(fd, 'kind'), target: opt(fd, 'target'), key: opt(fd, 'key'), op: opt(fd, 'op'), value: num(fd, 'value'), explanation: str(fd, 'explanation') });
    if (i.kind === 'mandatory_if' ? !i.key || !i.op || i.value == null : !i.target) throw new Refusal(i.kind === 'mandatory_if' ? 'A condition on a characteristic is required' : 'A target option is required');
    await tx(async (t) => {
      const os = await t.select().from(options).where(inArray(options.code, [i.option, ...(i.target ? [i.target] : [])]));
      const a = os.find((o) => o.code === i.option);
      const b = i.target ? os.find((o) => o.code === i.target) : null;
      if (!a || (i.target && !b) || a.id === b?.id) throw new Refusal('Unknown option');
      const [r] = await t.insert(optionRules).values({
        optionId: a.id, kind: i.kind, targetOptionId: i.kind === 'mandatory_if' ? null : b!.id, conditionKey: i.kind === 'mandatory_if' ? i.key : null,
        conditionOp: i.kind === 'mandatory_if' ? i.op : null, conditionValue: i.kind === 'mandatory_if' ? i.value : null, explanation: i.explanation, createdByName: v.name,
      }).returning({ id: optionRules.id });
      await audit(t, v, { objectRef: i.option, change: `rule: ${i.kind} ${i.target ?? `${i.key} ${i.op} ${i.value}`}`, area: 'Catalogue', entityType: 'option_rule', entityId: r.id });
    });
  }, ['/catalogue', '/configurator']);
}

export async function addDeltaAction(_: Prev, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('catalogue');
    const i = z.object({
      option: z.string(), op: z.enum(DELTA_OPS), article: z.string().regex(FORMATS.article, 'A Keystone article: ART- then 6 digits'), designation: z.string().min(2).max(200),
      quantity: z.number().positive().nullable(), unit: z.enum(UNITS).nullable(), replaces: z.string().regex(FORMATS.article, 'A Keystone article: ART- then 6 digits').nullable(),
    }).parse({ option: str(fd, 'option'), op: str(fd, 'op'), article: str(fd, 'article').toUpperCase(), designation: str(fd, 'designation'), quantity: num(fd, 'quantity'), unit: opt(fd, 'unit'), replaces: opt(fd, 'replaces')?.toUpperCase() ?? null });
    if (i.op !== 'remove' && (i.quantity == null || !i.unit)) throw new Refusal('A quantity and a unit are required');
    if (i.op === 'replace' && !i.replaces) throw new Refusal('The article replaced is required');
    await tx(async (t) => {
      const [o] = await t.select().from(options).where(eq(options.code, i.option));
      if (!o || o.origin !== 'catalogue') throw new Refusal('Unknown option');
      await t.insert(optionBomDeltas).values({ optionId: o.id, op: i.op, article: i.article, designation: i.designation, quantity: i.op === 'remove' ? null : i.quantity, unit: i.op === 'remove' ? null : i.unit, replaces: i.op === 'replace' ? i.replaces : null });
      await audit(t, v, { objectRef: i.option, change: `BOM delta: ${i.op} ${i.article}`, area: 'Catalogue', entityType: 'option', entityId: o.id });
    });
  }, ['/catalogue']);
}

// ── Budgets and prices (estimator, sales direction) ─────────────────────────────────────────────────────────────────

/** Budget per post of a machine's draft or published version, or of a catalogue option (D-7: entered; hours give the computed value). */
export async function setBudgetAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const code = str(fd, 'code');
  return run(async () => {
    const v = await viewerWith('budget');
    const subject = str(fd, 'subject') === 'option' ? 'option' : 'version';
    await tx(async (t, today) => {
      const w = await world(t, today);
      let target: { machineVersionId: string } | { optionId: string };
      let ref: string;
      if (subject === 'option') {
        const o = w.optionByCode.get(str(fd, 'option'));
        if (!o || o.origin !== 'catalogue') throw new Refusal('Unknown option');
        target = { optionId: o.id };
        ref = o.code;
      } else {
        const ver = w.rows.versionRows.find((x) => x.id === str(fd, 'version'));
        if (!ver || ver.state === 'retired') throw new Refusal('The budget of a retired version is kept as it is');
        target = { machineVersionId: ver.id };
        ref = `${code} v${ver.version}`;
      }
      for (const post of BUDGET_POSTS) {
        const entered = num(fd, `k_${post}`);
        const hours = isHourPost(post) ? num(fd, `h_${post}`) : null;
        if (entered == null) continue;
        if (entered < 0 || (hours != null && hours < 0)) throw new Refusal('A budget is positive');
        const cond = 'optionId' in target ? and(eq(costBudgets.optionId, target.optionId), eq(costBudgets.post, post)) : and(eq(costBudgets.machineVersionId, target.machineVersionId), eq(costBudgets.post, post));
        await t.delete(costBudgets).where(cond);
        await t.insert(costBudgets).values({ ...target, post, enteredKeur: entered, hours, basis: opt(fd, `b_${post}`), updatedByName: v.name });
      }
      await audit(t, v, { objectRef: ref, change: 'budget per post updated', area: 'Prices and budgets' });
    });
  }, ['/catalogue', `/catalogue/${code}`]);
}

/** A new price list, prefilled from the list in force (prices × a factor), proposed to the sales direction. */
export async function createPriceListAction(_: Prev, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('budget');
    const i = z.object({
      code: z.string().regex(FORMATS.priceList, 'Price list code: GRILLE-, the year'), from: isoDay, to: isoDay, factor: z.number().min(0.5).max(2), maxDiscount: z.number().min(0).max(50),
    }).parse({ code: str(fd, 'code').toUpperCase(), from: str(fd, 'from'), to: str(fd, 'to'), factor: num(fd, 'factor') ?? 1, maxDiscount: num(fd, 'maxDiscount') ?? 10 });
    if (i.from > i.to) throw new Refusal('The end of validity is before its start');
    await tx(async (t, today) => {
      const w = await world(t, today);
      const [l] = await t.insert(priceLists).values({ code: i.code, validFrom: i.from, validTo: i.to, maxDiscountPct: i.maxDiscount, proposedByName: v.name }).returning({ id: priceLists.id });
      const base = w.listNow ? w.itemsOf.get(w.listNow.id) ?? [] : [];
      if (base.length) await t.insert(priceListItems).values(base.map((x) => ({ priceListId: l.id, machineId: x.machineId, optionId: x.optionId, saleKeur: Math.round(x.saleKeur * i.factor * 10) / 10 })));
      await t.update(priceLists).set({ state: 'to_validate' }).where(eq(priceLists.id, l.id));
      await audit(t, v, { objectRef: i.code, change: `price list proposed (${base.length} prices, × ${i.factor})`, area: 'Prices and budgets', entityType: 'price_list', entityId: l.id });
    });
  }, ['/catalogue']);
}

/** A sale price of a list not yet published. */
export async function setPriceAction(_: Prev, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('budget');
    const sale = z.number().positive('A sale price is positive').parse(num(fd, 'sale'));
    await tx(async (t, today) => {
      const w = await world(t, today);
      const list = w.rows.listRows.find((l) => l.code === str(fd, 'list'));
      if (!list || list.state === 'published' || list.state === 'withdrawn') throw new Refusal('A published price list is frozen');
      const m = w.machineByCode.get(str(fd, 'item'));
      const o = w.optionByCode.get(str(fd, 'item'));
      if (!m && !o) throw new Refusal('Unknown machine or option');
      await t.delete(priceListItems).where(and(eq(priceListItems.priceListId, list.id), m ? eq(priceListItems.machineId, m.id) : eq(priceListItems.optionId, o!.id)));
      await t.insert(priceListItems).values({ priceListId: list.id, machineId: m?.id ?? null, optionId: m ? null : o!.id, saleKeur: sale });
      await audit(t, v, { objectRef: list.code, change: `price of ${str(fd, 'item')}: ${sale} k€`, area: 'Prices and budgets', entityType: 'price_list', entityId: list.id });
    });
  }, ['/catalogue']);
}

/**
 * Validates a proposed price list (D-4): the sales direction publishes it; when its maximum discount is beyond the threshold
 * the general management confirms first. Publishing never changes an offer already sent.
 */
export async function validatePriceListAction(code: string): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('validate_prices');
    await tx(async (t, today) => {
      const w = await world(t, today);
      const list = w.rows.listRows.find((l) => l.code === code);
      if (!list || list.state !== 'to_validate') throw new Refusal('Only a price list to validate can be validated');
      const needsGm = list.maxDiscountPct > w.settings.discountGeneralPct;
      const salesDirection = can(v.roles, 'deal');
      if (!salesDirection) {
        // The general management: confirms a maximum discount beyond the threshold; the sales direction then publishes.
        if (!needsGm || list.confirmedByName) throw new Refusal('A price list is validated by the sales direction');
        await t.update(priceLists).set({ confirmedByName: v.name, updatedAt: new Date() }).where(eq(priceLists.id, list.id));
        await audit(t, v, { objectRef: code, change: 'maximum discount confirmed by the general management', area: 'Prices and budgets', entityType: 'price_list', entityId: list.id });
        return;
      }
      if (needsGm && !list.confirmedByName) throw new Refusal('A maximum discount beyond the threshold is confirmed by the general management first');
      await t.update(priceLists).set({ state: 'published', validatedByName: v.name, validatedAt: new Date(), updatedAt: new Date() }).where(eq(priceLists.id, list.id));
      await audit(t, v, { objectRef: code, change: 'price list validated and published', area: 'Prices and budgets', entityType: 'price_list', entityId: list.id });
    });
  }, ['/', '/catalogue']);
}

// ── Deals (account managers, sales direction) ──────────────────────────────────────────────────────────────────────────

export async function createDealAction(_: Prev, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('deal');
    const i = z.object({
      saleCase: z.coerce.number().int().min(1).max(3), customer: z.string().nullable(), prospectName: z.string().max(160).nullable(), prospectCountry: z.string().regex(FORMATS.country, 'A country code (ISO, two letters) is expected').nullable(),
      intermediary: z.string().nullable(), capexNeed: z.string().regex(FORMATS.capexNeed, 'CAPEX need: CPX-YYYY-NNN/BNN').nullable(), site: z.string().min(2, 'A delivery site is required').max(160),
      origin: z.enum(DEAL_ORIGINS), need: z.string().min(3, 'The need is required').max(4000), wished: z.string().max(60).nullable(), budget: z.number().positive().nullable(), probability: z.number().int().min(0).max(100),
    }).parse({
      saleCase: str(fd, 'saleCase'), customer: opt(fd, 'customer'), prospectName: opt(fd, 'prospectName'), prospectCountry: opt(fd, 'prospectCountry')?.toUpperCase() ?? null, intermediary: opt(fd, 'intermediary'),
      capexNeed: opt(fd, 'capexNeed')?.toUpperCase() ?? null, site: str(fd, 'site'), origin: str(fd, 'origin') || 'customer_request', need: str(fd, 'need'), wished: opt(fd, 'wished'), budget: num(fd, 'budget'), probability: num(fd, 'probability') ?? 20,
    });
    if (i.saleCase === 1 && !i.capexNeed) throw new Refusal('Case 1 comes from the machine need of an Arche CAPEX');
    if (i.saleCase !== 1 && i.capexNeed) throw new Refusal('Only case 1 comes from an Arche CAPEX');
    if (i.saleCase === 2 && !i.intermediary) throw new Refusal('Case 2 needs the intermediary subsidiary');
    if (!i.customer && !(i.prospectName && i.prospectCountry)) throw new Refusal('A customer, or a prospect with its country');
    await tx(async (t, today) => {
      let customerId = i.customer;
      if (!customerId) {
        const code = i.prospectName!.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'PROSPECT';
        const [c] = await t.insert(customers).values({ code: `${code}-${today.slice(2, 4)}`, name: i.prospectName!, kind: i.saleCase === 2 ? 'mining_site' : 'external', country: i.prospectCountry!, source: 'modulus' }).returning({ id: customers.id });
        customerId = c.id;
      }
      const ref = await nextRef(t, 'AF', today);
      const [d] = await t.insert(deals).values({
        ref, saleCase: i.saleCase, customerId, intermediaryId: i.saleCase === 2 ? i.intermediary : null, capexNeed: i.saleCase === 1 ? i.capexNeed : null, deliverySite: i.site,
        origin: i.saleCase === 1 ? 'capex_need' : i.origin === 'capex_need' ? 'customer_request' : i.origin, ownerId: v.userId, ownerName: v.name, need: i.need, wishedFor: i.wished, customerBudgetKeur: i.budget, probability: i.probability,
      }).returning({ id: deals.id });
      await t.insert(dealMembers).values({ dealId: d.id, userId: v.userId, userName: v.name, role: 'sales' });
      await audit(t, v, { objectRef: ref, change: `deal opened (case ${i.saleCase})`, area: 'Deals', entityType: 'deal', entityId: d.id });
    });
  }, ['/', '/deals']);
}

export async function updateDealAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('deal');
    const i = z.object({ probability: z.number().int().min(0).max(100), site: z.string().min(2).max(160), wished: z.string().max(60).nullable(), need: z.string().min(3).max(4000) })
      .parse({ probability: num(fd, 'probability'), site: str(fd, 'site'), wished: opt(fd, 'wished'), need: str(fd, 'need') });
    await tx(async (t, today) => {
      const d = dealFor(await world(t, today), v, ref);
      activeDeal(d);
      await t.update(deals).set({ probability: i.probability, deliverySite: i.site, wishedFor: i.wished, need: i.need, updatedAt: new Date() }).where(eq(deals.id, d.id));
      await audit(t, v, { objectRef: ref, change: `deal updated (probability ${d.probability} → ${i.probability} %)`, area: 'Deals', entityType: 'deal', entityId: d.id });
    });
  }, dealPaths(ref));
}

export async function addMemberAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('deal');
    const role = z.enum(TEAM_ROLES).parse(str(fd, 'role'));
    await tx(async (t, today) => {
      const d = dealFor(await world(t, today), v, ref);
      const [u] = await t.select().from(users).where(eq(users.id, str(fd, 'user')));
      if (!u || !u.active) throw new Refusal('Unknown person');
      await t.insert(dealMembers).values({ dealId: d.id, userId: u.id, userName: u.name, role }).onConflictDoUpdate({ target: [dealMembers.dealId, dealMembers.userId], set: { role } });
      await audit(t, v, { objectRef: ref, change: `team: + ${u.name} (${role})`, area: 'Deals', entityType: 'deal', entityId: d.id });
    });
  }, dealPaths(ref));
}

/** Adds or changes a configuration line: a published machine version, a quantity, options — the rules applied, refused when one is broken. */
export async function saveLineAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('deal');
    const i = z.object({ machine: z.string(), quantity: z.number().int().min(1, 'At least one machine').max(50), options: z.array(z.string()), line: z.number().int().nullable() })
      .parse({ machine: str(fd, 'machine'), quantity: num(fd, 'quantity') ?? 1, options: all(fd, 'options'), line: num(fd, 'line') });
    await tx(async (t, today) => {
      const w = await world(t, today);
      const d = dealFor(w, v, ref);
      activeDeal(d);
      const m = w.machineByCode.get(i.machine);
      const existing = i.line != null ? (w.linesOf.get(d.id) ?? []).find((l) => l.number === i.line) : null;
      if (i.line != null && !existing) throw new Refusal('Unknown line');
      const versionId = existing && w.versionBy.get(existing.machineVersionId)?.machineId === m?.id ? existing.machineVersionId : m ? w.published(m.id)?.id : undefined;
      if (!m || !versionId) throw new Refusal('Only a published machine version can be configured');
      const chosen = i.options.map((c) => w.optionByCode.get(c)?.id).filter((x): x is string => !!x);
      if (chosen.length !== i.options.length) throw new Refusal('Unknown option');
      const ev = w.evaluateLine(versionId, d.id, chosen);
      if (ev.selected.length < new Set(chosen).size) throw new Refusal('An option is not available on this machine');
      if (ev.violations.length) {
        const x = ev.violations[0];
        throw new Refusal(`Rule broken: ${x.option} ${x.kind === 'excludes' ? 'excludes' : 'is in the same group as'} ${x.target} — ${x.explanation}`);
      }
      let lineId: string;
      if (existing) {
        lineId = existing.id;
        await t.update(dealLines).set({ quantity: i.quantity, machineVersionId: versionId, updatedAt: new Date() }).where(eq(dealLines.id, lineId));
        await t.delete(dealLineOptions).where(eq(dealLineOptions.lineId, lineId));
      } else {
        const n = Math.max(0, ...(w.linesOf.get(d.id) ?? []).map((l) => l.number)) + 1;
        const [l] = await t.insert(dealLines).values({ dealId: d.id, number: n, machineVersionId: versionId, quantity: i.quantity }).returning({ id: dealLines.id });
        lineId = l.id;
      }
      if (ev.selected.length) await t.insert(dealLineOptions).values(ev.selected.map((optionId) => ({ lineId, optionId })));
      if (d.state === 'open') await t.update(deals).set({ state: 'quoting', updatedAt: new Date() }).where(eq(deals.id, d.id));
      const added = ev.selected.filter((x) => !chosen.includes(x)).map((x) => w.optionBy.get(x)!.code);
      await audit(t, v, { objectRef: ref, change: `line ${existing ? existing.number : 'added'}: ${m.code} × ${i.quantity}${ev.selected.length ? ` + ${ev.selected.map((x) => w.optionBy.get(x)!.code).join(', ')}` : ''}${added.length ? ` (imposed: ${added.join(', ')})` : ''}`, area: 'Deals', entityType: 'deal', entityId: d.id });
    });
  }, [...dealPaths(ref), '/configurator']);
}

export async function removeLineAction(ref: string, number: number): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('deal');
    await tx(async (t, today) => {
      const w = await world(t, today);
      const d = dealFor(w, v, ref);
      activeDeal(d);
      const l = (w.linesOf.get(d.id) ?? []).find((x) => x.number === number);
      if (!l) throw new Refusal('Unknown line');
      await t.delete(dealLines).where(eq(dealLines.id, l.id));
      await audit(t, v, { objectRef: ref, change: `line ${number} removed`, area: 'Deals', entityType: 'deal', entityId: d.id });
    });
  }, dealPaths(ref));
}

/** Closes a deal as lost or abandoned (a reason is required, D-2). */
export async function closeDealAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('deal');
    const to = z.enum(['lost', 'abandoned']).parse(str(fd, 'to'));
    const reason = z.enum(LOSS_REASONS, { message: 'A reason is required' }).parse(str(fd, 'lossReason'));
    const note = opt(fd, 'note');
    await tx(async (t, today) => {
      const d = dealFor(await world(t, today), v, ref);
      if (!canMove(d.state as DealState, to)) throw new Refusal('The deal is closed');
      await t.update(deals).set({ state: to, probability: 0, lossReason: reason, lossNote: note, updatedAt: new Date() }).where(eq(deals.id, d.id));
      await t.update(offers).set({ state: 'declined', updatedAt: new Date() }).where(and(eq(offers.dealId, d.id), eq(offers.state, 'sent')));
      await audit(t, v, { objectRef: ref, change: `state: ${d.state} → ${to}`, area: 'Deals', entityType: 'deal', entityId: d.id, reason: `${reason}${note ? ` · ${note}` : ''}` });
    });
  }, dealPaths(ref));
}

// ── Offers ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function createOfferAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('deal');
    const i = z.object({
      discount: z.number().min(0).max(50), validity: z.number().int().min(1).max(365), currency: z.enum(CURRENCIES), assumptions: z.string().max(4000).nullable(), reservations: z.string().max(4000).nullable(), note: z.string().max(200).nullable(),
    }).parse({ discount: num(fd, 'discount') ?? 0, validity: num(fd, 'validity') ?? 90, currency: str(fd, 'currency') || 'EUR', assumptions: opt(fd, 'assumptions'), reservations: opt(fd, 'reservations'), note: opt(fd, 'note') });
    await tx(async (t, today) => {
      const w = await world(t, today);
      const d = dealFor(w, v, ref);
      activeDeal(d);
      if (!(w.linesOf.get(d.id) ?? []).length) throw new Refusal('Add a configuration line first');
      const mine = w.offersOf.get(d.id) ?? [];
      if (mine.some((o) => o.state === 'draft')) throw new Refusal('A draft offer already exists');
      const letter = nextLetter(mine.map((o) => o.letter));
      if (!letter) throw new Refusal('26 offers already');
      const [o] = await t.insert(offers).values({ dealId: d.id, letter, discountPct: i.discount, validityDays: i.validity, currency: i.currency, assumptions: i.assumptions, reservations: i.reservations, note: i.note }).returning({ id: offers.id });
      await audit(t, v, { objectRef: `${ref} · ${letter}`, change: `draft offer created (discount ${i.discount} %)`, area: 'Deals', entityType: 'offer', entityId: o.id });
    });
  }, dealPaths(ref));
}

export async function updateOfferAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('deal');
    const i = z.object({
      discount: z.number().min(0).max(50), validity: z.number().int().min(1).max(365), currency: z.enum(CURRENCIES), assumptions: z.string().max(4000).nullable(), reservations: z.string().max(4000).nullable(),
    }).parse({ discount: num(fd, 'discount') ?? 0, validity: num(fd, 'validity') ?? 90, currency: str(fd, 'currency') || 'EUR', assumptions: opt(fd, 'assumptions'), reservations: opt(fd, 'reservations') });
    await tx(async (t, today) => {
      const w = await world(t, today);
      const d = dealFor(w, v, ref);
      const o = (w.offersOf.get(d.id) ?? []).find((x) => x.letter === str(fd, 'letter'));
      if (!o || o.state !== 'draft') throw new Refusal('A sent offer is frozen: create a new offer');
      await t.update(offers).set({ discountPct: i.discount, validityDays: i.validity, currency: i.currency, assumptions: i.assumptions, reservations: i.reservations, updatedAt: new Date() }).where(eq(offers.id, o.id));
      await audit(t, v, { objectRef: `${ref} · ${o.letter}`, change: `draft offer changed (discount ${o.discountPct} → ${i.discount} %)`, area: 'Deals', entityType: 'offer', entityId: o.id });
    });
  }, dealPaths(ref));
}

/** Review decision (D-8): the sales direction; for a discount beyond the threshold, the general management too (D-4). */
export async function reviewOfferAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('validate_prices');
    const decision = z.enum(['go', 'no_go']).parse(str(fd, 'decision'));
    const comment = opt(fd, 'comment');
    if (decision === 'no_go' && !comment) throw new Refusal('A no-go needs a comment');
    await tx(async (t, today) => {
      const w = await world(t, today);
      const d = w.rows.dealRows.find((x) => x.ref === ref);
      if (!d) throw new Refusal('Deal not found');
      const o = (w.offersOf.get(d.id) ?? []).find((x) => x.letter === str(fd, 'letter'));
      if (!o || o.state !== 'draft') throw new Refusal('Only a draft offer is reviewed');
      const check = offerReview(w, o);
      const level = can(v.roles, 'deal') ? 'sales_director' : 'general_management';
      if (level === 'general_management' && !check.needsGeneralManagement) throw new Refusal('This offer is reviewed by the sales direction');
      await t.insert(offerReviews).values({ offerId: o.id, level, decision, comment, checks: check.items, decidedById: v.userId, decidedByName: v.name });
      await audit(t, v, { objectRef: `${ref} · ${o.letter}`, change: `review: ${decision === 'go' ? 'go' : 'no-go'} (${level})`, area: 'Deals', entityType: 'offer', entityId: o.id, reason: comment });
    });
  }, dealPaths(ref));
}

export async function sendOfferAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('deal');
    const rate = num(fd, 'rate');
    await tx(async (t, today) => {
      const w = await world(t, today);
      const d = dealFor(w, v, ref);
      const o = (w.offersOf.get(d.id) ?? []).find((x) => x.letter === str(fd, 'letter'));
      if (!o) throw new Refusal('Offer not found');
      await sendOffer(t, w, o, actorOf(v), { rate, on: today });
    });
  }, dealPaths(ref));
}

/** The order (docs/spec/02 § 3): the sold configuration v1, frozen copy of the offer retained; the deal won. */
export async function recordOrderAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('deal');
    const i = z.object({ orderedOn: isoDay, customerRef: z.string().min(2, 'The customer’s order reference is required').max(60), project: z.string().regex(FORMATS.keystoneProject, 'Keystone project code: capitals, digits and dashes').nullable() })
      .parse({ orderedOn: str(fd, 'orderedOn'), customerRef: str(fd, 'customerRef'), project: opt(fd, 'project')?.toUpperCase() ?? null });
    await tx(async (t, today) => {
      if (i.orderedOn > today) throw new Refusal('The order date is in the future');
      const w = await world(t, today);
      const d = dealFor(w, v, ref);
      const o = (w.offersOf.get(d.id) ?? []).find((x) => x.letter === str(fd, 'letter'));
      if (!o) throw new Refusal('Offer not found');
      await recordOrder(t, w, o, actorOf(v), { orderedOn: i.orderedOn, customerOrderRef: i.customerRef, keystoneProject: i.project });
    });
  }, [...dealPaths(ref), '/sold']);
}

// ── Sold configurations ────────────────────────────────────────────────────────────────────────────────────────────

export async function amendAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('deal');
    const reason = reasonOf(fd);
    const line = z.number().int().min(1).parse(num(fd, 'line') ?? 1);
    await tx(async (t, today) => {
      const w = await world(t, today);
      const cur = w.soldVersions.get(ref)?.at(-1);
      if (!cur) throw new Refusal('Sold configuration not found');
      dealFor(w, v, w.dealBy.get(cur.dealId)!.ref);
      await amend(t, w, ref, actorOf(v), { line, add: all(fd, 'add'), remove: all(fd, 'remove'), reason, on: today });
    });
  }, ['/sold', `/sold/${ref}`]);
}

/** Links the Keystone project created from the sold configuration (once; contract K-10). */
export async function linkProjectAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('deal');
    const project = z.string().regex(FORMATS.keystoneProject, 'Keystone project code: capitals, digits and dashes').parse(str(fd, 'project').toUpperCase());
    await tx(async (t, today) => {
      const w = await world(t, today);
      const versions = w.soldVersions.get(ref);
      if (!versions) throw new Refusal('Sold configuration not found');
      dealFor(w, v, w.dealBy.get(versions[0].dealId)!.ref);
      if (versions.some((x) => x.keystoneProject)) throw new Refusal('The Keystone project is already linked');
      await t.update(soldConfigurations).set({ keystoneProject: project }).where(eq(soldConfigurations.ref, ref));
      await audit(t, v, { objectRef: ref, change: `Keystone project linked: ${project}`, area: 'Sold configurations' });
    });
  }, ['/sold', `/sold/${ref}`]);
}

/** The project's return (D-9), entered by the portfolio management until Keystone publishes it (request K-2). */
export async function recordFeedbackAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('feedback');
    const n = (k: string) => z.number({ message: 'Every real cost is required' }).min(0).parse(num(fd, k));
    const stage = z.enum(['closure', 'warranty_end']).parse(str(fd, 'stage') || 'closure');
    await tx(async (t, today) => {
      const w = await world(t, today);
      const cur = w.soldVersions.get(ref)?.at(-1);
      if (!cur) throw new Refusal('Sold configuration not found');
      const [f] = await t.insert(projectFeedback).values({
        soldRef: ref, stage, receivedOn: today, materialKeur: n('material'), subcontractingKeur: n('subcontracting'), engineeringKeur: n('engineering'), workshopKeur: n('workshop'), siteKeur: n('site'),
        expensesKeur: n('expenses'), engineeringHours: n('engineeringHours'), workshopHours: n('workshopHours'), siteHours: n('siteHours'), rexRef: opt(fd, 'rexRef'), rexSummary: opt(fd, 'rexSummary'),
        majorDifficulty: bool(fd, 'major'), source: 'entered', recordedByName: v.name,
      }).returning({ id: projectFeedback.id });
      for (const l of cur.content.lines)
        for (const x of l.options) {
          const o = w.optionByCode.get(x.code);
          if (!o) continue;
          const delivered = all(fd, 'delivered').includes(x.code);
          const actual = num(fd, `actual_${x.code}`);
          await t.insert(feedbackOptions).values({ feedbackId: f.id, optionId: o.id, delivered, budgetKeur: (x.budgetKeur ?? 0) * l.quantity, actualKeur: delivered ? actual : null }).onConflictDoNothing();
        }
      await audit(t, v, { objectRef: ref, change: `project return recorded (${stage})`, area: 'Sold configurations', entityType: 'project_feedback', entityId: f.id });
    });
  }, ['/', '/sold', `/sold/${ref}`, '/knowhow']);
}

// ── Quotation requests ─────────────────────────────────────────────────────────────────────────────────────────────

export async function createQuoteAction(_: Prev, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('quote_request');
    const i = z.object({ deal: z.string().regex(FORMATS.dealRef, 'A deal is required'), title: z.string().min(3, 'A title is required').max(200), machine: z.string(), category: z.enum(OPTION_CATEGORIES), cls: z.enum(ESTIMATE_CLASSES) })
      .parse({ deal: str(fd, 'deal'), title: str(fd, 'title'), machine: str(fd, 'machine'), category: str(fd, 'category'), cls: str(fd, 'cls') || 'quote' });
    await tx(async (t, today) => {
      const w = await world(t, today);
      const d = dealFor(w, v, i.deal);
      activeDeal(d);
      const m = w.machineByCode.get(i.machine);
      if (!m) throw new Refusal('Unknown machine');
      const common = w.rows.questionnaireRows.find((q) => q.family === 'common' && q.state === 'published');
      if (!common) throw new Refusal('No published common questionnaire');
      const family = w.rows.questionnaireRows.find((q) => q.family === familyKey(m.typeCode, i.category) && q.state === 'published');
      const ref = await nextRef(t, 'DC', today);
      const [r] = await t.insert(quoteRequests).values({
        ref, title: i.title, origin: 'deal', dealId: d.id, capexNeed: d.capexNeed, machineId: m.id, category: i.category, estimateClass: i.cls, receivedOn: today, targetDays: w.settings.targetDays[i.cls],
        followedById: v.userId, followedByName: v.name, commonQuestionnaireId: common.id, familyQuestionnaireId: family?.id ?? null,
      }).returning({ id: quoteRequests.id });
      if (d.state === 'open') await t.update(deals).set({ state: 'quoting', updatedAt: new Date() }).where(eq(deals.id, d.id));
      await audit(t, v, { objectRef: ref, change: `quotation request opened for ${i.deal} (${i.cls}, ${w.settings.targetDays[i.cls]} working days)`, area: 'Quotations', entityType: 'quote_request', entityId: r.id });
    });
  }, ['/', '/quotes', `/deals/${str(fd, 'deal')}`]);
}

/** The questionnaire's answers, entered by the account manager (cases 2 and 3: reported from the client, D-17) or the requester. */
export async function saveAnswersAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('quote_request');
    await tx(async (t, today) => {
      const w = await world(t, today);
      const r = w.rows.quoteRows.find((x) => x.ref === ref);
      if (!r || (r.dealId && !canSeeDealPrices(v.roles, (w.membersOf.get(r.dealId) ?? []).some((m) => m.userId === v.userId)))) throw new Refusal('Quotation request not found');
      if (r.state !== 'qualification') throw new Refusal('The answers are frozen once the request is qualified');
      const qs = [...(w.questionsOf.get(r.commonQuestionnaireId) ?? []), ...(r.familyQuestionnaireId ? w.questionsOf.get(r.familyQuestionnaireId) ?? [] : [])];
      let n = 0;
      for (const q of qs) {
        if (!fd.has(`q_${q.id}`)) continue;
        const value = str(fd, `q_${q.id}`).slice(0, 4000);
        if (q.answerType === 'number' && value && Number.isNaN(Number(value.replace(',', '.')))) throw new Refusal(`A number is expected: ${q.text}`);
        await t.delete(quoteAnswers).where(and(eq(quoteAnswers.requestId, r.id), eq(quoteAnswers.questionId, q.id)));
        if (value) {
          await t.insert(quoteAnswers).values({ requestId: r.id, questionId: q.id, value, enteredByName: v.name });
          n++;
        }
      }
      await audit(t, v, { objectRef: ref, change: `${n} answers recorded`, area: 'Quotations', entityType: 'quote_request', entityId: r.id });
    });
  }, ['/quotes', `/quotes/${ref}`]);
}

/** Qualification by engineering (docs/spec/03 § 3.1): refused while a required answer is missing. */
export async function qualifyQuoteAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('qualify');
    const i = z.object({ feasibility: z.enum(FEASIBILITIES), level: z.enum(KNOWHOW_LEVELS), note: z.string().max(2000).nullable() })
      .parse({ feasibility: str(fd, 'feasibility'), level: str(fd, 'level') || 'never', note: opt(fd, 'note') });
    if (i.feasibility === 'refused' && !i.note) throw new Refusal('A refusal needs its reason');
    await tx(async (t, today) => {
      const w = await world(t, today);
      const r = w.rows.quoteRows.find((x) => x.ref === ref);
      if (!r) throw new Refusal('Quotation request not found');
      if (r.state !== 'qualification' && r.state !== 'estimating') throw new Refusal('This request is closed');
      const qs = [...(w.questionsOf.get(r.commonQuestionnaireId) ?? []), ...(r.familyQuestionnaireId ? w.questionsOf.get(r.familyQuestionnaireId) ?? [] : [])];
      const missing = missingAnswers(qs, new Map((w.answersOf.get(r.id) ?? []).map((a) => [a.questionId, a.value])));
      if (missing.length && i.feasibility !== 'refused') throw new Refusal('The request is incomplete: required answers are missing');
      await t.update(quoteRequests).set({ feasibility: i.feasibility, proposedLevel: i.level, qualificationNote: i.note, qualifiedByName: v.name, qualifiedOn: today, state: i.feasibility === 'refused' ? 'refused' : 'estimating', updatedAt: new Date() }).where(eq(quoteRequests.id, r.id));
      await audit(t, v, { objectRef: ref, change: `qualified: ${i.feasibility}`, area: 'Quotations', entityType: 'quote_request', entityId: r.id, reason: i.note });
    });
  }, ['/', '/quotes', `/quotes/${ref}`]);
}

const deltaLine = z.tuple([z.string().regex(FORMATS.article, 'BOM delta: ART- then 6 digits'), z.string().min(2), z.number().positive(), z.enum(UNITS)]);

/** The estimate (docs/spec/03 § 3.2): budget per post, sale price, extra lead time, validity, assumptions and BOM delta ("ART-…; designation; qty; unit" per line). */
export async function saveEstimateAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('estimate');
    const n = (k: string) => z.number({ message: 'Every post is required (0 when none)' }).min(0).parse(num(fd, k) ?? 0);
    const sale = z.number({ message: 'A sale price is required' }).positive('A sale price is required').parse(num(fd, 'sale'));
    const deltas = str(fd, 'deltas').split('\n').map((x) => x.trim()).filter(Boolean).map((x) => {
      const p = x.split(';').map((y) => y.trim());
      return deltaLine.parse([p[0]?.toUpperCase(), p[1], Number((p[2] ?? '').replace(',', '.')), p[3] || 'u']);
    });
    await tx(async (t, today) => {
      const w = await world(t, today);
      const r = w.rows.quoteRows.find((x) => x.ref === ref);
      if (!r || r.state !== 'estimating') throw new Refusal('Only a qualified request is estimated');
      const values = {
        materialKeur: n('material'), subcontractingKeur: n('subcontracting'), engineeringHours: n('engineeringHours'), workshopHours: n('workshopHours'), siteHours: n('siteHours'), expensesKeur: n('expenses'),
        saleKeur: sale, extraWeeks: Math.round(n('weeks')), validityDays: Math.round(num(fd, 'validity') ?? w.settings.quoteValidityDays), assumptions: opt(fd, 'assumptions'), estimatedByName: v.name, updatedAt: new Date(),
      };
      await t.insert(quoteEstimates).values({ requestId: r.id, ...values }).onConflictDoUpdate({ target: quoteEstimates.requestId, set: values });
      await t.delete(quoteBomDeltas).where(eq(quoteBomDeltas.requestId, r.id));
      if (deltas.length) await t.insert(quoteBomDeltas).values(deltas.map(([article, designation, quantity, unit]) => ({ requestId: r.id, op: 'add', article, designation, quantity, unit })));
      await audit(t, v, { objectRef: ref, change: `estimate saved (${sale} k€, ${deltas.length} BOM lines)`, area: 'Quotations', entityType: 'quote_request', entityId: r.id });
    });
  }, [`/quotes/${ref}`]);
}

/**
 * Publishes the answer (docs/spec/03 § 3.3–4): the request answered, its specific option created (SPE-…, bound to its deal) and
 * added to the deal's line of that machine, if any. Arche reads the answer through modulus.pub_cotations.
 */
export async function answerQuoteAction(ref: string): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('estimate');
    await tx(async (t, today) => {
      const w = await world(t, today);
      const r = w.rows.quoteRows.find((x) => x.ref === ref);
      if (!r || r.state !== 'estimating') throw new Refusal('Only a qualified request is answered');
      const e = w.estimateBy.get(r.id);
      if (!e) throw new Refusal('Save the estimate first');
      await t.update(quoteRequests).set({ state: 'answered', answeredOn: today, answeredByName: v.name, updatedAt: new Date() }).where(eq(quoteRequests.id, r.id));
      const [o] = await t.insert(options).values({ code: `SPE-${ref.slice(3)}`, label: r.title.slice(0, 160), category: r.category, origin: 'specific', quoteRequestId: r.id, extraWeeks: e.extraWeeks }).returning({ id: options.id });
      await t.insert(optionMachines).values({ optionId: o.id, machineId: r.machineId });
      if (r.dealId) {
        const line = (w.linesOf.get(r.dealId) ?? []).find((l) => w.versionBy.get(l.machineVersionId)?.machineId === r.machineId);
        if (line) await t.insert(dealLineOptions).values({ lineId: line.id, optionId: o.id }).onConflictDoNothing();
      }
      await audit(t, v, { objectRef: ref, change: `answer published: SPE-${ref.slice(3)} at ${e.saleKeur} k€, +${e.extraWeeks} weeks`, area: 'Quotations', entityType: 'quote_request', entityId: r.id });
    });
  }, ['/', '/quotes', `/quotes/${ref}`, '/deals']);
}

export async function cancelQuoteAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('quote_request');
    const reason = reasonOf(fd);
    await tx(async (t) => {
      const [r] = await t.select().from(quoteRequests).where(eq(quoteRequests.ref, ref));
      if (!r || !['qualification', 'estimating'].includes(r.state)) throw new Refusal('This request is closed');
      await t.update(quoteRequests).set({ state: 'cancelled', cancelReason: reason, updatedAt: new Date() }).where(eq(quoteRequests.id, r.id));
      await audit(t, v, { objectRef: ref, change: 'quotation request cancelled', area: 'Quotations', entityType: 'quote_request', entityId: r.id, reason });
    });
  }, ['/', '/quotes', `/quotes/${ref}`]);
}

/** A message in the thread of a request (append-only): any role that takes part in quotations. */
export async function postMessageAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await (async () => {
      const { getViewer } = await import('@/server/session');
      const x = await getViewer();
      if (!(['quote_request', 'qualify', 'estimate'] as const).some((r) => can(x.roles, r))) throw new Refusal(FORBIDDEN);
      return x;
    })();
    const body = z.string().min(2, 'A message is required').max(4000).parse(str(fd, 'body'));
    await tx(async (t) => {
      const [r] = await t.select().from(quoteRequests).where(eq(quoteRequests.ref, ref));
      if (!r) throw new Refusal('Quotation request not found');
      await t.insert(quoteMessages).values({ requestId: r.id, authorName: v.name, body });
      await audit(t, v, { objectRef: ref, change: 'message added to the thread', area: 'Quotations', entityType: 'quote_request', entityId: r.id });
    });
  }, [`/quotes/${ref}`]);
}

// ── Know-how (engineering) ─────────────────────────────────────────────────────────────────────────────────────────

export async function knowhowNoteAction(_: Prev, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('knowhow');
    const kind = z.enum(['note', 'avoid', 'clear_avoid']).parse(str(fd, 'kind') || 'note');
    const body = z.string().min(3, kind === 'note' ? 'A note is required' : 'A reason is required').max(2000).parse(str(fd, 'body'));
    await tx(async (t) => {
      const [o] = await t.select().from(options).where(eq(options.code, str(fd, 'option')));
      if (!o) throw new Refusal('Unknown option');
      const machine = opt(fd, 'machine');
      const [m] = machine ? await t.select().from(machines).where(eq(machines.code, machine)) : [null];
      await t.insert(knowhowNotes).values({ optionId: o.id, machineId: m?.id ?? null, kind, body, authorName: v.name });
      await audit(t, v, { objectRef: `${o.code}${m ? ` × ${m.code}` : ''}`, change: kind === 'avoid' ? 'marked “to avoid”' : kind === 'clear_avoid' ? '“to avoid” mark lifted' : 'know-how note added', area: 'Know-how', reason: kind === 'note' ? null : body });
    });
  }, ['/', '/knowhow']);
}

// ── Questionnaires (engineering, D-10) ─────────────────────────────────────────────────────────────────────────────

/** A new questionnaire family (type × category), or a new draft version of a family copied from the published one. */
export async function draftQuestionnaireAction(_: Prev, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('questionnaires');
    const type = opt(fd, 'type');
    const category = opt(fd, 'category');
    const family = type && category ? familyKey(z.string().regex(FORMATS.typeCode).parse(type), z.enum(OPTION_CATEGORIES).parse(category)) : str(fd, 'family');
    await tx(async (t) => {
      const versions = (await t.select().from(questionnaires).where(eq(questionnaires.family, family))).sort((a, b) => b.version - a.version);
      if (versions.some((x) => x.state === 'draft')) throw new Refusal('A draft version already exists');
      if (!versions.length && family !== 'common') {
        const [mt] = await t.select().from(characteristicDefs).where(eq(characteristicDefs.typeCode, family.split(':')[0])).limit(1);
        if (!mt && !(await t.select().from(machines).where(eq(machines.typeCode, family.split(':')[0])).limit(1)).length) throw new Refusal('Unknown machine type');
      }
      const label = str(fd, 'label') || versions[0]?.label || family;
      const [q] = await t.insert(questionnaires).values({ family, label, version: (versions[0]?.version ?? 0) + 1 }).returning({ id: questionnaires.id });
      const pub = versions.find((x) => x.state === 'published');
      if (pub) {
        const qs = await t.select().from(questions).where(eq(questions.questionnaireId, pub.id));
        if (qs.length) await t.insert(questions).values(qs.map((x) => ({ questionnaireId: q.id, position: x.position, theme: x.theme, text: x.text, answerType: x.answerType, unit: x.unit, choices: x.choices, required: x.required })));
      }
      await audit(t, v, { objectRef: `${family} v${(versions[0]?.version ?? 0) + 1}`, change: 'questionnaire draft created', area: 'Questionnaires', entityType: 'questionnaire', entityId: q.id });
    });
  }, ['/admin/questionnaires']);
}

export async function addQuestionAction(_: Prev, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('questionnaires');
    const i = z.object({ theme: z.enum(QUESTION_THEMES), text: z.string().min(3, 'The question is required').max(300), type: z.enum(ANSWER_TYPES), unit: z.string().max(20).nullable(), choices: z.string().max(300).nullable(), required: z.boolean() })
      .parse({ theme: str(fd, 'theme'), text: str(fd, 'text'), type: str(fd, 'type'), unit: opt(fd, 'unit'), choices: opt(fd, 'choices'), required: bool(fd, 'required') });
    if (i.type === 'choice' && !i.choices) throw new Refusal('A choice question lists its choices');
    await tx(async (t) => {
      const [q] = await t.select().from(questionnaires).where(eq(questionnaires.id, str(fd, 'questionnaire')));
      if (!q || q.state !== 'draft') throw new Refusal('Only a draft questionnaire is changed');
      const [{ n }] = await t.select({ n: sql<number>`coalesce(max(${questions.position}), 0)::int` }).from(questions).where(eq(questions.questionnaireId, q.id));
      await t.insert(questions).values({ questionnaireId: q.id, position: n + 1, theme: i.theme, text: i.text, answerType: i.type, unit: i.unit, choices: i.type === 'choice' ? i.choices : null, required: i.required });
      await audit(t, v, { objectRef: `${q.family} v${q.version}`, change: `question added: ${i.text}`, area: 'Questionnaires', entityType: 'questionnaire', entityId: q.id });
    });
  }, ['/admin/questionnaires']);
}

export async function toggleRequiredAction(questionId: string): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('questionnaires');
    await tx(async (t) => {
      const [x] = await t.select().from(questions).where(eq(questions.id, questionId));
      if (!x) throw new Refusal('Unknown question');
      await t.update(questions).set({ required: !x.required }).where(eq(questions.id, x.id));
      await audit(t, v, { objectRef: x.text, change: x.required ? 'question made optional' : 'question made required', area: 'Questionnaires', entityType: 'questionnaire', entityId: x.questionnaireId });
    });
  }, ['/admin/questionnaires']);
}

export async function removeQuestionAction(questionId: string): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('questionnaires');
    await tx(async (t) => {
      const [x] = await t.select().from(questions).where(eq(questions.id, questionId));
      if (!x) throw new Refusal('Unknown question');
      if ((await t.select().from(quoteAnswers).where(eq(quoteAnswers.questionId, x.id)).limit(1)).length) throw new Refusal('This question has answers');
      await t.delete(questions).where(eq(questions.id, x.id));
      await audit(t, v, { objectRef: x.text, change: 'question removed from the draft', area: 'Questionnaires', entityType: 'questionnaire', entityId: x.questionnaireId });
    });
  }, ['/admin/questionnaires']);
}

/** Publishes a draft questionnaire and retires the previous version; requests in progress keep their version. */
export async function publishQuestionnaireAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('questionnaires');
    await tx(async (t) => {
      const [q] = await t.select().from(questionnaires).where(eq(questionnaires.id, id));
      if (!q || q.state !== 'draft') throw new Refusal('Only a draft questionnaire is published');
      if (!(await t.select().from(questions).where(eq(questions.questionnaireId, q.id)).limit(1)).length) throw new Refusal('A questionnaire needs at least one question');
      await t.update(questionnaires).set({ state: 'retired', updatedAt: new Date() }).where(and(eq(questionnaires.family, q.family), eq(questionnaires.state, 'published')));
      await t.update(questionnaires).set({ state: 'published', publishedAt: new Date(), updatedAt: new Date() }).where(eq(questionnaires.id, q.id));
      await audit(t, v, { objectRef: `${q.family} v${q.version}`, change: 'questionnaire published', area: 'Questionnaires', entityType: 'questionnaire', entityId: q.id });
    });
  }, ['/admin/questionnaires']);
}

// ── Settings (D-11, D-12) ──────────────────────────────────────────────────────────────────────────────────────────

export async function saveSettingsAction(_: Prev, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('settings');
    const n = (k: string) => num(fd, k);
    const value = SettingsSchema.parse({
      targetDays: { indicative: n('t_indicative'), quote: n('t_quote'), firm: n('t_firm') },
      reminderDays: { indicative: n('r_indicative'), quote: n('r_quote'), firm: n('r_firm') },
      reviewAboveKeur: n('reviewAboveKeur'), minMarginPct: n('minMarginPct'), discountGeneralPct: n('discountGeneralPct'), priceListAlertDays: n('priceListAlertDays'),
      offerValidityDays: n('offerValidityDays'), quoteValidityDays: n('quoteValidityDays'), masteredDeliveries: n('masteredDeliveries'), masteredGapPct: n('masteredGapPct'),
      avoidGapPct: n('avoidGapPct'), proposeAfterSales: n('proposeAfterSales'), unsoldMonths: n('unsoldMonths'),
      rates: { engineering_hours: n('rate_engineering_hours'), workshop_hours: n('rate_workshop_hours'), site_hours: n('rate_site_hours') },
    });
    await tx(async (t) => {
      const [before] = await t.select().from(appSettings).where(eq(appSettings.key, SETTINGS_KEY));
      await t.insert(appSettings).values({ key: SETTINGS_KEY, value, updatedByName: v.name }).onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date(), updatedByName: v.name } });
      await audit(t, v, { objectRef: 'Lead times and thresholds', change: 'settings saved', area: 'Administration', before: (before?.value as Record<string, unknown>) ?? null, after: value });
    });
  }, ['/', '/admin/settings']);
}

export async function resetSettingsAction(): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('settings');
    await tx(async (t) => {
      await t.insert(appSettings).values({ key: SETTINGS_KEY, value: DEFAULT_SETTINGS, updatedByName: v.name }).onConflictDoUpdate({ target: appSettings.key, set: { value: DEFAULT_SETTINGS, updatedAt: new Date(), updatedByName: v.name } });
      await audit(t, v, { objectRef: 'Lead times and thresholds', change: 'default values restored', area: 'Administration', after: DEFAULT_SETTINGS });
    });
  }, ['/', '/admin/settings']);
}
