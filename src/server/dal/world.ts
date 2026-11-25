import 'server-only';
// Pages read Modulus through this loader, memoised per request (React cache), and the visibility rules of the viewer: the
// prices of a deal for its team and the directions only (U-2), costs for the roles of D-15 (the pages hide them).
import { cache } from 'react';
import { canSeeCosts, canSeeDealPrices } from '@/domain/rights';
import { loadModulus, type ModulusWorld } from '@/server/commerce/world';
import { getDb } from '@/server/db/client';
import type { Viewer } from '@/server/viewer';

export const loadWorld = cache(async (today: string): Promise<ModulusWorld> => loadModulus(await getDb(), today));

/** True when the viewer is on the team of the deal. */
export const inTeam = (w: ModulusWorld, v: Viewer, dealId: string) => (w.membersOf.get(dealId) ?? []).some((m) => m.userId === v.userId) || w.dealBy.get(dealId)?.ownerId === v.userId;

/** What the viewer may see of a deal: its sheet and prices (team and directions), or the list row only. */
export function dealAccess(w: ModulusWorld, v: Viewer, dealId: string) {
  const prices = canSeeDealPrices(v.roles, inTeam(w, v, dealId));
  return { sheet: prices, prices, costs: prices && canSeeCosts(v.roles) };
}
