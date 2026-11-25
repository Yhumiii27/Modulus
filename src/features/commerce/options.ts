// Choices of the forms, from the loaded data (pure adapters; typed names shown as typed).
import { canSeeDealPrices } from '@/domain/rights';
import { isActiveDeal } from '@/domain/vocab';
import { missingAnswers } from '@/domain/quotes';
import type { ModulusWorld, QuoteRow } from '@/server/commerce/world';
import type { Viewer } from '@/server/viewer';

export const customerOptions = (w: ModulusWorld) => [...w.rows.customerRows].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.id, label: `${c.name} (${c.country})` }));
export const subsidiaryOptions = (w: ModulusWorld) => w.rows.customerRows.filter((c) => c.kind === 'subsidiary').sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.id, label: c.name }));

/** Machines with a published version (only those are configured). */
export const machineOptions = (w: ModulusWorld) =>
  [...w.rows.machineRows].sort((a, b) => a.code.localeCompare(b.code)).filter((m) => w.published(m.id)).map((m) => ({ value: m.code, label: `${m.code} · ${w.published(m.id)!.label}` }));

/** Active deals the viewer may work on (its team, or the sales direction). */
export const dealOptions = (w: ModulusWorld, v: Viewer) =>
  w.rows.dealRows.filter((d) => isActiveDeal(d.state) && canSeeDealPrices(v.roles, (w.membersOf.get(d.id) ?? []).some((m) => m.userId === v.userId)))
    .sort((a, b) => b.ref.localeCompare(a.ref)).map((d) => ({ value: d.ref, label: `${d.ref} · ${w.customerBy.get(d.customerId)?.name ?? ''}` }));

/** The questions of a request (common core + its family, in the versions it was opened with). */
export const quoteQuestions = (w: ModulusWorld, q: QuoteRow) => [...(w.questionsOf.get(q.commonQuestionnaireId) ?? []), ...(q.familyQuestionnaireId ? w.questionsOf.get(q.familyQuestionnaireId) ?? [] : [])];

/** The required questions still without an answer. */
export const quoteMissing = (w: ModulusWorld, q: QuoteRow) => missingAnswers(quoteQuestions(w, q), new Map((w.answersOf.get(q.id) ?? []).map((a) => [a.questionId, a.value])));
