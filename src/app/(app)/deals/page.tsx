// Deals (docs/spec/02 § 1, D-2): the pipeline by state, the list filtered (active, closed, all), the weighted pipeline. Every
// one sees the list; the prices of a deal only its team and the directions (U-2).
import Link from 'next/link';
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { EmptyState } from '@/components/app/EmptyState';
import { ActionLink } from '@/components/app/ActionForm';
import { Segmented } from '@norma/charte/ds/Segmented';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { Tag } from '@norma/charte/ds/Tag';
import { weightedPipeline } from '@/domain/deals';
import { can } from '@/domain/rights';
import { DEAL_STATES, DEAL_STATE_LABEL, LOSS_REASON_LABEL, isActiveDeal, type DealState, type LossReason } from '@/domain/vocab';
import { NewDealForm } from '@/features/commerce/forms';
import { customerOptions, subsidiaryOptions } from '@/features/commerce/options';
import s from '@/features/commerce/pages.module.css';
import { DealTag } from '@/features/commerce/tags';
import { Money, Notice } from '@/features/commerce/view';
import { fmtKeur } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { dealAccess, loadWorld } from '@/server/dal/world';
import { getI18n, getViewer } from '@/server/session';

type SP = Record<string, string | string[] | undefined>;

export default async function DealsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [{ t, lang }, viewer, today, sp] = await Promise.all([getI18n(), getViewer(), businessToday(), searchParams]);
  const w = await loadWorld(today);
  const filter = sp.filter === 'closed' || sp.filter === 'all' ? sp.filter : 'active';
  const all = [...w.rows.dealRows].sort((a, b) => b.ref.localeCompare(a.ref));
  const of = (f: string) => all.filter((d) => (f === 'active' ? isActiveDeal(d.state) : f === 'closed' ? !isActiveDeal(d.state) : true));
  const list = of(filter);
  const amount = (id: string) => (dealAccess(w, viewer, id).prices ? w.dealAmount(id) : null);
  const pipeline = weightedPipeline(all.map((d) => ({ state: d.state as DealState, amountKeur: amount(d.id), probability: d.probability, closedOn: null })));
  const limited = !can(viewer.roles, 'all_deals');
  return (
    <>
      <PageHeader
        screen="deals"
        crumbs={['Commerce']}
        primary={can(viewer.roles, 'deal') ? <NewDealForm customers={customerOptions(w)} subsidiaries={subsidiaryOptions(w)} primary /> : undefined}
        actions={<>
          {can(viewer.roles, 'deal') && <NewDealForm customers={customerOptions(w).filter((c) => w.customerBy.get(c.value)?.kind === 'subsidiary')} subsidiaries={subsidiaryOptions(w)} capexNeed />}
          <ActionLink href="/export/deals" label={t('Export (CSV)')} icon="download" download />
        </>}
        toolbar={
          <div className={s.toolbar}>
            <Segmented value={filter} options={[
              { value: 'active', label: t('Active'), count: of('active').length, href: '/deals' },
              { value: 'closed', label: t('Closed'), count: of('closed').length, href: '/deals?filter=closed' },
              { value: 'all', label: t('All'), count: all.length, href: '/deals?filter=all' },
            ]} />
            <span className={s.muted}>{t('Weighted pipeline')} : <strong>{fmtKeur(pipeline, lang)}</strong></span>
          </div>
        }
      />
      <div className={s.pipe}>
        {DEAL_STATES.map((st) => <span key={st} className={s.step}>{t(DEAL_STATE_LABEL[st])} · {all.filter((d) => d.state === st).length}</span>)}
      </div>
      <SectionCard scroll>
        {list.length ? (
          <Table size={12.5}>
            <thead><tr><Th>{t('Deal')}</Th><Th>{t('Customer')}</Th><Th>{t('Case')}</Th><Th>{t('State')}</Th><Th>{t('Account manager')}</Th><Th align="right">{t('Amount')}</Th><Th align="right">{t('Prob.')}</Th><Th align="right">{t('Weighted')}</Th></tr></thead>
            <tbody>
              {list.map((d) => {
                const acc = dealAccess(w, viewer, d.id);
                const c = w.customerBy.get(d.customerId);
                const lines = (w.linesOf.get(d.id) ?? []).map((l) => `${w.machineBy.get(w.versionBy.get(l.machineVersionId)!.machineId)!.code} ×${l.quantity}`).join(' · ');
                const a = acc.prices ? w.dealAmount(d.id) : null;
                return (
                  <tr key={d.id}>
                    <Td>{acc.sheet ? <Link href={`/deals/${d.ref}`} className={s.ref}>{d.ref}</Link> : <span className={s.ref}>{d.ref}</span>}<div className={s.muted}>{lines || '—'}</div></Td>
                    <Td>{c?.name}<div className={s.muted}>{d.intermediaryId ? `${t('via')} ${w.customerBy.get(d.intermediaryId)?.name}` : d.capexNeed ? `CAPEX ${d.capexNeed}` : ''}</div></Td>
                    <Td><Tag tone={d.saleCase === 1 ? 'accent-2' : 'neutral'} size="sm">{t('case')} {d.saleCase}</Tag></Td>
                    <Td><DealTag state={d.state} t={t} />{d.lossReason && <div className={s.muted}>{t(LOSS_REASON_LABEL[d.lossReason as LossReason])}{d.lossNote ? ` · ${d.lossNote}` : ''}</div>}</Td>
                    <Td>{d.ownerName}</Td>
                    <Td numeric><Money v={a} show={acc.prices} t={t} lang={lang} /></Td>
                    <Td numeric>{d.probability} %</Td>
                    <Td numeric>{acc.prices && isActiveDeal(d.state) && a != null ? fmtKeur(Math.round((a * d.probability) / 100), lang) : '—'}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : <EmptyState>{t('No deal')}</EmptyState>}
      </SectionCard>
      {limited && <Notice>{t('You see every deal, but the prices and the sheet only of those of your team (U-2).')}</Notice>}
    </>
  );
}
