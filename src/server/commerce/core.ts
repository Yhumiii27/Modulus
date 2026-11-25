// Business writes shared by the Server Functions and the demo seed (so the demonstration data are produced by the same rules):
// freezing an offer when it is sent, recording the order (sold configuration v1), an amendment (v n+1). Each runs inside the
// caller's transaction, after the caller checked the right; each re-checks the business rules. No `server-only`.
import { and, eq, inArray } from 'drizzle-orm';
import { addDaysIso } from '@/lib/dates';
import { priceConfiguration, priceLine, type FrozenConfiguration } from '@/domain/offer';
import { reviewCleared, reviewOf } from '@/domain/review';
import { writeAudit } from '@/server/db/helpers';
import { deals, offers, outbox, soldConfigurations } from '@/server/db/schema';
import type { Tx } from '@/server/db/types';
import { Refusal, nextRef } from './refusal';
import type { ModulusWorld, OfferRow } from './world';

export interface Actor {
  userId: string | null;
  name: string;
  role: string | null;
}

const audit = (t: Tx, a: Actor, e: { objectRef: string; change: string; area: string; entityType?: string; entityId?: string; reason?: string | null; occurredAt?: Date }) =>
  writeAudit(t, { ...e, actorName: a.name, actorUserId: a.userId, actorRole: a.role });

/** The configuration of a draft offer, priced now. */
export function draftContent(w: ModulusWorld, offer: OfferRow): FrozenConfiguration {
  return w.configurationOf(offer.dealId, { discountPct: offer.discountPct, currency: offer.currency, rate: null, assumptions: offer.assumptions, reservations: offer.reservations });
}

/** Review of an offer (D-8): the checklist from its content (draft: computed; sent: as frozen). */
export function offerReview(w: ModulusWorld, offer: OfferRow, content = offer.content ?? draftContent(w, offer)) {
  const validUntil = addDaysIso(offer.sentOn ?? w.today, offer.validityDays);
  const list = w.rows.listRows.find((l) => l.code === content.priceList);
  return reviewOf(content, w.settings, { priceListValidTo: list?.validTo ?? null, validUntil });
}

/**
 * Sends a draft offer: computes its content, requires every price, the review cleared when it is required (D-8, D-4) and a
 * rate for another currency (D-14), then freezes it (the trigger keeps it frozen), moves the deal to "offer sent" and queues
 * the PDF deposit to Codex (simulated outbox).
 */
export async function sendOffer(t: Tx, w: ModulusWorld, offer: OfferRow, a: Actor, o: { rate: number | null; on: string }) {
  if (offer.state !== 'draft') throw new Refusal('This offer is already sent');
  const deal = w.dealBy.get(offer.dealId)!;
  if (!['open', 'quoting', 'offer_sent'].includes(deal.state)) throw new Refusal('The deal is closed');
  if (offer.currency !== 'EUR' && !(o.rate && o.rate > 0)) throw new Refusal('The exchange rate of the day is required for another currency');
  const content = { ...draftContent(w, offer), rate: offer.currency === 'EUR' ? null : o.rate };
  if (content.gaps.length) throw new Refusal('Every line needs a sale price before the offer is sent');
  const check = offerReview(w, offer, content);
  if (!reviewCleared(check, w.reviewsOf.get(offer.id) ?? [])) throw new Refusal(check.needsGeneralManagement ? 'A review go of the sales direction and of the general management is required' : 'A review go of the sales direction is required');
  await t.update(offers).set({
    state: 'sent', content, totalSaleKeur: content.saleKeur, totalBudgetKeur: content.budgetKeur, leadWeeks: content.leadWeeks, rate: content.rate, sentOn: o.on, sentByName: a.name,
    updatedAt: new Date(),
  }).where(eq(offers.id, offer.id));
  await t.update(deals).set({ state: 'offer_sent', updatedAt: new Date() }).where(eq(deals.id, deal.id));
  await t.insert(outbox).values({ target: 'codex', kind: 'offer_pdf', objectRef: `${deal.ref}/${offer.letter}`, payload: { deal: deal.ref, offer: offer.letter } });
  await audit(t, a, { objectRef: `${deal.ref} · ${offer.letter}`, change: `offer sent and frozen (${content.saleKeur} k€)`, area: 'Deals', entityType: 'offer', entityId: offer.id });
  return content;
}

