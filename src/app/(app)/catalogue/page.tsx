// The catalogue (docs/spec/01): standard machines by type with their version in force, capacity, lead time, options, sale
// price — budget and margin only for the roles of D-15 —; the catalogue options; the dated price lists (D-4, D-14).
import Link from 'next/link';
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { EmptyState } from '@/components/app/EmptyState';
import { ActionLink } from '@/components/app/ActionForm';
import { Segmented } from '@norma/charte/ds/Segmented';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { marginRate } from '@/domain/pricing';
import { can, canSeeCosts } from '@/domain/rights';
import { OPTION_CATEGORY_LABEL, type OptionCategory } from '@/domain/vocab';
import { NewMachineForm, NewOptionForm, NewPriceListForm, PriceForm, ValidatePriceListButton } from '@/features/commerce/forms';
import s from '@/features/commerce/pages.module.css';
import { LevelTag, PriceListTag, VersionTag } from '@/features/commerce/tags';
import { Notice, Tabs, pct } from '@/features/commerce/view';
import { fmtDate, fmtKeur } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { loadWorld } from '@/server/dal/world';
import { getI18n, getViewer } from '@/server/session';

type SP = Record<string, string | string[] | undefined>;

export default async function CataloguePage({ searchParams }: { searchParams: Promise<SP> }) {
  const [{ t, lang }, viewer, today, sp] = await Promise.all([getI18n(), getViewer(), businessToday(), searchParams]);
  const w = await loadWorld(today);
  const tab = sp.tab === 'options' || sp.tab === 'prices' ? sp.tab : 'machines';
  const type = typeof sp.type === 'string' && w.typeBy.has(sp.type) ? sp.type : 'all';
  const costs = canSeeCosts(viewer.roles);
  const engineering = can(viewer.roles, 'catalogue');
  const machineOpts = w.rows.machineRows.map((m) => ({ value: m.code, label: m.code }));
  const types = [...w.rows.types].sort((a, b) => a.code.localeCompare(b.code));
  let body;
  if (tab === 'machines') {
    body = (
      <SectionCard scroll>
        <Table size={12.5}>
          <thead><tr><Th>{t('Machine')}</Th><Th>{t('Version')}</Th><Th>{t('State')}</Th><Th>{t('Capacity')}</Th><Th>{t('Standard lead time')}</Th><Th align="right">{t('Options')}</Th><Th align="right">{t('Indicative sale price')}</Th>{costs && <Th align="right">{t('Budget')}</Th>}{costs && <Th align="right">{t('Margin')}</Th>}</tr></thead>
          <tbody>
            {types.filter((x) => type === 'all' || x.code === type).flatMap((ty) => [
              <tr key={ty.code}><Td colSpan={9} className={s.muted}>{ty.code} · {ty.label}</Td></tr>,
              ...w.rows.machineRows.filter((m) => m.typeCode === ty.code).sort((a, b) => a.code.localeCompare(b.code)).map((m) => {
                const v = w.published(m.id) ?? w.latest(m.id)!;
                const sale = w.saleOfMachine(m.id);
                const budget = w.budgetOfVersion(v.id).entered;
                return (
                  <tr key={m.id}>
                    <Td><Link href={`/catalogue/${m.code}`} className={s.ref}>{m.code}</Link><div className={s.muted}>{v.label}</div></Td>
                    <Td>v{v.version}</Td>
                    <Td><VersionTag state={v.state} t={t} /></Td>
                    <Td numeric>{v.nominalCapacity} {v.capacityUnit}</Td>
                    <Td numeric>{v.leadWeeks} {t('wk')}</Td>
                    <Td numeric>{w.availableOptions(m.id).length}</Td>
                    <Td numeric>{fmtKeur(sale, lang)}</Td>
                    {costs && <Td numeric>{fmtKeur(budget, lang)}</Td>}
                    {costs && <Td numeric>{pct(marginRate(sale, budget), lang)}</Td>}
                  </tr>
                );
              }),
            ])}
          </tbody>
        </Table>
      </SectionCard>
    );
  } else if (tab === 'options') {
    const opts = w.rows.optionRows.filter((o) => o.origin === 'catalogue').sort((a, b) => a.code.localeCompare(b.code));
    body = (
      <SectionCard scroll hint={t('An option outside the catalogue is born from a quotation request; sold twice with a controlled gap, it is proposed for the catalogue (D-12).')}>
        <Table size={12.5}>
          <thead><tr><Th>{t('Option')}</Th><Th>{t('Category')}</Th><Th>{t('Machines')}</Th><Th align="right">{t('Sale price')}</Th>{costs && <Th align="right">{t('Budget')}</Th>}<Th align="right">{t('Extra lead time')}</Th><Th>{t('Know-how')}</Th></tr></thead>
          <tbody>{opts.map((o) => (
            <tr key={o.id}>
              <Td>{o.code}<div className={s.muted}>{o.label}</div></Td>
              <Td>{t(OPTION_CATEGORY_LABEL[o.category as OptionCategory])}</Td>
              <Td>{(w.optionMachinesBy.get(o.id) ?? []).map((x) => w.machineBy.get(x.machineId)?.code).join(', ')}</Td>
              <Td numeric>{fmtKeur(w.saleOfOption(o.id), lang)}</Td>
              {costs && <Td numeric>{fmtKeur(w.budgetOfOption(o.id).entered, lang)}</Td>}
              <Td numeric>{o.extraWeeks ? `+${o.extraWeeks} ${t('wk')}` : '—'}</Td>
              <Td><LevelTag level={w.optionLevel(o.id)} t={t} /></Td>
            </tr>
          ))}</tbody>
        </Table>
      </SectionCard>
    );
  } else {
    const lists = [...w.rows.listRows].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
    const items = [...w.rows.machineRows.map((m) => ({ value: m.code, label: m.code })), ...w.rows.optionRows.filter((o) => o.origin === 'catalogue').map((o) => ({ value: o.code, label: `${o.code} · ${o.label}` }))];
    body = (
      <SectionCard title={t('Dated price lists')} hint={t('A price list is published once validated by the sales direction; beyond the discount threshold, the general management confirms too (D-4). Euros; an offer may be issued in the customer’s currency at the rate of the day, fixed in the offer (D-14).')}>
        <Table size={12.5}>
          <thead><tr><Th>{t('Price list')}</Th><Th>{t('Validity')}</Th><Th>{t('Currency')}</Th><Th>{t('State')}</Th><Th>{t('Validation')}</Th><Th align="right">{t('Max. discount')}</Th><Th align="right">{t('Prices')}</Th><Th /></tr></thead>
          <tbody>{lists.map((l) => (
            <tr key={l.id}>
              <Td><strong>{l.code}</strong>{w.listNow?.id === l.id && <div className={s.muted}>{t('in force')}</div>}</Td>
              <Td nowrap>{fmtDate(l.validFrom, lang)} → {fmtDate(l.validTo, lang)}</Td>
              <Td>{l.currency}</Td>
              <Td><PriceListTag state={l.state} t={t} /></Td>
              <Td>{l.validatedByName ? `${l.validatedByName} · ${fmtDate(l.validatedAt, lang)}` : `${t('proposed by')} ${l.proposedByName}`}{l.confirmedByName && <div className={s.muted}>{t('confirmed by')} {l.confirmedByName}</div>}</Td>
              <Td numeric>{l.maxDiscountPct} %</Td>
              <Td numeric>{(w.itemsOf.get(l.id) ?? []).length}</Td>
              <Td>{l.state === 'to_validate' && (
                <>
                  {can(viewer.roles, 'validate_prices') && <ValidatePriceListButton code={l.code} label={can(viewer.roles, 'deal') ? `${t('Validate')} ${l.code}` : `${t('Confirm')} ${l.code}`} />}
                  {can(viewer.roles, 'budget') && <PriceForm list={l.code} items={items} />}
                </>
              )}</Td>
            </tr>
          ))}</tbody>
        </Table>
      </SectionCard>
    );
  }
  return (
    <>
      <PageHeader
        screen="catalogue"
        crumbs={['Catalogue']}
        primary={engineering ? <NewMachineForm types={types.map((x) => ({ value: x.code, label: `${x.code} · ${x.label}` }))} primary /> : undefined}
        actions={<>
          {engineering && <NewOptionForm machines={machineOpts} />}
          {can(viewer.roles, 'budget') && <NewPriceListForm year={+today.slice(0, 4) + 1} />}
          <ActionLink href="/configurator" label={t('Open the configurator')} />
        </>}
        toolbar={tab === 'machines' ? <Segmented value={type} options={[{ value: 'all', label: t('All types'), href: '/catalogue' }, ...types.map((x) => ({ value: x.code, label: x.code, href: `/catalogue?type=${x.code}` }))]} /> : undefined}
      />
      <Tabs base="/catalogue" current={tab} tabs={[{ id: 'machines', label: t('Machines') }, { id: 'options', label: t('Options') }, { id: 'prices', label: t('Price lists') }]} />
      {body}
      <Notice>{t('Published to Arche without budget nor margin (contract K-01 v2, view modulus.pub_catalogue_machines) and to Keystone with the budget and the BOM.')} {costs ? '' : t('Your profile does not see the costs.')}</Notice>
      {!w.rows.machineRows.length && <EmptyState>{t('The catalogue is empty: it is taken over from Keystone at delivery 2.')}</EmptyState>}
    </>
  );
}
