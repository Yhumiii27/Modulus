// Home (the mockup's "Accueil"): the weighted pipeline, deals to quote, quotation requests late or due, offers waiting for a
// review, conversion rate and average quotation time, the pipeline by state, my deadlines and the know-how to handle — every
// figure computed on display from the deals, offers and requests (never stored).
import Link from 'next/link';
import { PageHeader } from '@/components/app/shell/page-header';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { EmptyState } from '@/components/app/EmptyState';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { conversionRate, weightedPipeline } from '@/domain/deals';
import { proposeForCatalogue, unsoldSince } from '@/domain/knowhow';
import { answerDays, dueOn, lateDays } from '@/domain/quotes';
import { can } from '@/domain/rights';
import { DEAL_STATES, DEAL_STATE_LABEL, isActiveDeal, isOpenQuote, type DealState } from '@/domain/vocab';
import { NewDealForm, NewQuoteForm } from '@/features/commerce/forms';
import { draftContent, offerReview } from '@/server/commerce/core';
import s from '@/features/commerce/pages.module.css';
import { LateTag } from '@/features/commerce/tags';
import { Notice } from '@/features/commerce/view';
import { addDaysIso } from '@/lib/dates';
import { fmtDate, fmtKeur, fmtNum, fmtPct } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { dealAccess, loadWorld } from '@/server/dal/world';
import { getI18n, getViewer } from '@/server/session';
import { customerOptions, dealOptions, machineOptions, subsidiaryOptions } from '@/features/commerce/options';

