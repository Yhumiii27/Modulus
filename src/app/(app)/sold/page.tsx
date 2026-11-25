// Sold configurations (docs/spec/02 § 3): the frozen copy of the offer retained at the order, its amendments, the Keystone
// project created from it and the project's return (D-9).
import Link from 'next/link';
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { EmptyState } from '@/components/app/EmptyState';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { Tag } from '@norma/charte/ds/Tag';
import s from '@/features/commerce/pages.module.css';
import { Money, Notice } from '@/features/commerce/view';
import { fmtDate } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { dealAccess, loadWorld } from '@/server/dal/world';
import { getI18n, getViewer } from '@/server/session';

export default async function SoldPage() {
  const [{ t, lang }, viewer, today] = await Promise.all([getI18n(), getViewer(), businessToday()]);
  const w = await loadWorld(today);
  const list = [...w.soldVersions.values()].map((v) => v.at(-1)!).sort((a, b) => b.orderedOn.localeCompare(a.orderedOn));
  return (
    <>
      <PageHeader screen="sold" crumbs={['Commerce']} />
      <SectionCard scroll>
        {list.length ? (
          <Table size={12.5}>
            <thead><tr><Th>{t('Configuration')}</Th><Th>{t('Customer')}</Th><Th>{t('Machines')}</Th><Th>{t('Version')}</Th><Th>{t('Order')}</Th><Th>{t('Keystone project')}</Th><Th align="right">{t('Amount sold')}</Th><Th>{t('Project return')}</Th></tr></thead>
            <tbody>
              {list.map((c) => {
                const d = w.dealBy.get(c.dealId)!;
                const fb = w.feedbackOf.get(c.ref) ?? [];
                return (
                  <tr key={c.id}>
                    <Td><Link href={`/sold/${c.ref}`} className={s.ref}>{c.ref}</Link><div className={s.muted}>{d.ref}</div></Td>
                    <Td>{w.customerBy.get(d.customerId)?.name} <span className={s.muted}>· {t('case')} {d.saleCase}</span></Td>
                    <Td>{c.content.lines.map((l) => `${l.machine} v${l.version} ×${l.quantity}`).join(' · ')}</Td>
                    <Td><Tag tone="accent" size="sm">v{c.version}</Tag></Td>
                    <Td nowrap>{fmtDate(c.orderedOn, lang)}</Td>
                    <Td>{c.keystoneProject ?? '—'}</Td>
                    <Td numeric><Money v={c.totalSaleKeur} show={dealAccess(w, viewer, d.id).prices} t={t} lang={lang} /></Td>
                    <Td>{fb.length ? <Tag tone="outline" size="sm">{t('received')}</Tag> : <Tag tone="neutral" size="sm">{t('expected at closure')}</Tag>}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : <EmptyState>{t('No sold configuration yet')}</EmptyState>}
      </SectionCard>
      <Notice>{t('A sold configuration is a frozen copy of the offer retained (database trigger). An amendment creates the next version; the previous ones stay readable. Keystone creates the project from modulus.pub_configurations_vendues.')}</Notice>
    </>
  );
}
