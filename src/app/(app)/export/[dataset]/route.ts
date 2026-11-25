// GET /export/<dataset> — CSV exports: deals (prices only for their team and the directions, U-2; no cost) and the know-how map.
// Read with the viewer's rights; the export is journalled. Never cached.
import { toCsv } from '@/domain/csv';
import { businessToday } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { writeAudit } from '@/server/db/helpers';
import { dealAccess, loadWorld } from '@/server/dal/world';
import { getViewer } from '@/server/session';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ dataset: string }> }): Promise<Response> {
  const [{ dataset }, viewer, today] = await Promise.all([params, getViewer(), businessToday()]);
  const w = await loadWorld(today);
  let header: string[];
  let rows: unknown[][];
  switch (dataset) {
    case 'deals':
      header = ['ref', 'sale_case', 'customer', 'intermediary', 'capex_need', 'state', 'owner', 'probability', 'amount_keur', 'weighted_keur', 'loss_reason'];
      rows = [...w.rows.dealRows].sort((a, b) => a.ref.localeCompare(b.ref)).map((d) => {
        const a = dealAccess(w, viewer, d.id).prices ? w.dealAmount(d.id) : null;
        return [d.ref, d.saleCase, w.customerBy.get(d.customerId)?.name, d.intermediaryId ? w.customerBy.get(d.intermediaryId)?.name : null, d.capexNeed, d.state, d.ownerName, d.probability, a, a != null ? Math.round((a * d.probability) / 100) : null, d.lossReason];
      });
      break;
    case 'knowhow':
      header = ['machine', 'option', 'label', 'level', 'quoted', 'sold', 'delivered'];
      rows = w.rows.optionMachineRows.map((x) => {
        const m = w.machineBy.get(x.machineId)!;
        const o = w.optionBy.get(x.optionId)!;
        const tr = w.traceOf(m.id, o.id);
        return [m.code, o.code, o.label, w.levelAt(m.id, o.id), tr.quoted, tr.sold, tr.deliveries.length];
      });
      break;
    default:
      return new Response('Not found', { status: 404 });
  }
  await writeAudit(await getDb(), { actorName: viewer.name, actorUserId: viewer.userId, actorRole: viewer.role, objectRef: `Export ${dataset}`, change: `${rows.length} rows exported`, area: 'Administration' });
  return new Response(toCsv(header, rows), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="modulus-${dataset}-${today}.csv"`, 'Cache-Control': 'no-store' },
  });
}
