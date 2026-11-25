import { describe, expect, it } from 'vitest';
import { SECTION_LABEL } from '@/config/screens';
import { makeT } from '@/i18n/translate';
import SAME from '@/i18n/same-in-french.json';
import { buildNav } from './nav-model';

describe('sidebar model', () => {
  it('the journal is for the administrator and the sales director only', () => {
    const sales = buildNav(['sales'], '/');
    expect(sales.sections.map((s) => s.key)).toEqual(['commerce', 'catalogue', 'admin']);
    expect(sales.sections.find((s) => s.key === 'admin')!.entries.map((e) => e.id)).not.toContain('journal');
    expect(buildNav(['admin'], '/').sections.find((s) => s.key === 'admin')!.entries.map((e) => e.id)).toContain('journal');
  });
  it('a deal sheet keeps "Deals" active', () => {
    const n = buildNav(['sales'], '/deals/AF-2026-0042', { deals: 4 });
    const e = n.sections.find((s) => s.key === 'commerce')!.entries.find((x) => x.id === 'deals')!;
    expect(e).toMatchObject({ active: true, count: 4 });
  });
  it('every section title is translated into French', () => {
    const fr = makeT('fr');
    for (const label of Object.values(SECTION_LABEL)) expect(fr(label) !== label || SAME.strings.includes(label)).toBe(true);
  });
});
