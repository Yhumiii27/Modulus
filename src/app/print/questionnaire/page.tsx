// The questionnaire to send to a customer who has no access to the group's tools (D-17: cases 2 and 3): the common core and the
// family of the request, its answers already known, blank lines for the others. Printed or saved as PDF by the browser.
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { QUESTION_THEMES, QUESTION_THEME_LABEL } from '@/domain/vocab';
import s from '@/features/commerce/print.module.css';
import { businessToday } from '@/server/clock';
import { loadWorld } from '@/server/dal/world';
import { getI18n } from '@/server/session';

type SP = Record<string, string | string[] | undefined>;

export default async function QuestionnairePrint({ searchParams }: { searchParams: Promise<SP> }) {
  const [{ t }, today, sp] = await Promise.all([getI18n(), businessToday(), searchParams]);
  const w = await loadWorld(today);
  const q = typeof sp.request === 'string' ? w.rows.quoteRows.find((x) => x.ref === sp.request) ?? null : null;
  const common = q ? w.rows.questionnaireRows.find((x) => x.id === q.commonQuestionnaireId) : w.rows.questionnaireRows.find((x) => x.family === 'common' && x.state === 'published');
  const family = q?.familyQuestionnaireId ? w.rows.questionnaireRows.find((x) => x.id === q.familyQuestionnaireId) : undefined;
  const qs = [...(common ? w.questionsOf.get(common.id) ?? [] : []), ...(family ? w.questionsOf.get(family.id) ?? [] : [])];
  const answers = new Map((q ? w.answersOf.get(q.id) ?? [] : []).map((a) => [a.questionId, a.value]));
  return (
    <main className={s.page}>
      <div className={s.head}>
        <div><h1 className={s.title}>{t('Quotation questionnaire')}{q ? ` · ${q.ref}` : ''}</h1><div className={s.muted}>{q ? q.title : t('Blank questionnaire')} · {[common, family].filter(Boolean).map((x) => `${x!.label} v${x!.version}`).join(' + ')}</div></div>
        <div className={s.muted}>{t('* = required')}</div>
      </div>
      {QUESTION_THEMES.map((th) => {
        const list = qs.filter((x) => x.theme === th);
        if (!list.length) return null;
        return (
          <section key={th}>
            <h2 className={s.muted}>{t(QUESTION_THEME_LABEL[th])}</h2>
            <Table size={12.5}>
              <thead><tr><Th>{t('Question')}</Th><Th>{t('Answer')}</Th></tr></thead>
              <tbody>{list.map((x) => <tr key={x.id}><Td>{x.text}{x.required ? ' *' : ''}{x.unit ? ` (${x.unit})` : ''}{x.choices ? <div className={s.muted}>{x.choices}</div> : null}</Td><Td>{answers.get(x.id) ?? <div className={s.box} />}</Td></tr>)}</tbody>
            </Table>
          </section>
        );
      })}
    </main>
  );
}