export default async function HomePage() {
  const [{ t, lang }, viewer, today] = await Promise.all([getI18n(), getViewer(), businessToday()]);
  const w = await loadWorld(today);
  const deals = w.rows.dealRows;
  const visible = (id: string) => dealAccess(w, viewer, id).prices;
  const kpiDeals = deals.map((d) => ({ state: d.state as DealState, amountKeur: visible(d.id) ? w.dealAmount(d.id) : null, probability: d.probability, closedOn: d.state === 'open' || d.state === 'quoting' || d.state === 'offer_sent' ? null : d.updatedAt.toISOString().slice(0, 10) }));
  const pipeline = weightedPipeline(kpiDeals);
  const conv = conversionRate(kpiDeals, addDaysIso(today, -365));
  const toQuote = deals.filter((d) => d.state === 'open' || d.state === 'quoting');
  const openQuotes = w.rows.quoteRows.filter((q) => isOpenQuote(q.state));
  const late = openQuotes.filter((q) => lateDays(q.receivedOn, q.targetDays, today) > 0 || dueOn(q.receivedOn, q.targetDays) === today);
  const answered = w.rows.quoteRows.filter((q) => q.answeredOn && q.answeredOn.slice(0, 4) === today.slice(0, 4));
  const avgDays = answered.length ? answered.reduce((n, q) => n + answerDays(q.receivedOn, q.answeredOn!), 0) / answered.length : null;
  const pendingReviews = w.rows.offerRows.filter((o) => o.state === 'draft' && isActiveDeal(w.dealBy.get(o.dealId)!.state)).map((o) => ({ o, d: w.dealBy.get(o.dealId)!, check: offerReview(w, o), sale: draftContent(w, o).saleKeur }))
    .filter((x) => x.check.required && !(w.reviewsOf.get(x.o.id) ?? []).some((r) => r.decision === 'go'));
  const byState = DEAL_STATES.map((st) => ({ st, n: deals.filter((d) => d.state === st).length, amount: deals.filter((d) => d.state === st && visible(d.id)).reduce((n, d) => n + (w.dealAmount(d.id) ?? 0), 0) }));
  const maxAmount = Math.max(1, ...byState.map((b) => b.amount));
  const mine = [
    ...openQuotes.filter((q) => q.followedById === viewer.userId || can(viewer.roles, q.state === 'qualification' ? 'qualify' : 'estimate'))
      .map((q) => ({ ref: q.ref, href: `/quotes/${q.ref}`, what: `${q.title} · ${t(q.state === 'qualification' ? 'qualification' : 'estimating')}`, on: dueOn(q.receivedOn, q.targetDays), late: lateDays(q.receivedOn, q.targetDays, today) })),
    ...(can(viewer.roles, 'validate_prices') ? pendingReviews.map((x) => ({ ref: x.d.ref, href: `/deals/${x.d.ref}?tab=review`, what: `${t('Review of offer')} ${x.o.letter}`, on: today, late: 0 })) : []),
    ...(can(viewer.roles, 'validate_prices') ? w.rows.listRows.filter((l) => l.state === 'to_validate').map((l) => ({ ref: l.code, href: '/catalogue?tab=prices', what: t('Price list to validate'), on: l.validFrom, late: 0 })) : []),
  ].sort((a, b) => a.on.localeCompare(b.on));
  // Know-how to handle (docs/spec/04 § 4).
  const proposals = w.rows.optionRows.filter((o) => o.origin === 'specific' && proposeForCatalogue(w.optionTrace(o.id), w.settings));
  const avoid = w.rows.optionRows.filter((o) => w.optionLevel(o.id) === 'avoid');
  const unsold = w.rows.optionRows.filter((o) => o.origin === 'catalogue' && o.active && unsoldSince(w.lastSold.get(o.id) ?? null, o.createdAt.toISOString().slice(0, 10), today, w.settings));
  const canDeal = can(viewer.roles, 'deal');
  return (
    <>
      <PageHeader
        screen="home"
        primary={canDeal ? <NewDealForm customers={customerOptions(w)} subsidiaries={subsidiaryOptions(w)} primary /> : undefined}
        actions={can(viewer.roles, 'quote_request') ? <NewQuoteForm deals={dealOptions(w, viewer)} machines={machineOptions(w)} /> : undefined}
      />
      <KpiGrid min={170}>
        <KpiTile size="lg" label={t('Weighted pipeline')} value={fmtKeur(pipeline, lang)} sub={`${deals.filter((d) => isActiveDeal(d.state)).length} ${t('active deals')} · ${t('Σ amount × probability')}`} />
        <KpiTile size="lg" label={t('Deals to quote')} value={toQuote.length} sub={t('open or quoting')} />
        <KpiTile size="lg" label={t('Quotation requests late or due')} value={late.length} tone={late.length ? 'alert' : 'default'} sub={t('beyond or at the target of their class')} />
        <KpiTile size="lg" label={t('Offers waiting for a review')} value={pendingReviews.length} tone={pendingReviews.length ? 'alert' : 'default'} sub={`${t('beyond')} ${fmtKeur(w.settings.reviewAboveKeur, lang)} ${t('or an option “never done”')} (D-8)`} />
        <KpiTile size="lg" label={t('Conversion rate')} value={fmtPct(conv.rate, lang)} sub={`${t('12 months')} · ${conv.won} / ${conv.closed}`} />
        <KpiTile size="lg" label={t('Average quotation time')} value={avgDays == null ? '—' : `${fmtNum(avgDays, lang)} ${t('wd')}`} sub={t('requests answered this year')} />
      </KpiGrid>
      <Notice>{t('Indicators computed on display from the deals, offers and quotation requests (never stored)')} · {fmtDate(today, lang)}.</Notice>
      <div className={s.grid2}>
        <SectionCard title={t('Pipeline by state')} hint={t('Amount of the deals (sale price) whose prices you see')}>
          <div className={s.bars}>
            {byState.map((b) => (
              <div key={b.st} className={s.barRow}>
                <span>{t(DEAL_STATE_LABEL[b.st])} <span className={s.muted}>({b.n})</span></span>
                <span className={s.bar}><span className={`${s.barFill} ${b.st === 'lost' || b.st === 'abandoned' ? s.barAlt : ''}`} style={{ width: `${Math.max(3, (b.amount / maxAmount) * 100)}%`, display: 'block' }} /></span>
                <span className={s.ref}>{fmtKeur(b.amount, lang)}</span>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title={t('My deadlines')}>
          {mine.length ? (
            <Table size={12.5}>
              <thead><tr><Th>{t('Object')}</Th><Th>{t('Due')}</Th><Th /></tr></thead>
              <tbody>
                {mine.slice(0, 10).map((m, i) => (
                  <tr key={`${m.ref}${i}`}>
                    <Td><Link href={m.href} className={s.ref}>{m.ref}</Link> <span className={s.muted}>{m.what}</span></Td>
                    <Td nowrap>{m.on === today ? t('today') : fmtDate(m.on, lang)}</Td>
                    <Td><LateTag days={m.late} t={t} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : <EmptyState>{t('Nothing waits for you')}</EmptyState>}
        </SectionCard>
        <SectionCard title={t('Offers waiting for a review')}>
          {pendingReviews.length ? (
            <ul className={s.list}>
              {pendingReviews.map((x) => (
                <li key={x.o.id} className={s.item}>
                  <span><Link href={`/deals/${x.d.ref}?tab=review`} className={s.ref}>{x.d.ref}</Link> · {t('offer')} {x.o.letter} <span className={s.muted}>{w.customerBy.get(x.d.customerId)?.name}</span></span>
                  <span className={s.muted}>{visible(x.d.id) ? fmtKeur(x.sale, lang) : ''}{x.check.riskyOptions.length ? ` · ${t('option “never done” or “to avoid”')}` : ''}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState>{t('No offer waits for a review')}</EmptyState>}
        </SectionCard>
        <SectionCard title={t('Know-how to handle')} actions={<Link href="/knowhow" className={s.muted}>{t('Open the know-how map')}</Link>}>
          <ul className={s.list}>
            {proposals.map((o) => <li key={o.id} className={s.item}><span><strong>{o.label}</strong> <span className={s.muted}>({o.code})</span></span><span className={s.muted}>{t('to propose for the catalogue')} (D-12)</span></li>)}
            {avoid.map((o) => <li key={o.id} className={s.item}><span><strong>{o.label}</strong> <span className={s.muted}>({o.code})</span></span><span className={s.muted}>{t('to avoid')}</span></li>)}
            {unsold.slice(0, 4).map((o) => <li key={o.id} className={s.item}><span><strong>{o.label}</strong> <span className={s.muted}>({o.code})</span></span><span className={s.muted}>{t('not sold for')} {w.settings.unsoldMonths} {t('months')}</span></li>)}
            {!proposals.length && !avoid.length && !unsold.length && <EmptyState>{t('Nothing to handle')}</EmptyState>}
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
