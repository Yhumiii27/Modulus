// A standard machine (docs/spec/01): its sheet and versions (draft → published → retired; a published version is frozen), its
// options with their know-how level, the rules between them, the prefabricated BOM and the option deltas, the budget per post
// entered and computed with the gap (D-7; estimators and directions only, D-15), and its sale prices in the dated price lists.
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { KeyValueList } from '@/components/app/KeyValueList';
import { EmptyState } from '@/components/app/EmptyState';
import { ActionLink } from '@/components/app/ActionForm';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { Tag } from '@norma/charte/ds/Tag';
import { budgetTotal, computedTotal, marginRate } from '@/domain/pricing';
import { can, canSeeCosts } from '@/domain/rights';
import { BUDGET_POST_LABEL, DELTA_OP_LABEL, OPTION_CATEGORIES, OPTION_CATEGORY_LABEL, RULE_KIND_LABEL } from '@/domain/vocab';
import { BomLineForm, BudgetForm, DeltaForm, EditVersionForm, NewOptionForm, NewVersionButton, PublishVersionButton, RemoveBomLineButton, RuleForm } from '@/features/commerce/forms';
import s from '@/features/commerce/pages.module.css';
import { LevelTag, PriceListTag, VersionTag } from '@/features/commerce/tags';
import { Notice, Tabs, pct } from '@/features/commerce/view';
import { fmtDate, fmtKeur } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { loadWorld } from '@/server/dal/world';
import { codexHref } from '@/server/integrations/codex/links';
import { getI18n, getViewer } from '@/server/session';

type SP = Record<string, string | string[] | undefined>;

