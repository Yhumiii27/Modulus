// The printable offer (D-13: no customer portal, the offer is a PDF — the browser saves this page as PDF; the deposit in Codex
// goes through the outbox, simulated until the Codex connector is validated). A sent offer prints its frozen content; prices
// only for who sees them (U-2); never the budget.
import { notFound } from 'next/navigation';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { addDaysIso } from '@/lib/dates';
import { fmtDate, fmtKeur } from '@/lib/format';
import { SALE_CASE_LABEL, type SaleCase } from '@/domain/vocab';
import s from '@/features/commerce/print.module.css';
import { businessToday } from '@/server/clock';
import { dealAccess, loadWorld } from '@/server/dal/world';
import { getI18n, getViewer } from '@/server/session';

export default async function OfferPrint({ params }: { params: Promise<{ deal: string; letter: string }> }) {
  const [{ t, lang }, viewer, today, { deal: ref, letter }] = await Promise.all([getI18n(), getViewer(), businessToday(), params]);
  const w = await loadWorld(today);
  const d = w.rows.dealRows.find((x) => x.ref === ref);
  if (!d || !dealAccess(w, viewer, d.id).prices) notFound();
  const o = (w.offersOf.get(d.id) ?? []).find((x) => x.letter === letter);
  if (!o || !o.content) notFound();
  const c = o.content;
  const customer = w.customerBy.get(d.customerId)!;
  return (
    <main className={s.page}>
      <div className={s.head}>
        <div><h1 className={s.title}>{t('Offer')} {d.ref} · {o.letter}</h1><div className={s.muted}>{customer.name} · {t(SALE_CASE_LABEL[d.saleCase as SaleCase])} · {d.deliverySite}</div></div>
        <div className={s.muted}>{t('Sent on')} {fmtDate(o.sentOn, lang)}<br />{t('Valid until')} {fmtDate(addDaysIso(o.sentOn!, o.validityDays), lang)}<br />{c.priceList}</div>
      </div>
      <Table size={12.5}>
        <thead><tr><Th>{t('Item')}</Th><Th align="right">{t('Qty')}</Th><Th align="right">{t('Unit price')}</Th><Th align="right">{t('Amount')}</Th></tr></thead>
        <tbody>
          {c.lines.flatMap((l) => [
            <tr key={`m${l.number}`}><Td><strong>{l.machine} v{l.version}</strong> · {l.label}</Td><Td numeric>{l.quantity}</Td><Td numeric>{fmtKeur(l.machineSaleKeur, lang)}</Td><Td numeric>{fmtKeur((l.machineSaleKeur ?? 0) * l.quantity, lang)}</Td></tr>,
            ...l.options.map((x) => <tr key={`${l.number}${x.code}`}><Td>{x.code} · {x.label}</Td><Td numeric>{l.quantity}</Td><Td numeric>{fmtKeur(x.saleKeur, lang)}</Td><Td numeric>{fmtKeur((x.saleKeur ?? 0) * l.quantity, lang)}</Td></tr>),
          ])}
          {c.discountPct > 0 && <tr><Td>{t('Discount')} {c.discountPct} %</Td><Td /><Td /><Td numeric>−{fmtKeur(Math.round((c.grossSaleKeur - c.saleKeur) * 10) / 10, lang)}</Td></tr>}
          <tr className={s.sum}><Td>{t('Total excluding taxes')}</Td><Td /><Td /><Td numeric>{fmtKeur(c.saleKeur, lang)}{c.rate ? ` · ${Math.round(c.saleKeur * c.rate).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB')} k${c.currency}` : ''}</Td></tr>
        </tbody>
      </Table>
      <div>{t('Lead time')} : {c.leadWeeks} {t('weeks')}{c.payment ? ` · ${t('Payment terms')} : ${c.payment.deposit} % ${t('deposit')} · ${c.payment.delivery} % ${t('delivery')} · ${c.payment.acceptance} % ${t('acceptance')}` : ''}</div>
      {c.assumptions && <div><strong>{t('Assumptions')}</strong><p>{c.assumptions}</p></div>}
      {c.reservations && <div><strong>{t('Reservations')}</strong><p>{c.reservations}</p></div>}
      <div className={s.muted}>{t('Frozen offer: any change is a new offer.')}{o.codexRef ? ` · Codex ${o.codexRef}` : ''}</div>
    </main>
  );
}
