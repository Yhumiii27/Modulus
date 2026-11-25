// A deal (docs/spec/02): its facts and sale case (D-3), its configuration lines priced with the know-how level of each option,
// its offers (a draft computed live, a sent one frozen), the offer review (D-8, D-4) and its journal. The sheet opens for its
// team and the directions (U-2): anyone else gets a 404.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desc, like } from 'drizzle-orm';
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { KeyValueList } from '@/components/app/KeyValueList';
import { EmptyState } from '@/components/app/EmptyState';
import { ActionLink } from '@/components/app/ActionForm';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { Tag } from '@norma/charte/ds/Tag';
import { CheckCircle, Warning } from '@phosphor-icons/react/dist/ssr';
import { marginRate } from '@/domain/pricing';
import { reviewCleared } from '@/domain/review';
import { can } from '@/domain/rights';
import { DEAL_ORIGIN_LABEL, DEAL_STATE_LABEL, SALE_CASE_LABEL, TEAM_ROLE_LABEL, isActiveDeal, isOpenQuote, type DealOrigin, type DealState, type SaleCase, type TeamRole } from '@/domain/vocab';
import { CloseDealForm, EditDealForm, LineForm, MemberForm, NewQuoteForm, OfferForm, OrderForm, RemoveLineButton, ReviewForm, SendOfferForm } from '@/features/commerce/forms';
import { machineOptions } from '@/features/commerce/options';
import s from '@/features/commerce/pages.module.css';
import { DealTag, LevelTag, OfferTag, QuoteTag } from '@/features/commerce/tags';
import { Notice, Tabs, pct } from '@/features/commerce/view';
import { addDaysIso } from '@/lib/dates';
import { fmtDate, fmtInstant, fmtKeur } from '@/lib/format';
import { draftContent, offerReview } from '@/server/commerce/core';
import { businessToday } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { auditEntries, users } from '@/server/db/schema';
import { dealAccess, loadWorld } from '@/server/dal/world';
import { codexHref } from '@/server/integrations/codex/links';
import { getI18n, getViewer } from '@/server/session';

type SP = Record<string, string | string[] | undefined>;