export default async function MachinePage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<SP> }) {
  const [{ t, lang }, viewer, today, { code }, sp] = await Promise.all([getI18n(), getViewer(), businessToday(), params, searchParams]);
  const w = await loadWorld(today);
  const m = w.machineByCode.get(code);
  if (!m) notFound();
  const tab = ['options', 'rules', 'bom', 'budget', 'prices'].includes(String(sp.tab)) ? String(sp.tab) : 'overview';
  const type = w.typeBy.get(m.typeCode)!;
  const versions = w.versionsOf.get(m.id) ?? [];
  const latest = versions[0];
  const v = w.published(m.id) ?? latest;
  const draft = latest.state === 'draft' ? latest : null;
  const costs = canSeeCosts(viewer.roles);
  const engineering = can(viewer.roles, 'catalogue');
  const opts = w.availableOptions(m.id);
  const optIds = new Set(opts.map((o) => o.id));
  const charDefs = w.rows.charDefs.filter((c) => c.typeCode === m.typeCode).sort((a, b) => a.position - b.position);
  const charsOf = (versionId: string) => new Map((w.charsOf.get(versionId) ?? []).map((c) => [c.key, c.value]));
  const bomVersion = draft && sp.v !== 'published' ? draft : v;
  let body;
  if (tab === 'overview') {
    const chars = charsOf(v.id);
    const href = codexHref(v.datasheetRef);
    body = (
      <div className={s.grid2}>
        <SectionCard title={t('Sheet')} hint={t('Starting characteristics (D-6), completed by type without development')}>
          <KeyValueList items={[
            { k: t('Type'), v: `${type.code} · ${type.label}` },
            { k: t('Label'), v: v.label },
            { k: t('Nominal capacity'), v: `${v.nominalCapacity} ${v.capacityUnit}` },
            { k: t('Standard lead time'), v: `${v.leadWeeks} ${t('weeks')}` },
            ...charDefs.map((c) => ({ k: c.label, v: chars.get(c.key) ?? '—', id: c.key })),
            { k: t('Payment terms'), v: `${type.depositPct} % ${t('deposit')} · ${type.deliveryPct} % ${t('delivery')} · ${type.acceptancePct} % ${t('acceptance')} (${t('type')} ${type.code})` },
            { k: t('Datasheet'), v: v.datasheetRef ? (href ? <a href={href}>{v.datasheetRef}</a> : <>{v.datasheetRef} <span className={s.muted}>· Codex</span></>) : '—' },
          ]} />
        </SectionCard>
        <SectionCard title={t('Versions')} hint={t('Draft → published → retired · a published version is frozen; publishing n retires n−1; a deal keeps its version')}>
          <Table size={12.5}>
            <thead><tr><Th>{t('Version')}</Th><Th>{t('State')}</Th><Th>{t('Period')}</Th><Th>{t('Note')}</Th></tr></thead>
            <tbody>{versions.map((x) => <tr key={x.id}><Td>v{x.version}</Td><Td><VersionTag state={x.state} t={t} /></Td><Td nowrap>{x.publishedAt ? `${fmtDate(x.publishedAt, lang)}${x.retiredAt ? ` → ${fmtDate(x.retiredAt, lang)}` : ''}` : `${t('since')} ${fmtDate(x.createdAt, lang)}`}</Td><Td>{x.note ?? '—'}<div className={s.muted}>{x.createdByName}</div></Td></tr>)}</tbody>
          </Table>
        </SectionCard>
      </div>
    );
  } else if (tab === 'options') {
    body = (
      <SectionCard scroll hint={t('An option outside the catalogue is born from a quotation request; sold twice with a controlled gap, it is proposed for the catalogue (D-12).')}>
        <Table size={12.5}>
          <thead><tr><Th>{t('Option')}</Th><Th>{t('Category')}</Th><Th align="right">{t('Sale price')}</Th>{costs && <Th align="right">{t('Budget')}</Th>}<Th align="right">{t('Extra lead time')}</Th><Th>{t('BOM')}</Th><Th>{t('Know-how')}</Th>{can(viewer.roles, 'budget') && <Th />}</tr></thead>
          <tbody>
            {OPTION_CATEGORIES.flatMap((c) => opts.filter((o) => o.category === c).map((o) => {
              const ds = w.deltasOfOption(o.id);
              const b = w.budgetOfOption(o.id);
              return (
                <tr key={o.id}>
                  <Td>{o.code}<div className={s.muted}>{o.label}</div></Td>
                  <Td>{t(OPTION_CATEGORY_LABEL[c])}</Td>
                  <Td numeric>{fmtKeur(w.saleOfOption(o.id), lang)}</Td>
                  {costs && <Td numeric>{fmtKeur(b.entered, lang)}</Td>}
                  <Td numeric>{o.extraWeeks ? `+${o.extraWeeks} ${t('wk')}` : '—'}</Td>
                  <Td>{ds.length ? ds.map((d) => `${t(DELTA_OP_LABEL[d.op])} ${d.article}`).join(' · ') : <span className={s.muted}>{t('hours only')}</span>}</Td>
                  <Td><LevelTag level={w.levelAt(m.id, o.id)} t={t} /></Td>
                  {can(viewer.roles, 'budget') && <Td>{o.origin === 'catalogue' && <BudgetForm code={code} subject="option" option={o.code} rows={b.rows.map((r) => ({ post: r.post, enteredKeur: r.enteredKeur, hours: w.rows.budgetRowsDb.find((x) => x.optionId === o.id && x.post === r.post)?.hours ?? null, basis: r.basis }))} />}</Td>}
                </tr>
              );
            }))}
          </tbody>
        </Table>
      </SectionCard>
    );
  } else if (tab === 'rules') {
    const rules = w.cfgRules.filter((r) => optIds.has(r.optionId));
    const code_ = (id: string | null) => (id ? w.optionBy.get(id) : undefined);
    body = (
      <SectionCard title={t('Rules between options')} hint={t('excludes · requires · mandatory if (a condition on a characteristic) · one of (exclusive group). A configuration that breaks a rule is refused, the rule cited.')}>
        {rules.length ? (
          <Table size={12.5}>
            <thead><tr><Th>{t('Option')}</Th><Th>{t('Rule')}</Th><Th>{t('Target')}</Th><Th>{t('Explanation')}</Th></tr></thead>
            <tbody>{rules.map((r) => <tr key={r.id}><Td>{code_(r.optionId)?.code}<div className={s.muted}>{code_(r.optionId)?.label}</div></Td><Td><Tag tone={r.kind === 'excludes' ? 'outline' : 'accent-2'} size="sm">{t(RULE_KIND_LABEL[r.kind])}</Tag></Td><Td>{r.targetOptionId ? <>{code_(r.targetOptionId)?.code}<div className={s.muted}>{code_(r.targetOptionId)?.label}</div></> : `${r.conditionKey === 'capacity' ? t('nominal capacity') : r.conditionKey} ${r.conditionOp} ${r.conditionValue}`}</Td><Td>{r.explanation}</Td></tr>)}</tbody>
          </Table>
        ) : <EmptyState>{t('No rule')}</EmptyState>}
      </SectionCard>
    );
  } else if (tab === 'bom') {
    const lines = w.rows.bomRows.filter((b) => b.versionId === bomVersion.id).sort((a, b) => a.mark.localeCompare(b.mark));
    const mayEdit = engineering && bomVersion.state === 'draft';
    body = (
      <>
        <SectionCard title={`${t('Base BOM')} · ${m.code} v${bomVersion.version}`} hint={t('Articles read in keystone.pub_articles (D-5). Checks: quantity > 0, article of Keystone, no delta without its line.')} actions={<><VersionTag state={bomVersion.state} t={t} />{draft && <ActionLink href={`/catalogue/${code}?tab=bom${bomVersion === draft ? '&v=published' : ''}`} label={bomVersion === draft ? t('Version in force') : t('Draft version')} />}{mayEdit && <BomLineForm code={code} />}</>} scroll>
          <Table size={12.5}>
            <thead><tr><Th>{t('Sub-assembly')}</Th><Th>{t('Mark')}</Th><Th>{t('Article (Keystone)')}</Th><Th>{t('Designation')}</Th><Th align="right">{t('Qty')}</Th><Th>{t('Unit')}</Th>{costs && <Th align="right">{t('Last purchase price')}</Th>}{mayEdit && <Th />}</tr></thead>
            <tbody>{lines.map((b) => <tr key={b.id}><Td>{b.subassembly}</Td><Td>{b.mark}</Td><Td>{b.article}</Td><Td>{b.designation}</Td><Td numeric>{b.quantity}</Td><Td>{b.unit}</Td>{costs && <Td numeric>{fmtKeur(w.prices.get(b.article), lang)}</Td>}{mayEdit && <Td><RemoveBomLineButton code={code} id={b.id} /></Td>}</tr>)}</tbody>
          </Table>
        </SectionCard>
        <SectionCard title={t('Deltas of the options')} hint={t('An option adds, removes or replaces lines — never a copy of the BOM. The BOM of a configuration is computed.')} actions={engineering ? <DeltaForm options={opts.filter((o) => o.origin === 'catalogue').map((o) => ({ value: o.code, label: `${o.code} · ${o.label}` }))} /> : undefined}>
          <Table size={12.5}>
            <thead><tr><Th>{t('Option')}</Th><Th>{t('Operation')}</Th><Th>{t('Article')}</Th><Th>{t('Designation')}</Th><Th align="right">{t('Qty')}</Th></tr></thead>
            <tbody>{opts.flatMap((o) => w.deltasOfOption(o.id).map((d, i) => <tr key={`${o.id}${i}`}><Td>{i === 0 ? o.code : ''}</Td><Td><Tag tone={d.op === 'add' ? 'accent' : 'accent-2'} size="sm">{t(DELTA_OP_LABEL[d.op])}</Tag></Td><Td>{d.article}{d.replaces ? <span className={s.muted}> ← {d.replaces}</span> : null}</Td><Td>{d.designation}</Td><Td numeric>{d.quantity != null ? `${d.quantity} ${d.unit}` : '—'}</Td></tr>))}</tbody>
          </Table>
        </SectionCard>
      </>
    );
  } else if (tab === 'budget') {
    const target = draft && sp.v !== 'published' ? draft : v;
    const b = w.budgetOfVersion(target.id);
    body = costs ? (
      <>
        <SectionCard title={`${t('Budget per post')} · ${m.code} v${target.version}`} hint={t('Cost price forecast. Computed (BOM × last purchase prices + standard hours × rates) and entered, the gap shown (D-7).')}
          actions={can(viewer.roles, 'budget') && target.state !== 'retired' ? <BudgetForm code={code} subject="version" versionId={target.id} rows={b.rows.map((r) => ({ post: r.post, enteredKeur: r.enteredKeur, hours: w.rows.budgetRowsDb.find((x) => x.machineVersionId === target.id && x.post === r.post)?.hours ?? null, basis: r.basis }))} /> : undefined}>
          {b.rows.length ? (
            <Table size={12.5}>
              <thead><tr><Th>{t('Post')}</Th><Th align="right">{t('Entered')}</Th><Th align="right">{t('Computed')}</Th><Th align="right">{t('Gap')}</Th><Th>{t('Basis')}</Th></tr></thead>
              <tbody>
                {b.rows.map((r) => <tr key={r.post}><Td>{t(BUDGET_POST_LABEL[r.post])}</Td><Td numeric>{fmtKeur(r.enteredKeur, lang)}</Td><Td numeric>{fmtKeur(r.computedKeur, lang)}</Td><Td numeric>{r.gapKeur ? `${r.gapKeur > 0 ? '+' : ''}${fmtKeur(r.gapKeur, lang)}` : '—'}</Td><Td className={s.muted}>{r.basis ?? '—'}</Td></tr>)}
                <tr className={s.sum}><Td>{t('Total')}</Td><Td numeric>{fmtKeur(budgetTotal(b.rows), lang)}</Td><Td numeric>{fmtKeur(computedTotal(b.rows), lang)}</Td><Td numeric>{pct(budgetTotal(b.rows) ? computedTotal(b.rows) / budgetTotal(b.rows) - 1 : null, lang)}</Td><Td /></tr>
              </tbody>
            </Table>
          ) : <EmptyState>{t('No budget yet')}</EmptyState>}
          <p className={s.muted}>{t('Hourly rates')} : {w.settings.rates.engineering_hours} €/h {t('engineering')} · {w.settings.rates.workshop_hours} €/h {t('workshop')} · {w.settings.rates.site_hours} €/h {t('site')} · {t('purchase prices: simulation until Keystone’s view K-1')}</p>
        </SectionCard>
        <Notice>{t('Visible to the estimators, the sales direction, the portfolio management and the general management (D-15). Published to Keystone only (pub_budgets_configurations), never to Arche.')}</Notice>
      </>
    ) : <Notice warn title={t('Budget and margin reserved')}>{t('to the estimators, the sales direction, the portfolio management and the general management (D-15). Your profile sees the sale price only.')}</Notice>;
  } else {
    const lists = [...w.rows.listRows].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
    const rows = [{ code: `${m.code} v${v.version}`, sale: (id: string) => w.saleOfMachine(m.id, id), budget: w.budgetOfVersion(v.id).entered }, ...opts.filter((o) => o.origin === 'catalogue').map((o) => ({ code: `${o.code} · ${o.label}`, sale: (id: string) => w.saleOfOption(o.id, id), budget: w.budgetOfOption(o.id).entered }))];
    const cur = w.listNow;
    body = (
      <>
        <SectionCard title={t('Price lists')}>
          <Table size={12.5}>
            <thead><tr><Th>{t('Price list')}</Th><Th>{t('Validity')}</Th><Th>{t('State')}</Th><Th align="right">{m.code}</Th></tr></thead>
            <tbody>{lists.map((l) => <tr key={l.id}><Td>{l.code}</Td><Td nowrap>{fmtDate(l.validFrom, lang)} → {fmtDate(l.validTo, lang)}</Td><Td><PriceListTag state={l.state} t={t} /></Td><Td numeric>{fmtKeur(w.saleOfMachine(m.id, l.id), lang)}</Td></tr>)}</tbody>
          </Table>
        </SectionCard>
        {cur && (
          <SectionCard title={`${t('Prices of')} ${m.code} ${t('and of its options')} · ${cur.code}`} hint={t('Indicative sale price published to Arche with the lead time; budget and margin shown only to who sees the budget (D-15).')} scroll>
            <Table size={12.5}>
              <thead><tr><Th>{t('Item')}</Th><Th align="right">{t('Sale price')}</Th>{costs && <><Th align="right">{t('Budget')}</Th><Th align="right">{t('Margin')}</Th><Th align="right">{t('Margin rate')}</Th><Th align="right">{t('Coefficient')}</Th></>}</tr></thead>
              <tbody>{rows.map((r) => {
                const sale = r.sale(cur.id);
                return <tr key={r.code}><Td>{r.code}</Td><Td numeric>{fmtKeur(sale, lang)}</Td>{costs && <><Td numeric>{fmtKeur(r.budget, lang)}</Td><Td numeric>{sale != null && r.budget != null ? fmtKeur(Math.round((sale - r.budget) * 10) / 10, lang) : '—'}</Td><Td numeric>{pct(marginRate(sale, r.budget), lang)}</Td><Td numeric>{sale && r.budget ? (sale / r.budget).toFixed(2) : '—'}</Td></>}</tr>;
              })}</tbody>
            </Table>
          </SectionCard>
        )}
      </>
    );
  }
  return (
    <>
      <PageHeader
        screen="machine"
        title={`${m.code} · ${v.label}`}
        crumbs={['Catalogue', 'Standard machines']}
        subtitle={<><Tag tone="neutral" size="sm">v{v.version}</Tag> <VersionTag state={v.state} t={t} />{draft && draft !== v && <> · <Tag tone="outline" size="sm">{t('draft')} v{draft.version}</Tag></>}</>}
        primary={v.state === 'published' ? <ActionLink href={`/configurator?machine=${m.code}`} label={t('Open in the configurator')} variant="primary" /> : undefined}
        actions={engineering ? <>
          {!draft && <NewVersionButton code={code} />}
          {draft && <EditVersionForm code={code} d={{ label: draft.label, capacity: draft.nominalCapacity, lead: draft.leadWeeks, note: draft.note, datasheet: draft.datasheetRef, description: draft.description, chars: charDefs.map((c) => ({ key: c.key, label: c.label, unit: c.unit, value: charsOf(draft.id).get(c.key) ?? '' })) }} />}
          {draft && <PublishVersionButton code={code} version={draft.version} />}
          <NewOptionForm machines={[{ value: m.code, label: m.code }]} />
          <RuleForm options={opts.map((o) => ({ value: o.code, label: `${o.code} · ${o.label}` }))} />
        </> : undefined}
      />
      <Tabs base={`/catalogue/${code}`} current={tab} tabs={[{ id: 'overview', label: t('Overview') }, { id: 'options', label: `${t('Options')} (${opts.length})` }, { id: 'rules', label: t('Rules') }, { id: 'bom', label: t('Prefabricated BOM') }, { id: 'budget', label: t('Budget') }, { id: 'prices', label: t('Sale price') }]} />
      {body}
    </>
  );
}
