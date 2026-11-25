import { describe, expect, it } from 'vitest';
import { CLAVIS_ROLE, activeRoleOf } from '@/config/roles';
import { can, canSeeCosts, canSeeDealPrices } from './rights';
import { emailFromClaims, grantedRolesFromClavisAccess, isPublicPath, safeReturnTo, modulusRoleKeys } from './auth';

describe('roles read in Clavis', () => {
  it('maps Clavis role keys', () => {
    expect(CLAVIS_ROLE.sales_director).toBe('Modulus.SalesDirector');
    expect(modulusRoleKeys(['Modulus.SalesDirector', 'modulus:estimator', 'Keystone.Admin', 'reader'])).toEqual(['sales_director', 'estimator', 'reader']);
  });
  it('an access that is not open grants nothing (fail closed)', () => {
    expect(grantedRolesFromClavisAccess(null)).toEqual([]);
    expect(grantedRolesFromClavisAccess({ ouvert: false, role: 'Modulus.Sales' })).toEqual([]);
    expect(grantedRolesFromClavisAccess({ ouvert: true, role: 'Modulus.Sales', roles: ['Modulus.Engineering'] })).toEqual(['engineering', 'sales']);
  });
  it('active role', () => {
    expect(activeRoleOf(['reader', 'sales'])).toBe('sales');
    expect(activeRoleOf(['reader', 'sales'], 'reader')).toBe('reader');
    expect(activeRoleOf([])).toBeNull();
  });
});

describe('rights (U-1, U-2, D-4, D-15)', () => {
  it('budget and margin: estimators and the directions, never the account managers', () => {
    expect(canSeeCosts(['sales'])).toBe(false);
    expect(canSeeCosts(['engineering', 'reader'])).toBe(false);
    for (const r of ['estimator', 'sales_director', 'portfolio_management', 'general_management'] as const) expect(canSeeCosts([r])).toBe(true);
  });
  it('the prices of a deal: its team and the directions', () => {
    expect(canSeeDealPrices(['sales'], false)).toBe(false);
    expect(canSeeDealPrices(['sales'], true)).toBe(true);
    expect(canSeeDealPrices(['general_management'], false)).toBe(true);
  });
  it('who decides', () => {
    expect(can(['sales'], 'validate_prices')).toBe(false);
    expect(can(['sales_director'], 'validate_prices')).toBe(true);
    expect(can(['general_management'], 'validate_discount')).toBe(true);
    expect(can(['engineering'], 'qualify')).toBe(true);
    expect(can(['estimator'], 'qualify')).toBe(false);
  });
});

describe('sign-in helpers', () => {
  it('e-mail, return path and public paths', () => {
    expect(emailFromClaims({ preferred_username: 'A.B@Groupe.Example' })).toBe('a.b@groupe.example');
    expect(emailFromClaims({})).toBeNull();
    expect(safeReturnTo('//evil.example')).toBe('/');
    expect(safeReturnTo('/deals?x=1')).toBe('/deals?x=1');
    expect(isPublicPath('/api/auth/callback')).toBe(true);
    expect(isPublicPath('/deals')).toBe(false);
  });
});