export default async function DealPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<SP> }) {
  const [{ t, lang }, viewer, today, { code }, sp] = await Promise.all([getI18n(), getViewer(), businessToday(), params, searchParams]);
  const w = await loadWorld(today);
  const d = w.rows.dealRows.find((x) => x.ref === code);
  if (!d) notFound();
  const acc = dealAccess(w, viewer, d.id);
  if (!acc.sheet) notFound();
  const tab = ['offers', 'review', 'journal'].includes(String(sp.tab)) ? String(sp.tab) : 'lines';
  const customer = w.customerBy.get(d.customerId)!;
  const lines = w.frozenLines(d.id);
  const offersOf = w.offersOf.get(d.id) ?? [];
  const draft = offersOf.find((o) => o.state === 'draft') ?? null;
  const sent = offersOf.filter((o) => o.state === 'sent');
  const active = isActiveDeal(d.state);
  const mayDeal = can(viewer.roles, 'deal');
  const members = w.membersOf.get(d.id) ?? [];
  const quotes = w.rows.quoteRows.filter((q) => q.dealId === d.id);
  const check = draft ? offerReview(w, draft) : null;
  const draftCfg = draft ? draftContent(w, draft) : null;
  const cleared = draft && check ? reviewCleared(check, w.reviewsOf.get(draft.id) ?? []) : false;
  const people = (await (await getDb()).select().from(users)).filter((u) => u.active && !members.some((m) => m.userId === u.id)).map((u) => ({ value: u.id, label: u.name }));

  const primary = !mayDeal || !active ? undefined
    : d.state === 'offer_sent' && sent.length && !draft ? <OrderForm dealRef={d.ref} letters={sent.map((o) => o.letter)} today={today} />
    : draft && cleared && draftCfg && !draftCfg.gaps.length ? <SendOfferForm dealRef={d.ref} letter={draft.letter} currency={draft.currency} />
    : !draft && lines.length ? <OfferForm dealRef={d.ref} d={{ discount: 0, validity: w.settings.offerValidityDays, currency: 'EUR', assumptions: offersOf.at(-1)?.assumptions ?? null, reservations: null }} primary />
    : undefined;
  const steps: DealState[] = ['open', 'quoting', 'offer_sent', d.state === 'lost' || d.state === 'abandoned' ? (d.state as DealState) : 'won'];

  let body;
  if (tab === 'lines') {
    body = (
      <div className={s.grid2}>
        <SectionCard title={t('Deal')}>
          <KeyValueList items={[
            { k: t('Sale case'), v: t(SALE_CASE_LABEL[d.saleCase as SaleCase]) },
            { k: t('Customer'), v: <>{customer.name} <span className={s.muted}>· {customer.source === 'keystone' ? t('read in Keystone') : t('prospect created in Modulus (D-16)')}</span></> },
            ...(d.capexNeed ? [{ k: t('Arche need'), v: <>{d.capexNeed} <span className={s.muted}>· {t('machine need of the CAPEX; the order will be its G2 Go')}</span></> }] : []),
            ...(d.intermediaryId ? [{ k: t('Intermediary subsidiary'), v: w.customerBy.get(d.intermediaryId)?.name }] : []),
            ...(d.saleCase === 3 ? [{ k: t('Direct customer'), v: t('no access to the group’s tools: need and quotation entered by the account manager (D-17)') }] : []),
            { k: t('Delivery site'), v: d.deliverySite },
            { k: t('Origin'), v: t(DEAL_ORIGIN_LABEL[d.origin as DealOrigin]) },
            { k: t('Team'), v: members.map((m) => `${m.userName} (${t(TEAM_ROLE_LABEL[m.role as TeamRole])})`).join(', ') },
            { k: t('Wished date'), v: d.wishedFor ?? '—' },
            { k: t('Probability'), v: `${d.probability} %` },
            { k: t('Need expressed'), v: <span className={s.typed}>{d.need}</span> },
          ]} />
        </SectionCard>
        <div className={s.stack}>
          {lines.map((l) => (
            <SectionCard key={l.number} title={`${t('Line')} ${l.number} · ${l.machine} v${l.version} × ${l.quantity}`}
              actions={active && mayDeal ? <><ActionLink href={`/configurator?deal=${d.ref}&line=${l.number}`} label={t('Configure')} /><RemoveLineButton dealRef={d.ref} number={l.number} /></> : undefined}>
              <Table size={12.5}>
                <thead><tr><Th>{t('Item')}</Th><Th align="right">{t('Unit price')}</Th>{acc.costs && <Th align="right">{t('Budget')}</Th>}<Th>{t('Know-how')}</Th></tr></thead>
                <tbody>
                  <tr><Td>{l.label}</Td><Td numeric>{fmtKeur(l.machineSaleKeur, lang)}</Td>{acc.costs && <Td numeric>{fmtKeur(l.machineBudgetKeur, lang)}</Td>}<Td /></tr>
                  {l.options.map((o) => (
                    <tr key={o.code}><Td>{o.label} <span className={s.muted}>{o.code}</span> {o.origin === 'specific' && <Tag tone="outline" size="sm">{t('specific')}</Tag>}</Td><Td numeric>{fmtKeur(o.saleKeur, lang)}</Td>{acc.costs && <Td numeric>{fmtKeur(o.budgetKeur, lang)}</Td>}<Td><LevelTag level={o.level} t={t} /></Td></tr>
                  ))}
                  {quotes.filter((q) => isOpenQuote(q.state) && w.machineBy.get(q.machineId)?.code === l.machine).map((q) => (
                    <tr key={q.id}><Td>{q.title} <Tag tone="outline" size="sm">{t('specific')}</Tag><div className={s.muted}><Link href={`/quotes/${q.ref}`}>{q.ref}</Link> · <QuoteTag state={q.state} t={t} /></div></Td><Td numeric className={s.muted}>{t('to quote')}</Td>{acc.costs && <Td />}<Td /></tr>
                  ))}
                  <tr className={s.sum}><Td>{t('Unit total')} · {l.leadWeeks} {t('weeks')}</Td><Td numeric>{fmtKeur(l.unitSaleKeur, lang)}</Td>{acc.costs && <Td numeric>{fmtKeur(l.unitBudgetKeur, lang)}</Td>}<Td /></tr>
                </tbody>
              </Table>
            </SectionCard>
          ))}
          {!lines.length && <EmptyState>{t('No configuration line yet')}</EmptyState>}
        </div>
      </div>
    );
  } else if (tab === 'offers') {
    body = (
      <>
        <SectionCard title={t('Offers')} hint={t('An offer freezes when sent: lines, BOM, prices, lead time, validity, payment terms, assumptions, reservations, know-how levels. Its PDF is filed in Codex.')} scroll>
          {offersOf.length ? (
            <Table size={12.5}>
              <thead><tr><Th>{t('Offer')}</Th><Th>{t('State')}</Th><Th align="right">{t('Sale price')}</Th>{acc.costs && <Th align="right">{t('Budget')}</Th>}{acc.costs && <Th align="right">{t('Margin')}</Th>}<Th>{t('Lead time')}</Th><Th>{t('Validity')}</Th><Th>{t('PDF')}</Th></tr></thead>
              <tbody>
                {offersOf.map((o) => {
                  const c = o.content ?? draftContent(w, o);
                  const href = o.codexRef ? codexHref(o.codexRef) : null;
                  return (
                    <tr key={o.id}>
                      <Td><strong>{o.letter}</strong>{o.discountPct ? <div className={s.muted}>{t('discount')} {o.discountPct} %</div> : null}</Td>
                      <Td><OfferTag state={o.state} t={t} />{o.sentOn && <div className={s.muted}>{fmtDate(o.sentOn, lang)} · {o.sentByName}</div>}{o.note && <div className={s.muted}>{o.note}</div>}</Td>
                      <Td numeric>{fmtKeur(c.saleKeur, lang)}{o.currency !== 'EUR' && o.rate ? <div className={s.muted}>{(c.saleKeur * o.rate).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 0 })} k{o.currency}</div> : null}</Td>
                      {acc.costs && <Td numeric>{fmtKeur(c.budgetKeur, lang)}</Td>}
                      {acc.costs && <Td numeric>{pct(marginRate(c.saleKeur, c.budgetKeur), lang)}</Td>}
                      <Td nowrap>{c.leadWeeks} {t('weeks')}</Td>
                      <Td nowrap>{o.sentOn ? `${t('until')} ${fmtDate(addDaysIso(o.sentOn, o.validityDays), lang)}` : `${o.validityDays} ${t('days when sent')}`}</Td>
                      <Td>{o.state === 'draft' ? <span className={s.muted}>{t('when sent')}</span> : <><Link href={`/print/offers/${d.ref}/${o.letter}`} target="_blank">{t('Print')}</Link>{o.codexRef && <div className={s.muted}>{href ? <a href={href}>{o.codexRef}</a> : o.codexRef}</div>}</>}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          ) : <EmptyState>{t('No offer yet')}</EmptyState>}
        </SectionCard>
        {(() => {
          const last = draft ?? offersOf.at(-1);
          if (!last) return null;
          const c = last.content ?? draftContent(w, last);
          return (
            <div className={s.grid2}>
              <SectionCard title={`${t('Assumptions of the estimate')} · ${t('offer')} ${last.letter}`}><p className={s.typed}>{last.assumptions ?? '—'}</p></SectionCard>
              <SectionCard title={t('Reservations')}><p className={s.typed}>{last.reservations ?? '—'}</p>{c.gaps.length > 0 && <Notice warn title={t('Incomplete')}>{c.gaps.join(' · ')}</Notice>}
                {c.payment && <p className={s.muted}>{t('Payment terms')} : {c.payment.deposit} % {t('deposit')} · {c.payment.delivery} % {t('delivery')} · {c.payment.acceptance} % {t('acceptance')}</p>}</SectionCard>
            </div>
          );
        })()}
      </>
    );
  } else if (tab === 'review') {
    const reviews = offersOf.flatMap((o) => (w.reviewsOf.get(o.id) ?? []).map((r) => ({ o, r }))).sort((a, b) => +b.r.decidedAt - +a.r.decidedAt);
    const level = can(viewer.roles, 'deal') ? 'sales_director' : 'general_management';
    const mayReview = draft && check?.required && can(viewer.roles, 'validate_prices') && (level === 'sales_director' || check.needsGeneralManagement);
    body = (
      <div className={s.grid2}>
        <SectionCard title={draft ? `${t('Review of offer')} ${draft.letter} · ${t('go / no-go')}` : t('Offer review')} hint={t('Checklist computed from the offer; the decision and its author are recorded.')} actions={mayReview ? <ReviewForm dealRef={d.ref} letter={draft!.letter} level={level === 'sales_director' ? 'Sales director' : 'General management'} /> : undefined}>
          {draft && check ? (
            <>
              <p className={s.muted}>{check.required ? t('Review required (D-8)') : t('No review required for this offer')}{check.needsGeneralManagement ? ` · ${t('discount beyond the threshold: the general management validates too (D-4)')}` : ''}</p>
              {check.items.filter((x) => acc.costs || !x.label.startsWith('Margin')).map((x) => (
                <div key={x.label} className={s.check}>
                  {x.ok ? <CheckCircle className={s.ok} aria-hidden /> : <Warning className={s.warn} aria-hidden />}
                  <span>{t(x.label)}</span><span className={s.muted}>{x.detail}</span>
                </div>
              ))}
              {cleared && <Notice>{t('Review cleared: the offer can be sent.')}</Notice>}
              {!can(viewer.roles, 'validate_prices') && check.required && <p className={s.muted}>{t('Decision reserved to the sales direction.')}</p>}
            </>
          ) : <EmptyState>{t('No draft offer to review')}</EmptyState>}
        </SectionCard>
        <SectionCard title={t('Previous reviews')}>
          {reviews.length ? (
            <Table size={12.5}>
              <thead><tr><Th>{t('Offer')}</Th><Th>{t('Decision')}</Th><Th>{t('By')}</Th><Th>{t('Date')}</Th></tr></thead>
              <tbody>{reviews.map(({ o, r }) => <tr key={r.id}><Td>{o.letter}</Td><Td><Tag tone={r.decision === 'go' ? 'accent' : 'outline'} size="sm">{r.decision === 'go' ? t('go') : t('no-go')}</Tag>{r.comment && <div className={s.muted}>{r.comment}</div>}</Td><Td>{r.decidedByName}</Td><Td nowrap>{fmtDate(r.decidedAt, lang)}</Td></tr>)}</tbody>
            </Table>
          ) : <EmptyState>{t('No review yet')}</EmptyState>}
        </SectionCard>
      </div>
    );
  } else {
    const db = await getDb();
    const entries = await db.select().from(auditEntries).where(like(auditEntries.objectRef, `${d.ref}%`)).orderBy(desc(auditEntries.occurredAt)).limit(200);
    body = (
      <SectionCard title={t('Journal of the deal')} hint={t('Append-only.')}>
        {entries.length ? (
          <Table size={12.5}>
            <thead><tr><Th>{t('When')}</Th><Th>{t('Who')}</Th><Th>{t('Event')}</Th></tr></thead>
            <tbody>{entries.map((e) => <tr key={e.id}><Td nowrap>{fmtInstant(e.occurredAt, lang)}</Td><Td>{e.actorName}</Td><Td>{e.change}{e.reason ? <div className={s.muted}>{e.reason}</div> : null}</Td></tr>)}</tbody>
          </Table>
        ) : <EmptyState>{t('No entry')}</EmptyState>}
      </SectionCard>
    );
  }
  const sold = [...w.soldVersions.values()].find((v) => v[0].dealId === d.id)?.at(-1);

  return (
    <>
      <PageHeader
        screen="deal"
        title={`${d.ref} · ${customer.name}`}
        crumbs={['Commerce', 'Deals']}
        subtitle={<><DealTag state={d.state} t={t} /> <Tag tone="accent-2" size="sm">{t('case')} {d.saleCase}</Tag></>}
        primary={primary}
        actions={mayDeal ? <>
          {active && draft && <OfferForm dealRef={d.ref} letter={draft.letter} d={{ discount: draft.discountPct, validity: draft.validityDays, currency: draft.currency, assumptions: draft.assumptions, reservations: draft.reservations }} />}
          {active && <LineForm dealRef={d.ref} machines={machineOptions(w)} />}
          {active && <NewQuoteForm deals={[]} machines={machineOptions(w)} deal={d.ref} />}
          {active && <EditDealForm dealRef={d.ref} d={{ probability: d.probability, site: d.deliverySite, wished: d.wishedFor, need: d.need }} />}
          {active && <MemberForm dealRef={d.ref} people={people} />}
          {active && <CloseDealForm dealRef={d.ref} to="lost" />}
          {active && <CloseDealForm dealRef={d.ref} to="abandoned" />}
          {sold && <ActionLink href={`/sold/${sold.ref}`} label={`${t('Sold configuration')} ${sold.ref}`} />}
        </> : sold ? <ActionLink href={`/sold/${sold.ref}`} label={`${t('Sold configuration')} ${sold.ref}`} /> : undefined}
      />
      <div className={s.pipe}>{steps.map((st) => <span key={st} className={`${s.step} ${st === d.state ? s.stepOn : ''}`}>{t(DEAL_STATE_LABEL[st])}</span>)}</div>
      <Tabs base={`/deals/${d.ref}`} current={tab} tabs={[{ id: 'lines', label: t('Lines') }, { id: 'offers', label: t('Offers') }, { id: 'review', label: t('Offer review') }, { id: 'journal', label: t('Journal') }]} />
      {body}
      {!acc.costs && <Notice>{t('Budget and margin are reserved to the estimators and the directions (D-15).')}</Notice>}
    </>
  );
}
