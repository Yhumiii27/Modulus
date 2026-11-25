// Smoke test of a running Modulus (production build, demo data set): health, every screen for the sales director, the sheets
// and their tabs, what an account manager and a reader may see (no cost, the prices of their team's deals only), the printable
// offer and questionnaire, the CSV exports, the security headers, the common shell of Norma and the French rendering.
//   MODULUS_SMOKE_URL=http://127.0.0.1:3810 npx tsx tests/smoke/run.ts
const BASE = (process.env.MODULUS_SMOKE_URL || 'http://127.0.0.1:3810').replace(/\/+$/, '');

let failures = 0;
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures++;
}

async function get(path: string, role?: string): Promise<{ status: number; body: string; headers: Headers }> {
  const r = await fetch(BASE + path, { headers: role ? { cookie: `modulus-role=${role}` } : {}, redirect: 'manual' });
  return { status: r.status, body: await r.text(), headers: r.headers };
}

async function main(): Promise<void> {
  const health = await get('/api/health');
  check(health.status === 200, 'GET /api/health answers 200');

  const home = await get('/', 'sales_director');
  check(home.status === 200 && home.body.includes('Pipeline pondéré'), 'the home page opens in French by default');
  check(home.body.includes('AF-2026-0042'), 'the home page shows the offer waiting for a review');
  check(!/maquette/i.test(home.body) && home.body.includes('Bêta'), 'no mockup banner; a discreet beta mark');
  const csp = home.headers.get('content-security-policy') ?? '';
  check(csp.includes("default-src 'self'") && csp.includes('nonce-'), 'the page carries a Content-Security-Policy with a nonce');
  check(home.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options: nosniff');
  // Norma 2.0 common shell (norma/charte/COQUE.md): the language / display pair stacked, in the page header and the top bar
  // (≤ 1024 px) and never in the sidebar, the menu button of the top bar, the page's only <h1>, no tool name in the breadcrumb.
  const prefs = home.body.match(/class="coque-prefs"/g) ?? [];
  const aside = /<aside[^>]*id="coque-sidebar"[\s\S]*?<\/aside>/.exec(home.body)?.[0] ?? '';
  check(prefs.length === 2 && home.body.includes('aria-label="Langue"') && home.body.includes('aria-label="Affichage"'), 'language over display pair, in the page header and the top bar');
  check(aside.length > 0 && !aside.includes('coque-prefs') && aside.includes('coque-pagesearch'), 'the sidebar has the ⌘K page search and no language / display pair');
  check(home.body.includes('id="coque-nav-toggle"') && home.body.includes('aria-controls="coque-sidebar"'), 'menu button of the top bar (compact layout)');
  check((home.body.match(/<h1[ >]/g) ?? []).length === 1 && home.body.includes('class="coque-title"'), 'one page title <h1>');
  const crumb = /class="coque-crumb">([\s\S]*?)<\/div>/.exec(home.body)?.[1] ?? '';
  check(!crumb.includes('Modulus'), 'the breadcrumb does not repeat the tool name');

  for (const [path, text] of [
    ['/deals', 'AF-2026-0049'], ['/deals?filter=all', 'AF-2026-0031'], ['/configurator', 'Options du catalogue'], ['/configurator?machine=EMP-400', 'Détection incendie renforcée'],
    ['/quotes', 'DC-2026-0019'], ['/quotes?filter=all', 'DC-2026-0014'], ['/sold', 'CV-2025-0002'], ['/catalogue', 'EMP-200'], ['/catalogue?tab=options', 'OPT-CAP-01'],
    ['/catalogue?tab=prices', 'GRILLE-2027'], ['/knowhow', 'Machines standard × options'], ['/admin/questionnaires', 'Tronc commun'], ['/admin/settings', 'Délai cible de réponse'],
    ['/journal', 'Exporter (CSV)'],
  ] as const) {
    const r = await get(path, 'sales_director');
    check(r.status === 200 && r.body.includes(text), `${path} opens for the sales director`);
  }
  for (const tab of ['', '?tab=offers', '?tab=review', '?tab=journal']) {
    const r = await get(`/deals/AF-2026-0042${tab}`, 'sales_director');
    check(r.status === 200 && r.body.includes('AF-2026-0042'), `the deal sheet ${tab || '(lines)'} opens`);
  }
  for (const tab of ['', '?tab=qualification', '?tab=estimate', '?tab=thread']) {
    const r = await get(`/quotes/DC-2026-0017${tab}`, 'estimator');
    check(r.status === 200 && r.body.includes('DC-2026-0017'), `the quotation request ${tab || '(questionnaire)'} opens`);
  }
  for (const tab of ['', '?tab=options', '?tab=rules', '?tab=bom', '?tab=budget', '?tab=prices']) {
    const r = await get(`/catalogue/EMP-200${tab}`, 'estimator');
    check(r.status === 200 && r.body.includes('EMP-200'), `the machine sheet ${tab || '(overview)'} opens`);
  }
  check((await get('/quotes/DC-2026-0020', 'sales_director')).body.includes('Demande incomplète'), 'an incomplete request lists its missing answers');
  check((await get('/sold/CV-2025-0002?tab=feedback', 'estimator')).body.includes('REX-DEMO-031'), 'the project return shows its REX');
  check((await get('/configurator?machine=EMP-400', 'sales')).body.includes('obligatoire si'), 'the configurator imposes a mandatory option and cites the rule');

  // Two prices never mixed (D-15) and the deals of a team (U-2).
  const budgetSales = await get('/catalogue/EMP-200?tab=budget', 'sales');
  check(budgetSales.body.includes('Budget et marge réservés') && !budgetSales.body.includes('Base du calcul'), 'an account manager does not see the budget');
  const budgetEst = await get('/catalogue/EMP-200?tab=budget', 'estimator');
  check(budgetEst.body.includes('Calculé') && budgetEst.body.includes('Écart'), 'an estimator sees the budget entered and computed');
  check((await get('/deals/AF-2026-0049', 'sales')).status === 404, 'an account manager outside the team gets no deal sheet');
  check((await get('/deals/AF-2026-0042', 'sales')).status === 200, 'an account manager of the team opens the deal');
  check((await get('/deals', 'reader')).body.includes('masqué'), 'a reader sees the list without the prices');
  check((await get('/journal', 'sales')).status === 404, 'the journal is closed to an account manager');

  const offer = await get('/print/offers/AF-2026-0042/A', 'sales_director');
  check(offer.status === 200 && offer.body.includes('Total hors taxes') && !offer.body.includes('udget'), 'the printable offer carries the sale price, never the budget');
  check((await get('/print/questionnaire?request=DC-2026-0020', 'sales_director')).body.includes('Questionnaire de cotation'), 'the questionnaire prints for the customer (D-17)');
  const csv = await get('/export/deals', 'sales_director');
  check(csv.status === 200 && (csv.headers.get('content-type') ?? '').startsWith('text/csv') && csv.body.includes('weighted_keur'), 'the deals export as CSV');
  check((await get('/export/nothing', 'sales_director')).status === 404, 'an unknown export is not found');

  check((await get('/deals/AF-2099-0001', 'sales_director')).status === 404, 'an unknown deal is not found');
  check((await get('/nowhere', 'sales_director')).status === 404, 'an unknown path is not found');
  check((await get('/sign-in')).status === 307, 'the sign-in page leads home in demo mode');

  if (failures) {
    console.error(`\n${failures} smoke check(s) failed`);
    process.exit(1);
  }
  console.log('\nSmoke test passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
