// A sold configuration (docs/spec/02 § 3–4): each frozen version (v1 at the order, v2… at each amendment with what changed and
// why), the order, the Keystone project, and the project's return: real cost per post against the budget, hours, options
// really delivered, REX (D-9). Costs for the roles of D-15 only.
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { KeyValueList } from '@/components/app/KeyValueList';
import { EmptyState } from '@/components/app/EmptyState';
import { ActionLink } from '@/components/app/ActionForm';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { Tag } from '@norma/charte/ds/Tag';
import { can } from '@/domain/rights';
import { FEEDBACK_STAGE_LABEL, type FeedbackStage } from '@/domain/vocab';
import { AmendForm, FeedbackForm, LinkProjectForm } from '@/features/commerce/forms';
import s from '@/features/commerce/pages.module.css';
import { LevelTag } from '@/features/commerce/tags';
import { Notice, Tabs } from '@/features/commerce/view';
import { fmtDate, fmtKeur, fmtNum } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { dealAccess, loadWorld } from '@/server/dal/world';
import { keystoneProjectHref } from '@/server/integrations/codex/links';
import { getI18n, getViewer } from '@/server/session';

type SP = Record<string, string | string[] | undefined>;
const gap = (real: number, budget: number) => (budget > 0 ? `${real >= budget ? '+' : ''}${Math.round((real / budget - 1) * 1000) / 10} %` : '—');

