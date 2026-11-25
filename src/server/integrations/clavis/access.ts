import 'server-only';
// Roles granted by Clavis, read in its publication clavis.pub_acces on the shared server (Norma § 6; MODULUS_ACCESS_FROM_CLAVIS=on).
// Read with Modulus's own connection (role modulus_app, SELECT granted by Matrix — request M-1) at sign-in and on every request,
// so a change made by IT in Clavis applies at the next page. Never writes. A failure (view or grant missing) throws: the caller
// refuses the access (fail closed).
import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';

export const CLAVIS_ACCESS_VIEW = 'clavis.pub_acces';

/** The person's Modulus row of clavis.pub_acces (`personne_id` = the `oid` of the sign-in token), or null. */
export async function readClavisAccess(personId: string): Promise<Record<string, unknown> | null> {
  const db = await getDb();
  const res = (await db.execute(sql`select to_jsonb(v) as r from ${sql.raw(CLAVIS_ACCESS_VIEW)} v
    where v.personne_id::text = ${personId} and v.application = 'modulus' limit 1`)) as unknown as { rows: { r: Record<string, unknown> | string }[] };
  const r = res.rows[0]?.r;
  return r == null ? null : typeof r === 'string' ? (JSON.parse(r) as Record<string, unknown>) : r;
}
