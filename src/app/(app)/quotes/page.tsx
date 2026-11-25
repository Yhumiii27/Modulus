// Quotation requests (docs/spec/03): open, late or due, all; each with its class and target answer time (D-11, adjustable), its
// origin (a deal, or Arche for a CAPEX need), its state and who follows it.
import Link from 'next/link';
import { PageHeader } from '@/components/app/shell/page-header';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { EmptyState } from '@/components/app/EmptyState';
import { ActionLink } from '@/components/app/ActionForm';
import { Segmented } from '@norma/charte/ds/Segmented';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { answerDays, dueOn, lateDays } from '@/domain/quotes';
import { can } from '@/domain/rights';
import { ESTIMATE_CLASS_LABEL, OPTION_CATEGORY_LABEL, isOpenQuote, type EstimateClass, type OptionCategory } from '@/domain/vocab';
import { NewQuoteForm } from '@/features/commerce/forms';
import { dealOptions, machineOptions, quoteMissing } from '@/features/commerce/options';
import s from '@/features/commerce/pages.module.css';
import { LateTag, QuoteTag } from '@/features/commerce/tags';
import { fmtDate, fmtNum } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { loadWorld } from '@/server/dal/world';
import type { QuoteRow } from '@/server/commerce/world';
import { getI18n, getViewer } from '@/server/session';

type SP = Record<string, string | string[] | undefined>;

export default async function QuotesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [{ t, lang }, viewer, today, sp] = await Promise.all([getI18n(), getViewer(), businessToday(), searchParams]);
  const w = await loadWorld(today);
  const filter = sp.filter === 'late' || sp.filter === 'all' ? sp.filter : 'open';
  const all = [...w.rows.quoteRows].sort((a, b) => b.ref.localeCompare(a.ref));
  const lateOrDue = (q: QuoteRow) => isOpenQuote(q.state) && (lateDays(q.receivedOn, q.targetDays, today) > 0 || dueOn(q.receivedOn, q.targetDays) === today);
  const of = (f: string) => all.filter((q) => (f === 'open' ? isOpenQuote(q.state) : f === 'late' ? lateOrDue(q) : true));
  const list = of(filter);
  const answered = all.filter((q) => q.answeredOn);
  const avg = answered.length ? answered.reduce((n, q) => n + answerDays(q.receivedOn, q.answeredOn!), 0) / answered.length : null;
  const st = w.settings.targetDays;
  return (
    <>
      <PageHeader
        screen="quotes"
        crumbs={['Commerce']}
        primary={can(viewer.roles, 'quote_request') ? <NewQuoteForm deals={dealOptions(w, viewer)} machines={machineOptions(w)} primary /> : undefined}
        actions={<ActionLink href="/print/questionnaire" label={t('Blank questionnaire (print)')} newTab />}
        toolbar={<Segmented value={filter} options={[
          { value: 'open', label: t('Open'), count: of('open').length, href: '/quotes' },
          { value: 'late', label: t('Late or due'), count: of('late').length, href: '/quotes?filter=late' },
          { value: 'all', label: t('All'), count: all.length, href: '/quotes?filter=all' },
        ]} />}
      />
      <KpiGrid>
        <KpiTile label={t('Open')} value={of('open').length} sub={t('qualification or estimating')} />
        <KpiTile label={t('Late')} value={all.filter((q) => isOpenQuote(q.state) && lateDays(q.receivedOn, q.targetDays, today) > 0).length} tone="alert" sub={t('beyond the target of their class')} />
        <KpiTile label={t('From Arche')} value={all.filter((q) => q.origin === 'arche').length} sub={t('machine needs of CAPEX, case 1')} />
        <KpiTile label={t('Average time')} value={avg == null ? '—' : `${fmtNum(avg, lang)} ${t('wd')}`} sub={`${t('targets')} : ${st.indicative} / ${st.quote} / ${st.firm} ${t('wd')} (D-11)`} />
      </KpiGrid>
      <SectionCard scroll>
        {list.length ? (
          <Table size={12.5}>
            <thead><tr><Th>{t('Request')}</Th><Th>{t('Machine')}</Th><Th>{t('Origin')}</Th><Th>{t('Class · target')}</Th><Th>{t('State')}</Th><Th>{t('Due')}</Th><Th>{t('Followed by')}</Th></tr></thead>
            <tbody>
              {list.map((q) => {
                const d = q.dealId ? w.dealBy.get(q.dealId) : null;
                const missing = q.state === 'qualification' ? quoteMissing(w, q).length : 0;
                const due = dueOn(q.receivedOn, q.targetDays);
                return (
                  <tr key={q.id}>
                    <Td><Link href={`/quotes/${q.ref}`} className={s.ref}>{q.ref}</Link><div className={s.muted}>{q.title}</div></Td>
                    <Td>{w.machineBy.get(q.machineId)?.code}<div className={s.muted}>{t(OPTION_CATEGORY_LABEL[q.category as OptionCategory])}</div></Td>
                    <Td>{q.origin === 'arche' ? `Arche · ${q.capexNeed}` : t('Deal')}{d && <div className={s.muted}>{d.ref}</div>}</Td>
                    <Td nowrap>{t(ESTIMATE_CLASS_LABEL[q.estimateClass as EstimateClass])} · {q.targetDays} {t('wd')}</Td>
                    <Td><QuoteTag state={q.state} incomplete={missing > 0} t={t} />{missing > 0 && <div className={s.muted}>{missing} {t('required answers missing')}</div>}</Td>
                    <Td nowrap>{isOpenQuote(q.state) ? (due === today ? t('today') : fmtDate(due, lang)) : q.answeredOn ? fmtDate(q.answeredOn, lang) : '—'} {isOpenQuote(q.state) && <LateTag days={lateDays(q.receivedOn, q.targetDays, today)} t={t} />}</Td>
                    <Td>{q.followedByName}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : <EmptyState>{t('No quotation request')}</EmptyState>}
      </SectionCard>
    </>
  );
}
