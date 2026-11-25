// The database keeps what was sold frozen and the journals append-only (migration 0001), whatever the code does.
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditEntries, bomLines, machineVersions, offerReviews, offers, priceListItems, questions, soldConfigurations } from '@/server/db/schema';
import { testDatabase, type TestDatabase } from '@/test/db';

let t: TestDatabase;
beforeAll(async () => {
  t = await testDatabase();
});
afterAll(() => t.close());

const refused = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return ((e as { cause?: { code?: string } }).cause?.code ?? (e as { code?: string }).code) as string;
  }
};

describe('frozen and append-only', () => {
  it('the demo data set is seeded', async () => {
    expect(await t.db.$count(soldConfigurations)).toBeGreaterThanOrEqual(6);
    expect(await t.db.$count(offers, eq(offers.state, 'sent'))).toBeGreaterThan(0);
  });
  it('a published machine version, its BOM and a published price list are frozen', async () => {
    const [v] = await t.db.select().from(machineVersions).where(eq(machineVersions.state, 'published')).limit(1);
    expect(await refused(t.db.update(machineVersions).set({ leadWeeks: v.leadWeeks + 1 }).where(eq(machineVersions.id, v.id)))).toBe('23001');
    expect(await refused(t.db.update(bomLines).set({ quantity: 9 }).where(eq(bomLines.versionId, v.id)))).toBe('23001');
    expect(await refused(t.db.delete(machineVersions).where(eq(machineVersions.id, v.id)))).toBe('23001');
    expect(await refused(t.db.update(priceListItems).set({ saleKeur: 1 }).where(sql`price_list_id in (select id from modulus.price_lists where state = 'published')`))).toBe('23001');
  });
  it('a sent offer and a sold configuration never change', async () => {
    const [o] = await t.db.select().from(offers).where(eq(offers.state, 'sent')).limit(1);
    expect(await refused(t.db.update(offers).set({ discountPct: 9 }).where(eq(offers.id, o.id)))).toBe('23001');
    expect(await refused(t.db.update(offers).set({ state: 'draft' }).where(eq(offers.id, o.id)))).not.toBeNull();
    const [s] = await t.db.select().from(soldConfigurations).limit(1);
    expect(await refused(t.db.update(soldConfigurations).set({ totalSaleKeur: 1 }).where(eq(soldConfigurations.id, s.id)))).toBe('23001');
    expect(await refused(t.db.delete(soldConfigurations).where(eq(soldConfigurations.id, s.id)))).toBe('23001');
  });
  it('the audit trail, the reviews and a published questionnaire are append-only or frozen', async () => {
    expect(await refused(t.db.update(auditEntries).set({ change: 'x' }))).toBe('23001');
    expect(await refused(t.db.delete(offerReviews))).toBe('23001');
    expect(await refused(t.db.update(questions).set({ required: true }).where(sql`questionnaire_id in (select id from modulus.questionnaires where state = 'published')`))).toBe('23001');
  });
});
