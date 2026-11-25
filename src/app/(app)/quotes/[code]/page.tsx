// A quotation request (docs/spec/03): the questionnaire and its answers (incomplete while a required answer is missing), the
// qualification by engineering with the closest cases (docs/spec/04 § 3), the estimate (budget per post — estimators and
// directions only —, sale price, lead time, BOM delta, assumptions), the answer and the thread. Due date in working days from
// the target of its class (D-11).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { KeyValueList } from '@/components/app/KeyValueList';
import { EmptyState } from '@/components/app/EmptyState';
import { ActionLink } from '@/components/app/ActionForm';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { closestCases, dueOn, lateDays } from '@/domain/quotes';
import { marginRate } from '@/domain/pricing';
import { meanGap } from '@/domain/knowhow';
import { can, canSeeCosts } from '@/domain/rights';
import { ESTIMATE_CLASS_LABEL, FEASIBILITY_LABEL, OPTION_CATEGORY_LABEL, QUESTION_THEMES, QUESTION_THEME_LABEL, isOpenQuote, type EstimateClass, type Feasibility, type KnowhowLevel, type OptionCategory } from '@/domain/vocab';
import { AnswerQuoteButton, AnswersForm, CancelQuoteForm, EstimateForm, MessageForm, QualifyForm } from '@/features/commerce/forms';
import { quoteMissing, quoteQuestions } from '@/features/commerce/options';
import s from '@/features/commerce/pages.module.css';
import { LateTag, LevelTag, QuoteTag } from '@/features/commerce/tags';
import { Notice, Tabs, pct } from '@/features/commerce/view';
import { fmtDate, fmtInstant, fmtKeur } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { dealAccess, loadWorld } from '@/server/dal/world';
import { getI18n, getViewer } from '@/server/session';

type SP = Record<string, string | string[] | undefined>;