export default async function SoldConfigPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<SP> }) {
  const [{ t, lang }, viewer, today, { code }, sp] = await Promise.all([getI18n(), getViewer(), businessToday(), params, searchParams]);
  const w = await loadWorld(today);
  const versions = w.soldVersions.get(code);
  if (!versions) notFound();
  const cur = versions.at(-1)!;
  const d = w.dealBy.get(cur.dealId)!;
  const acc = dealAccess(w, viewer, d.id);
  const tab = sp.tab === 'feedback' ? 'feedback' : String(sp.tab ?? `v${cur.version}`);
  const shown = versions.find((v) => `v${v.version}` === tab) ?? cur;
  const prev = versions.find((v) => v.version === shown.version - 1);
  const offer = w.rows.offerRows.find((o) => o.id === cur.offerId);
  const fbs = w.feedbackOf.get(code) ?? [];
  const project = cur.keystoneProject;
  const projectHref = keystoneProjectHref(project);
  const mayDeal = can(viewer.roles, 'deal') && acc.sheet;

  let body;
  if (tab === 'feedback') {
    const fb = fbs.find((f) => f.stage === 'warranty_end') ?? fbs[0];
    if (!fb) body = <><Notice>{t('Real cost and REX expected at the closure of the project, then at the end of the warranty (D-9).')}</Notice><EmptyState>{t('No return received yet')}</EmptyState></>;
    else {
      const b = cur.content.lines.reduce((n, l) => n + (l.unitBudgetKeur ?? 0) * l.quantity, 0);
      const real = fb.materialKeur + fb.subcontractingKeur + fb.engineeringKeur + fb.workshopKeur + fb.siteKeur + fb.expensesKeur;
      const fos = w.feedbackOptionsOf.get(fb.id) ?? [];
      body = (
        <>
          <Notice>{t(FEEDBACK_STAGE_LABEL[fb.stage as FeedbackStage])} · {t('received on')} {fmtDate(fb.receivedOn, lang)} · {fb.source === 'keystone' ? t('published by Keystone (simulation until view K-2)') : `${t('entered by')} ${fb.recordedByName}`}</Notice>
          <div className={s.grid2}>
            <SectionCard title={t('Real cost per post')}>
              {acc.costs ? (
                <Table size={12.5}>
                  <thead><tr><Th>{t('Post')}</Th><Th align="right">{t('Real')}</Th></tr></thead>
                  <tbody>
                    {([['Material', fb.materialKeur], ['Subcontracting', fb.subcontractingKeur], ['Engineering hours', fb.engineeringKeur], ['Workshop hours', fb.workshopKeur], ['Site hours', fb.siteKeur], ['Expenses', fb.expensesKeur]] as const).map(([p, v]) => <tr key={p}><Td>{t(p)}</Td><Td numeric>{fmtKeur(v, lang)}</Td></tr>)}
                    <tr className={s.sum}><Td>{t('Total')} · {t('budget')} {fmtKeur(b, lang)}</Td><Td numeric>{fmtKeur(real, lang)} ({gap(real, b)})</Td></tr>
                  </tbody>
                </Table>
              ) : <Notice>{t('Budget and real costs are reserved to the estimators and the directions (D-15).')}</Notice>}
            </SectionCard>
            <SectionCard title={t('Real hours')}>
              <KeyValueList items={[{ k: t('Engineering'), v: `${fmtNum(fb.engineeringHours, lang, 0)} h` }, { k: t('Workshop'), v: `${fmtNum(fb.workshopHours, lang, 0)} h` }, { k: t('Site'), v: `${fmtNum(fb.siteHours, lang, 0)} h` }]} />
            </SectionCard>
            <SectionCard title={t('Options really delivered')} hint={t('A sold option not delivered is flagged.')}>
              <Table size={12.5}>
                <thead><tr><Th>{t('Option')}</Th><Th>{t('Delivered')}</Th><Th align="right">{t('Real / budget')}</Th><Th>{t('Know-how')}</Th></tr></thead>
                <tbody>{fos.map((f) => {
                  const o = w.optionBy.get(f.optionId)!;
                  return <tr key={f.optionId}><Td>{o.code}<div className={s.muted}>{o.label}</div></Td><Td>{f.delivered ? <Tag tone="outline" size="sm">{t('delivered')}</Tag> : <Tag tone="accent-2" size="sm">{t('sold, not delivered')}</Tag>}</Td><Td numeric>{acc.costs && f.actualKeur != null ? gap(f.actualKeur, f.budgetKeur) : '—'}</Td><Td><LevelTag level={w.optionLevel(o.id)} t={t} /></Td></tr>;
                })}</tbody>
              </Table>
            </SectionCard>
            <SectionCard title={t('REX')}>
              <KeyValueList items={[{ k: t('REX'), v: fb.rexRef ? `${fb.rexRef} · ${fb.rexSummary ?? ''}` : '—' }, { k: t('Major difficulty'), v: fb.majorDifficulty ? t('Yes') : t('No') }]} />
            </SectionCard>
          </div>
        </>
      );
    }
  } else {
    const prevCodes = new Set(prev?.content.lines.flatMap((l) => l.options.map((o) => `${l.number}|${o.code}`)) ?? []);
    body = (
      <div className={s.grid2}>
        <SectionCard title={`${t('Version')} ${shown.version}`} hint={t('BOM, budget, prices, lead time, assumptions and reservations frozen as at the order.')} scroll>
          <Table size={12.5}>
            <thead><tr><Th>{t('Item')}</Th><Th align="right">{t('Qty')}</Th><Th align="right">{t('Unit price')}</Th>{acc.costs && <Th align="right">{t('Unit budget')}</Th>}<Th>{t('Origin')}</Th></tr></thead>
            <tbody>
              {shown.content.lines.flatMap((l) => [
                <tr key={`m${l.number}`}><Td><strong>{l.machine} v{l.version}</strong> · {l.label}</Td><Td numeric>{l.quantity}</Td><Td numeric>{acc.prices ? fmtKeur(l.machineSaleKeur, lang) : t('hidden')}</Td>{acc.costs && <Td numeric>{fmtKeur(l.machineBudgetKeur, lang)}</Td>}<Td className={s.muted}>{t('catalogue')}</Td></tr>,
                ...l.options.map((o) => (
                  <tr key={`${l.number}${o.code}`} className={prev && !prevCodes.has(`${l.number}|${o.code}`) ? s.diffAdd : ''}><Td>{o.code} · {o.label}</Td><Td numeric>{l.quantity}</Td><Td numeric>{acc.prices ? fmtKeur(o.saleKeur, lang) : t('hidden')}</Td>{acc.costs && <Td numeric>{fmtKeur(o.budgetKeur, lang)}</Td>}<Td>{o.origin === 'specific' ? <Tag tone="outline" size="sm">{t('specific')}</Tag> : <span className={s.muted}>{t('catalogue')}</span>}</Td></tr>
                )),
              ])}
              <tr className={s.sum}><Td>{t('Total')}{shown.content.discountPct ? ` · ${t('discount')} ${shown.content.discountPct} %` : ''} · {shown.leadWeeks} {t('weeks')}</Td><Td /><Td numeric>{acc.prices ? fmtKeur(shown.totalSaleKeur, lang) : t('hidden')}</Td>{acc.costs && <Td numeric>{fmtKeur(shown.totalBudgetKeur, lang)}</Td>}<Td /></tr>
            </tbody>
          </Table>
        </SectionCard>
        <div className={s.stack}>
          <SectionCard title={t('Order')}>
            <KeyValueList items={[
              { k: t('Deal'), v: `${d.ref} · ${w.customerBy.get(d.customerId)?.name} · ${t('case')} ${d.saleCase}` },
              { k: t('Order'), v: `${fmtDate(cur.orderedOn, lang)} · ${t('customer ref.')} ${cur.customerOrderRef} · ${t('offer retained')} ${offer?.letter ?? '—'}` },
              { k: t('Keystone project'), v: project ? (projectHref ? <a href={projectHref}>{project}</a> : project) : t('not linked yet') },
              ...(d.saleCase === 1 ? [{ k: 'Arche', v: t('the order is the G2 Go of the CAPEX; Arche reads the state “ordered”') }] : []),
            ]} />
          </SectionCard>
          {shown.amendmentReason && (
            <SectionCard title={`${t('Amendment')} v${shown.version} · ${t('what changes')}`}>
              <KeyValueList items={[{ k: t('Reason'), v: <span className={s.typed}>{shown.amendmentReason}</span> }, { k: t('Date'), v: `${fmtDate(shown.createdAt, lang)} · ${shown.createdByName}` }, { k: t('Amount'), v: acc.prices && prev ? `${fmtKeur(prev.totalSaleKeur, lang)} → ${fmtKeur(shown.totalSaleKeur, lang)}` : '—' }]} />
            </SectionCard>
          )}
        </div>
      </div>
    );
  }
  const addable = (l: (typeof cur.content.lines)[number]) => {
    const m = w.machineByCode.get(l.machine)!;
    return w.availableOptions(m.id, d.id).filter((o) => !l.options.some((x) => x.code === o.code) && w.saleOfOption(o.id) != null).map((o) => ({ value: o.code, label: `${o.code} · ${o.label}` }));
  };
  return (
    <>
      <PageHeader
        screen="soldConfig"
        title={`${code} · ${w.customerBy.get(d.customerId)?.name}`}
        crumbs={['Commerce', 'Sold configurations']}
        subtitle={<Tag tone="accent" size="sm">{t('version in force')} v{cur.version}</Tag>}
        primary={mayDeal ? <AmendForm soldRef={code} lines={cur.content.lines.map((l) => ({ number: l.number, label: `${t('Line')} ${l.number} · ${l.machine} × ${l.quantity}`, current: l.options.map((o) => ({ value: o.code, label: `${o.code} · ${o.label}` })), addable: addable(l) }))} /> : undefined}
        actions={<>
          {mayDeal && !project && <LinkProjectForm soldRef={code} />}
          {can(viewer.roles, 'feedback') && <FeedbackForm soldRef={code} options={cur.content.lines.flatMap((l) => l.options.map((o) => ({ value: o.code, label: `${o.code} · ${o.label}` })))} />}
          {acc.sheet && <ActionLink href={`/deals/${d.ref}`} label={`${t('Deal')} ${d.ref}`} />}
        </>}
      />
      <Tabs base={`/sold/${code}`} current={tab === `v${cur.version}` ? tab : tab} tabs={[...[...versions].reverse().map((v) => ({ id: `v${v.version}`, label: `v${v.version} · ${fmtDate(v.version === 1 ? v.orderedOn : v.createdAt, lang)}` })), { id: 'feedback', label: t('Project return') }]} />
      {body}
    </>
  );
}
