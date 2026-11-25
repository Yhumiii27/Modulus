// A refusal with a message for the person (EN source string), and the yearly references AF-, DC-, CV- (counter row locked
// by the write lock of the transaction). No `server-only`: the seed uses them under plain Node.
import { sql } from 'drizzle-orm';
import { counters } from '@/server/db/schema';
import type { Tx } from '@/server/db/types';

export class Refusal extends Error {}

/** Next yearly reference "AF-2026-0052". */
export async function nextRef(tx: Tx, prefix: 'AF' | 'DC' | 'CV', today: string): Promise<string> {
  const year = +today.slice(0, 4);
  const [row] = await tx
    .insert(counters).values({ prefix, year, value: 1 })
    .onConflictDoUpdate({ target: [counters.prefix, counters.year], set: { value: sql`${counters.value} + 1` } })
    .returning({ value: counters.value });
  return `${prefix}-${year}-${String(row.value).padStart(4, '0')}`;
}
