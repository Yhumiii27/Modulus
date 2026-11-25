// The configurator (docs/spec/01 § 2): a published machine version, a quantity and the catalogue options, with the rules applied
// on each choice (mandatory if, requires, excludes, one of — src/domain/configurator.ts), the price computed from the list in
// force, the lead time and the BOM computed from the deltas. Only published versions are configured; a deal keeps its version.
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { EmptyState } from '@/components/app/EmptyState';
import { ActionLink } from '@/components/app/ActionForm';
import { Field, Input, Select } from '@norma/charte/ds/Field';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { Tag } from '@norma/charte/ds/Tag';
import { Info, LockSimple, Prohibit } from '@phosphor-icons/react/dist/ssr';
import { computeBom } from '@/domain/bom';
import { marginRate } from '@/domain/pricing';
import { can, canSeeCosts } from '@/domain/rights';
import { DELTA_OP_LABEL, OPTION_CATEGORIES, OPTION_CATEGORY_LABEL, RULE_KIND_LABEL } from '@/domain/vocab';
import { AutoSubmitForm } from '@/features/commerce/auto-submit';
import { NewQuoteForm, SaveConfigurationForm } from '@/features/commerce/forms';
import { dealOptions, machineOptions } from '@/features/commerce/options';
import s from '@/features/commerce/pages.module.css';
import { LevelTag } from '@/features/commerce/tags';
import { Notice, pct } from '@/features/commerce/view';
import { fmtDate, fmtKeur } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { dealAccess, loadWorld } from '@/server/dal/world';
import { getI18n, getViewer } from '@/server/session';

