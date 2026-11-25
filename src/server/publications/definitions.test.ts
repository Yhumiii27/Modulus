// The reference queries of Modulus's publications run on the demonstration database, pub_catalogue_machines keeps the K-01
// contract, and the views read by Arche never publish a budget, a cost or a margin (two prices never mixed).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabase, type TestDatabase } from '@/test/db';
import { K01_COLUMNS, PUBLICATIONS } from './definitions';

let t: TestDatabase;
beforeAll(async () => {
  t = await testDatabase();
});
afterAll(() => t.close());

describe('publications', () => {
  it('every reference query runs and returns rows', async () => {
    for (const [name, q] of Object.entries(PUBLICATIONS)) {
      const r = await t.handle.pool.query(q);
      expect(r.rows.length, name).toBeGreaterThan(0);
    }
  });
  it('pub_catalogue_machines keeps the K-01 contract and never publishes a draft', async () => {
    const r = await t.handle.pool.query(PUBLICATIONS.pub_catalogue_machines);
    expect(r.fields.map((f) => f.name).slice(0, K01_COLUMNS.length)).toEqual([...K01_COLUMNS]);
    expect(new Set(r.rows.map((x) => x.statut))).toEqual(new Set(['publie', 'retire']));
    expect(r.rows.some((x) => x.code === 'MEMU-120')).toBe(false);
  });
  it('no budget, cost or margin in the views read by Arche', async () => {
    for (const name of ['pub_catalogue_machines', 'pub_catalogue_options', 'pub_cotations', 'pub_configurations_vendues'] as const) {
      const r = await t.handle.pool.query(PUBLICATIONS[name]);
      for (const f of r.fields) expect(f.name, name).not.toMatch(/budget|cout|cost|marge|margin/);
      expect(JSON.stringify(r.rows), name).not.toMatch(/udget/);
    }
  });
});
