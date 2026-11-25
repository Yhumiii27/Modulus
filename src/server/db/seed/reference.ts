// Reference data of every new database, demonstration or production: the common core of the quotation questionnaires (docs/spec/03
// § 2, D-10) published as version 1 (typed text, in French, shown as typed). Engineering changes it afterwards in the administration (a new draft version, then
// publish). The thresholds keep their defaults (src/domain/settings.ts) until the administration saves them. The catalogue
// itself is taken over from Keystone at delivery 2 (docs/spec/05 § 4).
import { eq } from 'drizzle-orm';
import type { AnswerType, QuestionTheme } from '@/domain/vocab';
import { questionnaires, questions } from '../schema';
import type { Tx } from '../types';

export interface QuestionSeed {
  theme: QuestionTheme;
  text: string;
  type: AnswerType;
  unit?: string;
  choices?: string;
  required?: boolean;
}

export const COMMON_QUESTIONS: readonly QuestionSeed[] = [
  { theme: 'need', text: 'Que doit faire l’option ?', type: 'text', required: true },
  { theme: 'need', text: 'Quel problème résout-elle ?', type: 'text', required: true },
  { theme: 'need', text: 'Que se passe-t-il aujourd’hui sans elle ?', type: 'text' },
  { theme: 'product', text: 'Produit traité et état', type: 'choice', choices: 'liquide · émulsion · poudre · pièces · autre', required: true },
  { theme: 'product', text: 'Cadence visée', type: 'number', unit: 't/h', required: true },
  { theme: 'performance', text: 'Précision attendue', type: 'number', unit: '%' },
  { theme: 'performance', text: 'Critères d’acceptation', type: 'text', required: true },
  { theme: 'environment', text: 'Intérieur ou extérieur', type: 'choice', choices: 'intérieur · extérieur · abri', required: true },
  { theme: 'environment', text: 'Températures mini / maxi', type: 'text', unit: '°C', required: true },
  { theme: 'environment', text: 'Zone ATEX', type: 'yes_no', required: true },
  { theme: 'environment', text: 'Utilités disponibles', type: 'text' },
  { theme: 'standards', text: 'Normes du client à respecter', type: 'text' },
  { theme: 'standards', text: 'Exigences HSE particulières', type: 'text' },
  { theme: 'interfaces', text: 'Machines amont / aval', type: 'text' },
  { theme: 'interfaces', text: 'Automatisme et protocole', type: 'choice', choices: 'Profinet · Modbus TCP · aucun · autre' },
  { theme: 'schedule', text: 'Date souhaitée', type: 'text', required: true },
  { theme: 'schedule', text: 'Budget envisagé', type: 'number', unit: 'k€' },
  { theme: 'schedule', text: 'Bloquant pour le CAPEX ?', type: 'yes_no' },
  { theme: 'attachments', text: 'Plans, photos, cahier des charges (Codex)', type: 'attachment' },
];

/** Creates a questionnaire version with its questions (as a draft, then published unless `draft`). */
export async function seedQuestionnaire(tx: Tx, o: { family: string; label: string; version: number; questions: readonly QuestionSeed[]; publishedAt?: Date; draft?: boolean }): Promise<string> {
  const [q] = await tx.insert(questionnaires).values({ family: o.family, label: o.label, version: o.version, state: 'draft' }).returning({ id: questionnaires.id });
  let n = 0;
  for (const x of o.questions)
    await tx.insert(questions).values({ questionnaireId: q.id, position: ++n, theme: x.theme, text: x.text, answerType: x.type, unit: x.unit ?? null, choices: x.choices ?? null, required: !!x.required });
  if (!o.draft) await tx.update(questionnaires).set({ state: 'published', publishedAt: o.publishedAt ?? new Date() }).where(eq(questionnaires.id, q.id));
  return q.id;
}

export async function seedReference(tx: Tx): Promise<void> {
  await seedQuestionnaire(tx, { family: 'common', label: 'Tronc commun', version: 1, questions: COMMON_QUESTIONS });
}