export default async function QuotePage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<SP> }) {
  const [{ t, lang }, viewer, today, { code }, sp] = await Promise.all([getI18n(), getViewer(), businessToday(), params, searchParams]);
  const w = await loadWorld(today);
  const q = w.rows.quoteRows.find((x) => x.ref === code);
  if (!q) notFound();
  const tab = ['qualification', 'estimate', 'thread'].includes(String(sp.tab)) ? String(sp.tab) : 'questionnaire';
  const deal = q.dealId ? w.dealBy.get(q.dealId) ?? null : null;
  const machine = w.machineBy.get(q.machineId)!;
  const questions = quoteQuestions(w, q);
  const answers = new Map((w.answersOf.get(q.id) ?? []).map((a) => [a.questionId, a.value]));
  const missing = quoteMissing(w, q);
  const open = isOpenQuote(q.state);
  const due = dueOn(q.receivedOn, q.targetDays);
  const late = open ? lateDays(q.receivedOn, q.targetDays, today) : 0;
  const costs = canSeeCosts(viewer.roles) && (!deal || dealAccess(w, viewer, deal.id).prices);
  const est = w.estimateBy.get(q.id) ?? null;
  const deltas = w.rows.quoteDeltaRows.filter((d) => d.requestId === q.id);
  const common = w.rows.questionnaireRows.find((x) => x.id === q.commonQuestionnaireId)!;
  const family = q.familyQuestionnaireId ? w.rows.questionnaireRows.find((x) => x.id === q.familyQuestionnaireId) ?? null : null;
  const mayAnswer = can(viewer.roles, 'quote_request') && q.state === 'qualification' && (!deal || dealAccess(w, viewer, deal.id).sheet);
  const specific = w.rows.optionRows.find((o) => o.quoteRequestId === q.id) ?? null;

  const block = (qs: typeof questions) => QUESTION_THEMES.map((th) => {
    const list = qs.filter((x) => x.theme === th);
    if (!list.length) return null;
    return (
      <div key={th}>
        <div className={s.theme}>{t(QUESTION_THEME_LABEL[th])}</div>
        {list.map((x) => {
          const a = answers.get(x.id);
          return (
            <div key={x.id} className={s.qa}>
              <span>{x.text}{x.required ? ' *' : ''} <span className={s.muted}>{x.unit ? `(${x.unit})` : ''}</span></span>
              <span className={a ? s.typed : `${s.muted} ${x.required ? s.missing : ''}`}>{a ?? (x.required ? t('answer missing') : t('no answer'))}</span>
            </div>
          );
        })}
      </div>
    );
  });

  let body;
  if (tab === 'questionnaire') {
    body = (
      <>
        {missing.length > 0 && (
          <div className={s.errbox}><strong>{t('Incomplete request')} : {missing.length} {t('required answers missing')}</strong>
            <ul>{missing.map((x) => <li key={x.id}>{t(QUESTION_THEME_LABEL[x.theme as never])} · {x.text}</li>)}</ul></div>
        )}
        <div className={s.grid2}>
          <SectionCard title={`${common.label} · v${common.version}`} hint={t('Questions common to every family; * = required')}>{block(questions.filter((x) => x.questionnaireId === common.id))}</SectionCard>
          <SectionCard title={family ? `${family.label} · v${family.version}` : t('No questionnaire for this family')} hint={t('Questions of the machine type and option category (D-10)')}>
            {family ? block(questions.filter((x) => x.questionnaireId === family.id)) : <EmptyState>{t('Engineering can create it in the administration')}</EmptyState>}
          </SectionCard>
        </div>
        {deal && deal.saleCase !== 1
          ? <Notice>{t('Case')} {deal.saleCase} : {t('the customer has no access to the group’s tools. Modulus prints the questionnaire to send them; the account manager (or the intermediary subsidiary) reports the answers (D-17).')}</Notice>
          : <Notice>{t('Case 1: request of an Arche CAPEX; Arche keeps the number and reads the answer through the view modulus.pub_cotations.')}</Notice>}
      </>
    );
  } else if (tab === 'qualification') {
    const cases = closestCases({ title: q.title, category: q.category, machine: machine.code }, w.rows.optionRows.filter((o) => o.id !== specific?.id).map((o) => ({
      code: o.code, label: o.label, category: o.category, machine: w.optionMachinesBy.get(o.id)?.map((x) => w.machineBy.get(x.machineId)?.code).includes(machine.code) ? machine.code : null, id: o.id, origin: o.origin,
    })));
    body = (
      <div className={s.grid2}>
        <SectionCard title={t('Qualification by engineering')} hint={t('feasible / to study / refused (reason)')}>
          {q.feasibility ? (
            <KeyValueList items={[
              { k: t('Decision'), v: t(FEASIBILITY_LABEL[q.feasibility as Feasibility]) },
              { k: t('Know-how level proposed'), v: q.proposedLevel ? <LevelTag level={q.proposedLevel as KnowhowLevel} t={t} /> : '—' },
              { k: t('Qualified by'), v: `${q.qualifiedByName} · ${fmtDate(q.qualifiedOn, lang)}` },
              { k: t('Reason / remark'), v: <span className={s.typed}>{q.qualificationNote ?? '—'}</span> },
            ]} />
          ) : <EmptyState>{missing.length ? t('Waiting for the required answers') : t('Waiting for engineering')}</EmptyState>}
        </SectionCard>
        <SectionCard title={t('Closest cases')} hint={t('Same category, words of the need, same machine — with their real cost')}>
          {cases.length ? (
            <Table size={12.5}>
              <thead><tr><Th>{t('Reference')}</Th><Th>{t('Level')}</Th><Th align="right">{t('Real / budget')}</Th></tr></thead>
              <tbody>{cases.map((c) => {
                const tr = w.optionTrace(c.id);
                const g = meanGap(tr.deliveries);
                return <tr key={c.code}><Td>{c.code}<div className={s.muted}>{c.label}</div></Td><Td><LevelTag level={w.optionLevel(c.id)} t={t} /></Td><Td numeric>{costs ? (g == null ? '—' : `${g >= 0 ? '+' : ''}${Math.round(g * 1000) / 10} %`) : t('hidden')}</Td></tr>;
              })}</tbody>
            </Table>
          ) : <EmptyState>{t('No close case')}</EmptyState>}
        </SectionCard>
      </div>
    );
  } else if (tab === 'estimate') {
    const budget = est ? w.estimateBudget(est) : null;
    body = (
      <div className={s.grid2}>
        <SectionCard title={t('BOM delta')}>
          {deltas.length ? (
            <Table size={12.5}>
              <thead><tr><Th>{t('Article')}</Th><Th>{t('Designation')}</Th><Th align="right">{t('Qty')}</Th></tr></thead>
              <tbody>{deltas.map((d) => <tr key={d.id}><Td>{d.article}</Td><Td>{d.designation}</Td><Td numeric>{d.quantity} {d.unit}</Td></tr>)}</tbody>
            </Table>
          ) : <EmptyState>{t('No BOM delta yet')}</EmptyState>}
        </SectionCard>
        <SectionCard title={t('Price and lead time')} hint={est ? `${t('Estimator')} : ${est.estimatedByName}` : undefined}>
          {est ? (
            <KeyValueList items={[
              ...(costs ? [{ k: t('Budget per post'), v: `${t('material')} ${fmtKeur(est.materialKeur, lang)} · ${t('subcontracting')} ${fmtKeur(est.subcontractingKeur, lang)} · ${t('engineering')} ${est.engineeringHours} h · ${t('workshop')} ${est.workshopHours} h · ${t('site')} ${est.siteHours} h · ${t('expenses')} ${fmtKeur(est.expensesKeur, lang)} → ${fmtKeur(budget, lang)}` }] : []),
              { k: t('Sale price'), v: <>{fmtKeur(est.saleKeur, lang)}{costs && <span className={s.muted}> · {t('margin')} {pct(marginRate(est.saleKeur, budget), lang)}</span>}</> },
              { k: t('Extra lead time'), v: `+${est.extraWeeks} ${t('weeks')}` },
              { k: t('Estimate class'), v: t(ESTIMATE_CLASS_LABEL[q.estimateClass as EstimateClass]) },
              { k: t('Validity'), v: `${est.validityDays} ${t('days')}` },
              { k: t('Assumptions'), v: <span className={s.typed}>{est.assumptions ?? '—'}</span> },
            ]} />
          ) : <EmptyState>{t('No estimate yet')}</EmptyState>}
          {specific && <Notice>{t('Answer published')} : {specific.code} — {t('added to the deal’s line of the machine')}.</Notice>}
        </SectionCard>
      </div>
    );
  } else {
    const messages = w.messagesOf.get(q.id) ?? [];
    body = (
      <SectionCard title={t('Thread of the request')} hint={t('Questions back to the requester; Arche reads the answer published.')} actions={(['quote_request', 'qualify', 'estimate'] as const).some((r) => can(viewer.roles, r)) ? <MessageForm quoteRef={q.ref} /> : undefined}>
        <div className={s.thread}>
          {messages.map((m) => (
            <div key={m.id} className={s.msg}>
              <span className={s.avatar}>{m.authorName.split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase()}</span>
              <div><div className={s.msgHead}>{m.authorName} · {fmtInstant(m.createdAt, lang)}</div><div className={s.typed}>{m.body}</div></div>
            </div>
          ))}
          {!messages.length && <EmptyState>{t('No message')}</EmptyState>}
        </div>
      </SectionCard>
    );
  }

  const primary = mayAnswer ? (missing.length ? <AnswersForm quoteRef={q.ref} primary fields={questions.map((x) => ({ id: x.id, text: x.text, theme: x.theme, type: x.answerType, unit: x.unit, choices: x.choices, required: x.required, value: answers.get(x.id) ?? '' }))} /> : can(viewer.roles, 'qualify') ? <QualifyForm quoteRef={q.ref} primary /> : undefined)
    : q.state === 'qualification' && can(viewer.roles, 'qualify') ? <QualifyForm quoteRef={q.ref} primary />
    : q.state === 'estimating' && can(viewer.roles, 'estimate') ? (est ? <AnswerQuoteButton quoteRef={q.ref} /> : undefined)
    : undefined;
  return (
    <>
      <PageHeader
        screen="quote"
        title={`${q.ref} · ${q.title}`}
        crumbs={['Commerce', 'Quotation requests']}
        subtitle={<QuoteTag state={q.state} incomplete={missing.length > 0} t={t} />}
        primary={primary}
        actions={<>
          {mayAnswer && !missing.length && <AnswersForm quoteRef={q.ref} fields={questions.map((x) => ({ id: x.id, text: x.text, theme: x.theme, type: x.answerType, unit: x.unit, choices: x.choices, required: x.required, value: answers.get(x.id) ?? '' }))} />}
          {q.state === 'estimating' && can(viewer.roles, 'estimate') && <EstimateForm quoteRef={q.ref} primary={!est} d={{
            material: est?.materialKeur ?? 0, subcontracting: est?.subcontractingKeur ?? 0, engineeringHours: est?.engineeringHours ?? 0, workshopHours: est?.workshopHours ?? 0, siteHours: est?.siteHours ?? 0,
            expenses: est?.expensesKeur ?? 0, sale: est?.saleKeur ?? null, weeks: est?.extraWeeks ?? 0, validity: est?.validityDays ?? w.settings.quoteValidityDays, assumptions: est?.assumptions ?? null,
            deltas: deltas.map((d) => `${d.article}; ${d.designation}; ${d.quantity}; ${d.unit}`).join('\n'),
          }} />}
          {open && can(viewer.roles, 'quote_request') && <CancelQuoteForm quoteRef={q.ref} />}
          <ActionLink href={`/print/questionnaire?request=${q.ref}`} label={t('Questionnaire for the customer (print)')} newTab />
        </>}
      />
      <Notice warn={late > 0 || (open && due === today)}>
        {t('Class')} <strong>{t(ESTIMATE_CLASS_LABEL[q.estimateClass as EstimateClass])}</strong> · {t('target')} <strong>{q.targetDays} {t('working days')}</strong> (D-11) · {t('received on')} {fmtDate(q.receivedOn, lang)} · {t('due')} <strong>{fmtDate(due, lang)}</strong> <LateTag days={late} t={t} /> · {machine.code} · {t(OPTION_CATEGORY_LABEL[q.category as OptionCategory])} · {q.origin === 'arche' ? `Arche · ${q.capexNeed}` : t('Deal')} {deal && <Link href={`/deals/${deal.ref}`}>{deal.ref}</Link>}
      </Notice>
      <Tabs base={`/quotes/${q.ref}`} current={tab} tabs={[{ id: 'questionnaire', label: t('Questionnaire') }, { id: 'qualification', label: t('Qualification') }, { id: 'estimate', label: t('Estimate') }, { id: 'thread', label: t('Answer and thread') }]} />
      {body}
    </>
  );
}
