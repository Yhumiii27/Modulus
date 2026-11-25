// The outbox to Codex (docs/spec/05 § 3: the PDF of a sent offer is filed in Codex, Modulus keeps its reference). Simulated
// until the Codex connector is validated (request to Codex, POST /api/documents): the job gives each pending message a
// reference "OFR-SIM-…" and records it on the offer (the frozen-offer trigger allows the reference to be set once).
import { and, eq } from 'drizzle-orm';
import { writeAudit } from '@/server/db/helpers';
import { deals, offers, outbox } from '@/server/db/schema';
import type { DB } from '@/server/db/types';

export async function runOutbox(db: DB): Promise<number> {
  const pending = await db.select().from(outbox).where(eq(outbox.state, 'pending'));
  for (const m of pending) {
    await db.transaction(async (t) => {
      const ref = `OFR-SIM-${m.objectRef.replace(/[^A-Z0-9]+/g, '-')}`;
      if (m.kind === 'offer_pdf') {
        const [deal, letter] = [String(m.payload.deal), String(m.payload.offer)];
        const [d] = await t.select().from(deals).where(eq(deals.ref, deal));
        if (d) await t.update(offers).set({ codexRef: ref }).where(and(eq(offers.dealId, d.id), eq(offers.letter, letter)));
      }
      await t.update(outbox).set({ state: 'sent', sentAt: new Date(), resultRef: ref }).where(eq(outbox.id, m.id));
      await writeAudit(t, { actorName: 'Codex (simulation)', actorUserId: null, objectRef: m.objectRef, change: `PDF filed in Codex: ${ref}`, area: 'Connectors' });
    });
  }
  return pending.length;
}
