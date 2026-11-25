// Quotation requests (docs/spec/03): the answers still missing (a request is incomplete while a required question has no
// answer), the due date in working days from the target of its class (D-11), the lateness, the closest cases. Pure.
import { addWorkingDays, workingDaysBetween } from './working-days';

export interface QuestionLite {
  id: string;
  text: string;
  required: boolean;
  theme: string;
}

export const missingAnswers = (qs: readonly QuestionLite[], answers: ReadonlyMap<string, string>) => qs.filter((q) => q.required && !answers.get(q.id)?.trim());

export const dueOn = (receivedOn: string, targetDays: number) => addWorkingDays(receivedOn, targetDays);

/** Working days late on `today` (0 when on time); open requests only. */
export const lateDays = (receivedOn: string, targetDays: number, today: string) => Math.max(0, workingDaysBetween(dueOn(receivedOn, targetDays), today));

/** Working days taken to answer. */
export const answerDays = (receivedOn: string, answeredOn: string) => workingDaysBetween(receivedOn, answeredOn);

export interface CaseLite {
  code: string;
  label: string;
  category: string;
  machine: string | null;
}

const words = (s: string) => new Set(s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 3));

/** Closest cases (docs/spec/04 § 3): same category first, then words of the need in common, then same machine. */
export function closestCases<T extends CaseLite>(target: { title: string; category: string; machine: string }, cases: readonly T[], limit = 4): T[] {
  const tw = words(target.title);
  return cases
    .map((c) => ({ c, score: (c.category === target.category ? 3 : 0) + [...words(c.label)].filter((w) => tw.has(w)).length * 2 + (c.machine === target.machine ? 1 : 0) }))
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score || a.c.code.localeCompare(b.c.code))
    .slice(0, limit)
    .map((x) => x.c);
}
