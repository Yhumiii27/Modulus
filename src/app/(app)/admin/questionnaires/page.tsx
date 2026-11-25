// Standard questionnaires (docs/spec/03 § 2, D-10): the common core and one per machine type × option category, versioned like
// the catalogue; engineering changes them without development (a draft, then publish; requests in progress keep their version).
import Link from 'next/link';
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { EmptyState } from '@/components/app/EmptyState';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { can } from '@/domain/rights';
import { ANSWER_TYPE_LABEL, QUESTION_THEME_LABEL, type AnswerType, type QuestionTheme } from '@/domain/vocab';
import { DraftQuestionnaireForm, NewFamilyForm, PublishQuestionnaireButton, QuestionForm, RemoveQuestionButton, ToggleRequiredButton } from '@/features/commerce/forms';
import s from '@/features/commerce/pages.module.css';
import { VersionTag } from '@/features/commerce/tags';
import { Notice } from '@/features/commerce/view';
import { businessToday } from '@/server/clock';
import { loadWorld } from '@/server/dal/world';
import { getI18n, getViewer } from '@/server/session';

type SP = Record<string, string | string[] | undefined>;

export default async function QuestionnairesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [{ t }, viewer, today, sp] = await Promise.all([getI18n(), getViewer(), businessToday(), searchParams]);
  const w = await loadWorld(today);
  const families = [...new Set(w.rows.questionnaireRows.map((q) => q.family))].sort((a, b) => (a === 'common' ? -1 : b === 'common' ? 1 : a.localeCompare(b)));
  const family = typeof sp.family === 'string' && families.includes(sp.family) ? sp.family : families[0];
  const versions = w.rows.questionnaireRows.filter((q) => q.family === family).sort((a, b) => b.version - a.version);
  const shown = (sp.v === 'published' ? versions.find((v) => v.state === 'published') : versions[0]) ?? versions[0];
  const qs = shown ? w.questionsOf.get(shown.id) ?? [] : [];
  const canEdit = can(viewer.roles, 'questionnaires');
  const editable = canEdit && shown?.state === 'draft';
  return (
    <>
      <PageHeader
        screen="questionnaires"
        crumbs={['Administration']}
        primary={editable ? <PublishQuestionnaireButton id={shown!.id} /> : undefined}
        actions={canEdit ? <>
          <NewFamilyForm types={w.rows.types.map((x) => ({ value: x.code, label: x.code }))} />
          {shown && !versions.some((v) => v.state === 'draft') && <DraftQuestionnaireForm family={family} />}
          {editable && <QuestionForm questionnaireId={shown!.id} />}
        </> : undefined}
      />
      <div className={s.cfg}>
        <SectionCard title={shown ? `${shown.label} · v${shown.version}` : t('Questionnaire')} actions={shown ? <VersionTag state={shown.state} t={t} /> : undefined} scroll>
          {qs.length ? (
            <Table size={12.5}>
              <thead><tr><Th>{t('Theme')}</Th><Th>{t('Question')}</Th><Th>{t('Type')}</Th><Th>{t('Required')}</Th>{editable && <Th />}</tr></thead>
              <tbody>{qs.map((q) => (
                <tr key={q.id}>
                  <Td className={s.muted}>{t(QUESTION_THEME_LABEL[q.theme as QuestionTheme])}</Td>
                  <Td>{q.text}{q.choices && <div className={s.muted}>{q.choices}</div>}</Td>
                  <Td>{t(ANSWER_TYPE_LABEL[q.answerType as AnswerType])}{q.unit ? ` · ${q.unit}` : ''}</Td>
                  <Td>{q.required ? t('Yes') : t('No')}</Td>
                  {editable && <Td><ToggleRequiredButton id={q.id} required={q.required} /><RemoveQuestionButton id={q.id} /></Td>}
                </tr>
              ))}</tbody>
            </Table>
          ) : <EmptyState>{t('No question')}</EmptyState>}
        </SectionCard>
        <SectionCard title={t('Families')} hint={t('Common core + questions per type × category (D-10)')}>
          <Table size={12.5}>
            <thead><tr><Th>{t('Family')}</Th><Th>{t('Version')}</Th><Th align="right">{t('Questions')}</Th></tr></thead>
            <tbody>{families.map((f) => {
              const vs = w.rows.questionnaireRows.filter((q) => q.family === f).sort((a, b) => b.version - a.version);
              const top = vs[0];
              return <tr key={f}><Td><Link href={`/admin/questionnaires?family=${encodeURIComponent(f)}`} className={f === family ? s.ref : undefined}>{top.label}</Link></Td><Td>v{top.version} <VersionTag state={top.state} t={t} /></Td><Td numeric>{(w.questionsOf.get(top.id) ?? []).length}</Td></tr>;
            })}</tbody>
          </Table>
        </SectionCard>
      </div>
      {!canEdit && <Notice>{t('The questionnaires are changed by engineering, without development (D-10).')}</Notice>}
    </>
  );
}
