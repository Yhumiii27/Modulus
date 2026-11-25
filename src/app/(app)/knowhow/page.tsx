// The know-how map (docs/spec/04): standard machines × options (catalogue and specific), each cell a level computed — never
// entered — from the quotations, sales and project returns (D-12, adjustable); the catalogue's life: specific options to bring
// in, catalogue options unsold for long, sales without project return. Engineering adds notes and "to avoid" marks.
import Link from 'next/link';
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { EmptyState } from '@/components/app/EmptyState';
import { ActionLink } from '@/components/app/ActionForm';
import { Segmented } from '@norma/charte/ds/Segmented';
import { Table, Td } from '@norma/charte/ds/Table';
import { meanGap, proposeForCatalogue, unsoldSince } from '@/domain/knowhow';
import { can } from '@/domain/rights';
import { KNOWHOW_LEVELS, KNOWHOW_LEVEL_LABEL, OPTION_CATEGORIES, OPTION_CATEGORY_LABEL, type OptionCategory } from '@/domain/vocab';
import { KnowhowNoteForm } from '@/features/commerce/forms';
import s from '@/features/commerce/pages.module.css';
import { LevelTag } from '@/features/commerce/tags';
import { Notice } from '@/features/commerce/view';
import { addDaysIso } from '@/lib/dates';
import { fmtDate } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { loadWorld } from '@/server/dal/world';
import { getI18n, getViewer } from '@/server/session';

type SP = Record<string, string | string[] | undefined>;

