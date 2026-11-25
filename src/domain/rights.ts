// What each role may do in Modulus (questions U-1, U-2, D-4, D-15). Pure; every Server Function asks these with the viewer's
// roles (cumulative) and the data layer hides what a role may not see (costs, the prices of another team's deal).
import type { RoleKey } from '@/config/roles';

export type Right =
  | 'deal' // open and run a deal, its lines, offers, order and amendments
  | 'see_costs' // budget and margin (D-15)
  | 'all_deals' // the prices and sheet of every deal, not only those of the viewer's team (U-2)
  | 'catalogue' // machines, versions, options, rules, BOM, characteristics (engineering)
  | 'budget' // budgets per post, price lists proposed (estimator)
  | 'validate_prices' // price lists validated, offer review decided (D-4)
  | 'validate_discount' // a discount beyond the threshold validated a second time (D-4)
  | 'quote_request' // open a quotation request, enter the client's answers
  | 'qualify' // qualify a quotation request (engineering)
  | 'estimate' // estimate and answer a quotation request (estimator)
  | 'questionnaires' // the standard questionnaires (D-10)
  | 'knowhow' // notes and "to avoid" marks (engineering)
  | 'feedback' // the project's return (Keystone's portfolio management, until view K-2 exists)
  | 'settings' // lead times and thresholds (D-11, D-12)
  | 'journal';

const RIGHTS: Record<RoleKey, readonly Right[]> = {
  sales_director: ['deal', 'see_costs', 'all_deals', 'validate_prices', 'quote_request', 'settings', 'journal'],
  general_management: ['see_costs', 'all_deals', 'validate_prices', 'validate_discount'],
  portfolio_management: ['see_costs', 'feedback'],
  estimator: ['see_costs', 'budget', 'estimate', 'quote_request'],
  engineering: ['catalogue', 'qualify', 'questionnaires', 'knowhow'],
  sales: ['deal', 'quote_request'],
  admin: ['settings', 'journal'],
  reader: [],
};

/** True when one of the roles carries the right. */
export const can = (roles: readonly RoleKey[], right: Right) => roles.some((r) => RIGHTS[r].includes(right));

/** Budget and margin (question D-15): estimators and the directions, never the account managers. */
export const canSeeCosts = (roles: readonly RoleKey[]) => can(roles, 'see_costs');

/** The prices of a deal (U-2): its team and the directions; others see the list without the prices. */
export const canSeeDealPrices = (roles: readonly RoleKey[], inTeam: boolean) => inTeam || can(roles, 'all_deals');

/** Refusal message of a missing right (EN source string). */
export const FORBIDDEN = 'You do not have the right to do this';