type SP = Record<string, string | string[] | undefined>;
const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export default async function ConfiguratorPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [{ t, lang }, viewer, today, sp] = await Promise.all([getI18n(), getViewer(), businessToday(), searchParams]);
  const w = await loadWorld(today);
  const machines = machineOptions(w);
  // A line of a deal being configured: its machine and options as defaults.
  const deal = typeof sp.deal === 'string' ? w.rows.dealRows.find((d) => d.ref === sp.deal && dealAccess(w, viewer, d.id).sheet) ?? null : null;
  const lineNo = deal && typeof sp.line === 'string' ? Number(sp.line) : null;
  const line = deal && lineNo ? (w.linesOf.get(deal.id) ?? []).find((l) => l.number === lineNo) ?? null : null;
  const lineMachine = line ? w.machineBy.get(w.versionBy.get(line.machineVersionId)!.machineId)!.code : null;
  const code = typeof sp.machine === 'string' ? sp.machine : lineMachine ?? machines[0]?.value;
  const m = code ? w.machineByCode.get(code) : undefined;
  const version = m ? (line && lineMachine === m.code ? w.versionBy.get(line.machineVersionId)! : w.published(m.id)) : null;
  if (!m || !version) {
    return (<><PageHeader screen="configurator" crumbs={['Commerce']} /><EmptyState>{t('No published machine to configure')}</EmptyState></>);
  }
  const qty = Math.min(50, Math.max(1, Number(sp.qty) || line?.quantity || 1));
  const initial = sp.machine === undefined && line ? (w.lineOptionsOf.get(line.id) ?? []).map((x) => x.optionId) : many(sp.o).map((c) => w.optionByCode.get(c)?.id).filter((x): x is string => !!x);
  const avail = w.availableOptions(m.id, deal?.id);
  const ev = w.evaluateLine(version.id, deal?.id ?? null, initial);
  const chosen = avail.filter((o) => ev.selected.includes(o.id));
  const costs = canSeeCosts(viewer.roles);
  const machineSale = w.saleOfMachine(m.id);
  const machineBudget = w.budgetOfVersion(version.id).entered;
  const sale = (machineSale ?? 0) + chosen.reduce((n, o) => n + (w.saleOfOption(o.id) ?? 0), 0);
  const budget = (machineBudget ?? 0) + chosen.reduce((n, o) => n + (w.budgetOfOption(o.id).entered ?? 0), 0);
  const lead = version.leadWeeks + chosen.reduce((x, o) => Math.max(x, o.extraWeeks), 0);
  const deltas = chosen.flatMap((o) => w.deltasOfOption(o.id));
  const bom = computeBom(w.bomOfVersion(version.id), deltas, qty);
  const mayDeal = can(viewer.roles, 'deal');
  const optionCodes = chosen.map((o) => o.code);
  return (
    <>
      <PageHeader
        screen="configurator"
        crumbs={['Commerce']}
        subtitle={deal ? <>{deal.ref}{line ? ` · ${t('line')} ${line.number}` : ''}</> : undefined}
        primary={mayDeal ? <SaveConfigurationForm machine={m.code} quantity={qty} options={optionCodes} deals={dealOptions(w, viewer)} dealRef={deal?.ref} line={line?.number} /> : undefined}
        actions={<>
          {can(viewer.roles, 'quote_request') && <NewQuoteForm deals={dealOptions(w, viewer)} machines={machines} />}
          <ActionLink href={deal ? `/configurator?deal=${deal.ref}${line ? `&line=${line.number}` : ''}` : '/configurator'} label={t('Reset')} />
        </>}
      />
      <div className={s.cfg}>
        <AutoSubmitForm className={s.stack}>
          {deal && <input type="hidden" name="deal" value={deal.ref} />}
          {line && <input type="hidden" name="line" value={line.number} />}
          <SectionCard title={t('Machine')} hint={t('Only published versions are configured; a deal keeps the version chosen.')}>
            <div className={s.toolbar}>
              <Field label={t('Standard machine')}><Select name="machine" defaultValue={m.code} options={machines} /></Field>
              <Field label={t('Version')}><Input value={`v${version.version} · ${t(version.state === 'published' ? 'published, frozen' : 'retired')}`} readOnly /></Field>
              <Field label={t('Quantity')}><Input name="qty" type="number" min={1} max={50} defaultValue={qty} /></Field>
            </div>
          </SectionCard>
          <SectionCard title={t('Options of the catalogue')} hint={t('Rules applied at each choice: excludes, requires, mandatory if, one of.')}>
            {OPTION_CATEGORIES.map((cat) => {
              const list = avail.filter((o) => o.category === cat);
              if (!list.length) return null;
              return (
                <div key={cat} className={s.optGroup}>
                  <div className={s.optHead}>{t(OPTION_CATEGORY_LABEL[cat])}</div>
                  {list.map((o) => {
                    const st = ev.state[o.id] ?? {};
                    const on = ev.selected.includes(o.id);
                    const saleO = w.saleOfOption(o.id);
                    return (
                      <label key={o.id} className={`${s.optRow} ${on ? s.optOn : ''} ${st.disabled ? s.optDis : ''}`}>
                        {st.locked ? <><LockSimple aria-hidden /><input type="hidden" name="o" value={o.code} /></> : <input type="checkbox" name="o" value={o.code} defaultChecked={on} disabled={st.disabled} />}
                        <span>
                          <strong>{o.label}</strong> <span className={s.muted}>· {o.code}{o.extraWeeks ? ` · +${o.extraWeeks} ${t('wk')}` : ''}</span> <LevelTag level={w.levelAt(m.id, o.id)} t={t} /> {o.origin === 'specific' && <Tag tone="outline" size="sm">{t('specific')}</Tag>}
                          {st.because && (
                            <span className={s.why}>
                              {st.disabled ? <Prohibit aria-hidden /> : st.locked ? <LockSimple aria-hidden /> : <Info aria-hidden />} {t(RULE_KIND_LABEL[st.because.kind])}{st.because.by ? ` · ${st.because.by}` : ''} — {st.because.explanation}
                            </span>
                          )}
                        </span>
                        <span className={s.ref}>+{fmtKeur(saleO, lang)}{costs && <span className={s.why}>{t('budget')} {fmtKeur(w.budgetOfOption(o.id).entered, lang)}</span>}</span>
                      </label>
                    );
                  })}
                </div>
              );
            })}
            <noscript><button type="submit">{t('Apply')}</button></noscript>
          </SectionCard>
        </AutoSubmitForm>
        <div className={s.stack}>
          <SectionCard title={t('Price computed')}>
            <div className={s.total}><span>{m.code} v{version.version}</span><span className={s.ref}>{fmtKeur(machineSale, lang)}</span></div>
            {chosen.map((o) => <div key={o.id} className={s.total}><span className={s.muted}>{o.label}</span><span className={s.ref}>+{fmtKeur(w.saleOfOption(o.id), lang)}</span></div>)}
            <div className={`${s.total} ${s.totalBig}`}><span>{t('Unit sale price')}</span><span className={s.ref}>{fmtKeur(sale, lang)}</span></div>
            {qty > 1 && <div className={s.total}><span>× {qty} {t('machines')}</span><strong className={s.ref}>{fmtKeur(sale * qty, lang)}</strong></div>}
            {costs ? (
              <>
                <div className={s.total}><span>{t('Unit budget')}</span><span className={s.ref}>{fmtKeur(budget, lang)}</span></div>
                <div className={s.total}><span>{t('Margin')}</span><span className={s.ref}>{fmtKeur(sale - budget, lang)} · {pct(marginRate(sale, budget), lang)}</span></div>
              </>
            ) : <p className={s.muted}>{t('Budget and margin hidden for your profile (D-15).')}</p>}
            <div className={s.total}><span>{t('Lead time')}</span><span className={s.ref}>{lead} {t('weeks')}</span></div>
            <p className={s.muted}>{t('Standard lead time + the longest extra lead time of the options')} · {w.listNow ? `${w.listNow.code}, ${t('valid until')} ${fmtDate(w.listNow.validTo, lang)}` : t('no price list in force')}</p>
            {ev.violations.map((x) => <Notice key={x.ruleId} warn title={t('Rule broken')}>{x.option} — {x.target} · {x.explanation}</Notice>)}
          </SectionCard>
          <SectionCard title={t('BOM computed')} hint={`${t('Base BOM')} ${m.code} (${w.bomOfVersion(version.id).length} ${t('lines')}) + ${t('deltas of the options')} · ${t('frozen only into a sent offer')}`}>
            {deltas.length ? (
              <Table size={12.5}>
                <thead><tr><Th>{t('Option')}</Th><Th>{t('Op.')}</Th><Th>{t('Article')}</Th><Th align="right">{t('Qty')}</Th></tr></thead>
                <tbody>{deltas.map((d, i) => <tr key={`${d.option}${i}`}><Td>{d.option}</Td><Td>{t(DELTA_OP_LABEL[d.op])}</Td><Td>{d.article}<div className={s.muted}>{d.designation}{d.replaces ? ` · ${t('replaces')} ${d.replaces}` : ''}</div></Td><Td numeric>{d.quantity != null ? `${d.quantity * qty} ${d.unit}` : '—'}</Td></tr>)}</tbody>
              </Table>
            ) : <EmptyState>{t('No option: base BOM only.')}</EmptyState>}
            {bom.errors.length > 0 && <Notice warn>{t('Delta without its line in the base BOM')} : {bom.errors.join(', ')}</Notice>}
          </SectionCard>
        </div>
      </div>
    </>
  );
}