/** Records the order: sold configuration v1 = frozen copy of the offer retained; the offer accepted, the others declined, the deal won. */
export async function recordOrder(t: Tx, w: ModulusWorld, offer: OfferRow, a: Actor, o: { orderedOn: string; customerOrderRef: string; keystoneProject: string | null }) {
  if (offer.state !== 'sent' || !offer.content) throw new Refusal('Only a sent offer can be ordered');
  const deal = w.dealBy.get(offer.dealId)!;
  if (deal.state !== 'offer_sent' && deal.state !== 'quoting') throw new Refusal('The deal is closed');
  if (w.soldVersions.size && [...w.soldVersions.values()].some((v) => v[0].dealId === deal.id)) throw new Refusal('This deal is already ordered');
  const ref = await nextRef(t, 'CV', o.orderedOn);
  const [sold] = await t.insert(soldConfigurations).values({
    ref, version: 1, dealId: deal.id, offerId: offer.id, orderedOn: o.orderedOn, customerOrderRef: o.customerOrderRef, content: offer.content,
    totalSaleKeur: offer.totalSaleKeur!, totalBudgetKeur: offer.totalBudgetKeur ?? 0, leadWeeks: offer.leadWeeks!, keystoneProject: o.keystoneProject, createdByName: a.name,
  }).returning({ id: soldConfigurations.id });
  await t.update(offers).set({ state: 'accepted', updatedAt: new Date() }).where(eq(offers.id, offer.id));
  const others = (w.offersOf.get(deal.id) ?? []).filter((x) => x.id !== offer.id && x.state === 'sent').map((x) => x.id);
  if (others.length) await t.update(offers).set({ state: 'declined', updatedAt: new Date() }).where(and(inArray(offers.id, others), eq(offers.state, 'sent')));
  await t.update(deals).set({ state: 'won', probability: 100, updatedAt: new Date() }).where(eq(deals.id, deal.id));
  await audit(t, a, { objectRef: deal.ref, change: `order recorded: ${ref} v1 from offer ${offer.letter}`, area: 'Deals', entityType: 'sold_configuration', entityId: sold.id });
  return ref;
}

/**
 * An amendment (docs/spec/02 § 3): the next version of a sold configuration, with what changes — options added to or removed
 * from a line (priced from the list in force, or a specific option's answer) — and its reason; the totals are recomputed with
 * the discount of the order. The previous versions stay readable.
 */
export async function amend(t: Tx, w: ModulusWorld, ref: string, a: Actor, o: { line: number; add: string[]; remove: string[]; reason: string; on: string }) {
  const versions = w.soldVersions.get(ref);
  if (!versions?.length) throw new Refusal('Sold configuration not found');
  const cur = versions[versions.length - 1];
  const line = cur.content.lines.find((l) => l.number === o.line);
  if (!line) throw new Refusal('Unknown line');
  if (!o.add.length && !o.remove.length) throw new Refusal('An amendment changes at least one option');
  const machine = w.machineByCode.get(line.machine)!;
  const options = line.options.filter((x) => !o.remove.includes(x.code));
  if (options.length !== line.options.length - o.remove.length) throw new Refusal('An option to remove is not in the line');
  for (const code of o.add) {
    const op = w.optionByCode.get(code);
    if (!op || line.options.some((x) => x.code === code)) throw new Refusal('An option to add is unknown or already in the line');
    const sale = w.saleOfOption(op.id);
    if (sale == null) throw new Refusal('An option to add has no sale price');
    options.push({ code, label: op.label, origin: op.origin as never, saleKeur: sale, budgetKeur: w.budgetOfOption(op.id).entered, extraWeeks: op.extraWeeks, level: w.levelAt(machine.id, op.id) });
  }
  const addedDeltas = o.add.flatMap((code) => w.deltasOfOption(w.optionByCode.get(code)!.id));
  const bom = [...line.bom.filter((b) => !o.remove.includes(b.origin ?? '')), ...addedDeltas.filter((d) => d.op === 'add').map((d) => ({ article: d.article, designation: d.designation, quantity: d.quantity ?? 0, unit: d.unit ?? 'u', origin: d.option }))];
  const base = cur.content.lines.find((l) => l.number === o.line)!;
  const newLine = priceLine({ ...base, leadWeeks: w.versionsOf.get(machine.id)?.find((v) => v.version === base.version)?.leadWeeks ?? base.leadWeeks, options: options.sort((x, y) => x.code.localeCompare(y.code)), bom });
  const lines = cur.content.lines.map((l) => (l.number === o.line ? newLine : l));
  const content: FrozenConfiguration = { ...priceConfiguration(lines, { ...cur.content }), gaps: [] };
  const [row] = await t.insert(soldConfigurations).values({
    ref, version: cur.version + 1, dealId: cur.dealId, offerId: cur.offerId, orderedOn: cur.orderedOn, customerOrderRef: cur.customerOrderRef, amendmentReason: o.reason, content,
    totalSaleKeur: content.saleKeur, totalBudgetKeur: content.budgetKeur, leadWeeks: content.leadWeeks, keystoneProject: cur.keystoneProject, createdByName: a.name,
    createdAt: new Date(`${o.on}T10:00:00Z`),
  }).returning({ id: soldConfigurations.id });
  await audit(t, a, { objectRef: `${ref} v${cur.version + 1}`, change: `amendment: ${[...o.add.map((c) => `+${c}`), ...o.remove.map((c) => `−${c}`)].join(' ')}`, area: 'Sold configurations', entityType: 'sold_configuration', entityId: row.id, reason: o.reason });
  return cur.version + 1;
}
