// Screen registry (the validated mockup, maquette/index.html): id, route, title (EN source string), sidebar section and the
// roles that see it. Pure: no component, no server import, so server code, the proxy and scripts can load it. Icons are in
// ./screen-icons.ts.
import type { RoleKey } from './roles';

export type ScreenId =
  | 'home' | 'deals' | 'deal' | 'configurator' | 'quotes' | 'quote' | 'sold' | 'soldConfig' | 'catalogue' | 'machine' | 'knowhow'
  | 'questionnaires' | 'settings' | 'journal';

export type Section = 'fixed' | 'commerce' | 'catalogue' | 'admin';

export interface ScreenDef {
  id: ScreenId;
  path: string;
  title: string;
  section: Section;
  roles: readonly RoleKey[] | 'all';
}

export const SCREENS: readonly ScreenDef[] = [
  { id: 'home', path: '/', title: 'Home', section: 'fixed', roles: 'all' },
  { id: 'deals', path: '/deals', title: 'Deals', section: 'commerce', roles: 'all' },
  { id: 'deal', path: '/deals/[code]', title: 'Deal', section: 'commerce', roles: 'all' },
  { id: 'configurator', path: '/configurator', title: 'Configurator', section: 'commerce', roles: 'all' },
  { id: 'quotes', path: '/quotes', title: 'Quotation requests', section: 'commerce', roles: 'all' },
  { id: 'quote', path: '/quotes/[code]', title: 'Quotation request', section: 'commerce', roles: 'all' },
  { id: 'sold', path: '/sold', title: 'Sold configurations', section: 'commerce', roles: 'all' },
  { id: 'soldConfig', path: '/sold/[code]', title: 'Sold configuration', section: 'commerce', roles: 'all' },
  { id: 'catalogue', path: '/catalogue', title: 'Standard machines', section: 'catalogue', roles: 'all' },
  { id: 'machine', path: '/catalogue/[code]', title: 'Standard machine', section: 'catalogue', roles: 'all' },
  { id: 'knowhow', path: '/knowhow', title: 'Know-how map', section: 'catalogue', roles: 'all' },
  { id: 'questionnaires', path: '/admin/questionnaires', title: 'Standard questionnaires', section: 'admin', roles: 'all' },
  { id: 'settings', path: '/admin/settings', title: 'Lead times and thresholds', section: 'admin', roles: 'all' },
  { id: 'journal', path: '/journal', title: 'Journal', section: 'admin', roles: ['admin', 'sales_director'] },
];

export const SCREEN_BY_ID = Object.fromEntries(SCREENS.map((s) => [s.id, s])) as Record<ScreenId, ScreenDef>;

export const SECTION_LABEL: Record<Exclude<Section, 'fixed'>, string> = {
  commerce: 'Commerce', catalogue: 'Catalogue', admin: 'Administration',
};

/** The list screen of an object screen (the sidebar entry lit on a sheet). */
export const PARENT_SCREEN: Partial<Record<ScreenId, ScreenId>> = { deal: 'deals', quote: 'quotes', soldConfig: 'sold', machine: 'catalogue' };

export function canSee(role: RoleKey | readonly RoleKey[], id: ScreenId): boolean {
  const r = SCREEN_BY_ID[id].roles;
  const held = typeof role === 'string' ? [role] : role;
  return r === 'all' || held.some((x) => r.includes(x));
}

export function screenHref(id: ScreenId, params: { code?: string } = {}): string {
  const p = SCREEN_BY_ID[id].path;
  if (!p.includes('[code]')) return p;
  if (!params.code) throw new Error(`screenHref(${id}) needs a code`);
  return p.replace('[code]', encodeURIComponent(params.code));
}

export function matchScreen(pathname: string): ScreenDef | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const byLength = [...SCREENS].sort((a, b) => b.path.length - a.path.length);
  for (const s of byLength) {
    const re = new RegExp('^' + s.path.replace(/\[code\]/, '[^/]+').replace(/\//g, '\\/') + '(\\/.*)?$');
    if (s.path === '/' ? clean === '/' : re.test(clean)) return s;
  }
  return null;
}