export default async function KnowhowPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [{ t, lang }, viewer, today, sp] = await Promise.all([getI18n(), getViewer(), businessToday(), searchParams]);
  const w = await loadWorld(today);
  const cat = typeof sp.cat === 'string' && (OPTION_CATEGORIES as readonly string[]).includes(sp.cat) ? sp.cat : 'all';
  const cell = typeof sp.cell === 'string' ? sp.cell : null;
  const machines = [...w.rows.machineRows].filter((m) => w.published(m.id)).sort((a, b) => a.code.localeCompare(b.code));
  const cols = [...w.rows.optionRows].filter((o) => (cat === 'all' || o.category === cat) && (w.optionMachinesBy.get(o.id) ?? []).length)
    .sort((a, b) => OPTION_CATEGORIES.indexOf(a.category as OptionCategory) - OPTION_CATEGORIES.indexOf(b.category as OptionCategory) || a.code.localeCompare(b.code));
  const applies = (o: string, m: string) => (w.optionMachinesBy.get(o) ?? []).some((x) => x.machineId === m);
  const proposals = w.rows.optionRows.filter((o) => o.origin === 'specific' && proposeForCatalogue(w.optionTrace(o.id), w.settings));
  const unsold = w.rows.optionRows.filter((o) => o.origin === 'catalogue' && o.active && unsoldSince(w.lastSold.get(o.id) ?? null, o.createdAt.toISOString().slice(0, 10), today, w.settings));
  const noReturn = [...w.soldVersions.values()].map((v) => v.at(-1)!).filter((c) => !(w.feedbackOf.get(c.ref) ?? []).length && addDaysIso(c.orderedOn, c.leadWeeks * 7) < today);
  const [cm, co] = cell?.split('|') ?? [];
  const cellM = cm ? w.machineByCode.get(cm) : undefined;
  const cellO = co ? w.optionByCode.get(co) : undefined;
  const engineering = can(viewer.roles, 'knowhow');
  return (
    <>
      <PageHeader
        screen="knowhow"
        crumbs={['Catalogue']}
        primary={engineering ? <KnowhowNoteForm primary options={w.rows.optionRows.map((o) => ({ value: o.code, label: `${o.code} · ${o.label}` }))} machines={machines.map((m) => ({ value: m.code, label: m.code }))} /> : undefined}
        actions={<ActionLink href="/export/knowhow" label={t('Export (CSV)')} icon="download" download />}
        toolbar={<Segmented wrap value={cat} options={[{ value: 'all', label: t('All categories'), href: '/knowhow' }, ...OPTION_CATEGORIES.map((c) => ({ value: c, label: t(OPTION_CATEGORY_LABEL[c]), href: `/knowhow?cat=${c}` }))]} />}
      />
      <div className={s.legend}>{KNOWHOW_LEVELS.map((l) => <LevelTag key={l} level={l} t={t} />)}</div>
      <SectionCard title={t('Standard machines × options')} hint={t('Level computed (never entered) from the quotations, sales and project returns; open a cell for its evidence.')} scroll>
        <table className={s.kmap}>
          <thead><tr><th />{cols.map((o) => <th key={o.id}><small>{t(OPTION_CATEGORY_LABEL[o.category as OptionCategory])}{o.origin === 'specific' ? ` · ${t('spec.')}` : ''}</small>{o.label}</th>)}</tr></thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m.id}>
                <th>{m.code}</th>
                {cols.map((o) => {
                  if (!applies(o.id, m.id)) return <td key={o.id}><span className={`${s.cell} ${s['lv-na']}`} title={t('not applicable')}>—</span></td>;
                  const l = w.levelAt(m.id, o.id);
                  return <td key={o.id}><Link href={`/knowhow?${cat !== 'all' ? `cat=${cat}&` : ''}cell=${m.code}|${o.code}`} className={`${s.cell} ${s[`lv-${l}`]}`} title={`${m.code} × ${o.label} : ${t(KNOWHOW_LEVEL_LABEL[l])}`} scroll={false}>{t(KNOWHOW_LEVEL_LABEL[l])}</Link></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
      {cellM && cellO && (() => {
        const tr = w.traceOf(cellM.id, cellO.id);
        const notes = w.rows.noteRows.filter((n) => n.optionId === cellO.id && (n.machineId == null || n.machineId === cellM.id)).sort((a, b) => +b.createdAt - +a.createdAt);
        const g = meanGap(tr.deliveries);
        return (
          <SectionCard title={`${cellM.code} × ${cellO.code} · ${cellO.label}`} actions={<LevelTag level={w.levelAt(cellM.id, cellO.id)} t={t} />}>
            <Table size={12.5}>
              <tbody>
                <tr><Td>{t('In the catalogue')}</Td><Td>{tr.inCatalogue ? t('Yes') : t('No')}</Td></tr>
                <tr><Td>{t('Quoted (answers and sent offers)')}</Td><Td numeric>{tr.quoted}</Td></tr>
                <tr><Td>{t('Sold')}</Td><Td numeric>{tr.sold}</Td></tr>
                <tr><Td>{t('Delivered')}</Td><Td>{tr.deliveries.length ? tr.deliveries.map((d) => `${d.soldRef}${d.gap != null ? ` (${d.gap >= 0 ? '+' : ''}${Math.round(d.gap * 1000) / 10} %)` : ''}`).join(' · ') : '—'}</Td></tr>
                <tr><Td>{t('Average gap real / budget')}</Td><Td>{g == null ? '—' : `${g >= 0 ? '+' : ''}${Math.round(g * 1000) / 10} %`}</Td></tr>
              </tbody>
            </Table>
            {notes.map((n) => <Notice key={n.id} warn={n.kind === 'avoid'} title={n.kind === 'avoid' ? t('Marked “to avoid”') : n.kind === 'clear_avoid' ? t('Mark lifted') : t('Note')}>{n.body} · {n.authorName}, {fmtDate(n.createdAt, lang)}</Notice>)}
          </SectionCard>
        );
      })()}
      <div className={s.grid3}>
        <SectionCard title={t('To propose for the catalogue')}>
          {proposals.length ? proposals.map((o) => <p key={o.id}><strong>{o.label}</strong> ({o.code}) · {t('sold')} {w.optionTrace(o.id).sold} {t('times')}, {t('average gap')} {Math.round((meanGap(w.optionTrace(o.id).deliveries) ?? 0) * 1000) / 10} %</p>) : <EmptyState>{t('None')}</EmptyState>}
        </SectionCard>
        <SectionCard title={`${t('Not sold for')} ${w.settings.unsoldMonths} ${t('months')}`}>
          {unsold.length ? <Table size={12.5}><tbody>{unsold.map((o) => <tr key={o.id}><Td>{o.code}<div className={s.muted}>{o.label}</div></Td><Td>{w.lastSold.get(o.id) ? fmtDate(w.lastSold.get(o.id)!, lang) : t('never sold')}</Td></tr>)}</tbody></Table> : <EmptyState>{t('None')}</EmptyState>}
        </SectionCard>
        <SectionCard title={t('Sold without project return')}>
          {noReturn.length ? <Table size={12.5}><tbody>{noReturn.map((c) => <tr key={c.id}><Td><Link href={`/sold/${c.ref}`}>{c.ref}</Link></Td><Td>{c.keystoneProject ?? '—'}</Td></tr>)}</tbody></Table> : <EmptyState>{t('None')}</EmptyState>}
        </SectionCard>
      </div>
      <Notice>{t('Rules (D-12, adjustable)')} : {t('mastered')} = {t('in the catalogue and delivered at least')} {w.settings.masteredDeliveries} {t('times with a gap ≤')} {w.settings.masteredGapPct} % · {t('done before = delivered at least once')} · {t('to avoid = marked with a reason, a gap beyond')} {w.settings.avoidGapPct} % {t('or a major difficulty')}.</Notice>
    </>
  );
}
