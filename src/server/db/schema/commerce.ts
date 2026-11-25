// Commerce (docs/spec/02–04): customers (D-16: read in Keystone, a prospect created here), deals and their teams (U-2), the
// configuration lines, the offers (frozen when sent: trigger of migration 0001), the offer reviews (append-only), the sold
// configurations and their amendments (immutable), the quotation requests with their questionnaires (D-10), qualification,
// estimate and thread, the project's return (Keystone, D-9) and the know-how notes (append-only). Every column carries its
// constraint (Norma § 4).
import { sql } from 'drizzle-orm';
import { boolean, check, date, doublePrecision, index, integer, jsonb, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { FrozenConfiguration } from '@/domain/offer';
import {
  ANSWER_TYPES, CUSTOMER_KINDS, CUSTOMER_SOURCES, DEAL_ORIGINS, DEAL_STATES, DELTA_OPS, ESTIMATE_CLASSES, FEASIBILITIES, FEEDBACK_STAGES, KNOWHOW_LEVELS,
  KNOWHOW_NOTE_KINDS, LOSS_REASONS, OFFER_STATES, OPTION_CATEGORIES, PG_FORMATS, QUESTION_THEMES, QUOTE_ORIGINS, QUOTE_STATES, REVIEW_DECISIONS, REVIEW_LEVELS,
  TEAM_ROLES, UNITS, VERSION_STATES,
} from '@/domain/vocab';
import { modulus } from './_schema';
import { id, inList, matches, notBlank, timestamps } from './_common';
import { machineVersions, machines, options } from './catalogue';
import { users } from './platform';

export const customers = modulus.table('customers', {
  id: id(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  country: text('country').notNull(),
  source: text('source').notNull(),
  ...timestamps,
}, (t) => [
  check('customers_code_check', matches(t.code, PG_FORMATS.customerCode)),
  check('customers_name_check', notBlank(t.name)),
  check('customers_kind_check', inList(t.kind, CUSTOMER_KINDS)),
  check('customers_country_check', matches(t.country, PG_FORMATS.country)),
  check('customers_source_check', inList(t.source, CUSTOMER_SOURCES)),
]);

export const deals = modulus.table('deals', {
  id: id(),
  ref: text('ref').notNull().unique(),
  saleCase: integer('sale_case').notNull(),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  intermediaryId: uuid('intermediary_id').references(() => customers.id),
  capexNeed: text('capex_need'),
  deliverySite: text('delivery_site').notNull(),
  origin: text('origin').notNull(),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  ownerName: text('owner_name').notNull(),
  need: text('need').notNull(),
  wishedFor: text('wished_for'),
  customerBudgetKeur: doublePrecision('customer_budget_keur'),
  state: text('state').notNull().default('open'),
  probability: integer('probability').notNull(),
  lossReason: text('loss_reason'),
  lossNote: text('loss_note'),
  ...timestamps,
}, (t) => [
  check('deals_ref_check', matches(t.ref, PG_FORMATS.dealRef)),
  check('deals_case_check', sql`${t.saleCase} in (1, 2, 3)`),
  check('deals_case_shape_check', sql`(${t.saleCase} = 2) = (${t.intermediaryId} is not null) and (${t.saleCase} = 1 or ${t.capexNeed} is null)`),
  check('deals_capex_check', sql`${t.capexNeed} is null or ${t.capexNeed} ~ '${sql.raw(PG_FORMATS.capexNeed)}'`),
  check('deals_text_check', sql`btrim(${t.deliverySite}) <> '' and btrim(${t.need}) <> '' and btrim(${t.ownerName}) <> ''`),
  check('deals_origin_check', inList(t.origin, DEAL_ORIGINS)),
  check('deals_origin_capex_check', sql`(${t.origin} = 'capex_need') = (${t.capexNeed} is not null)`),
  check('deals_state_check', inList(t.state, DEAL_STATES)),
  check('deals_probability_check', sql`${t.probability} between 0 and 100 and (${t.state} <> 'won' or ${t.probability} = 100) and (${t.state} not in ('lost', 'abandoned') or ${t.probability} = 0)`),
  check('deals_loss_check', sql`(${t.state} in ('lost', 'abandoned')) = (${t.lossReason} is not null) and (${t.lossReason} is null or ${t.lossReason} in (${sql.raw(LOSS_REASONS.map((r) => `'${r}'`).join(', '))}))`),
  check('deals_budget_check', sql`${t.customerBudgetKeur} is null or ${t.customerBudgetKeur} > 0`),
]);

/** The team of a deal (U-2: it sees the deal's prices). */
export const dealMembers = modulus.table('deal_members', {
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  userName: text('user_name').notNull(),
  role: text('role').notNull(),
}, (t) => [
  primaryKey({ columns: [t.dealId, t.userId] }),
  check('deal_members_role_check', inList(t.role, TEAM_ROLES)),
  check('deal_members_name_check', notBlank(t.userName)),
]);

/** A configuration line: a machine version × quantity, plus its options (catalogue or specific). */
export const dealLines = modulus.table('deal_lines', {
  id: id(),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  number: integer('number').notNull(),
  machineVersionId: uuid('machine_version_id').notNull().references(() => machineVersions.id),
  quantity: integer('quantity').notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('deal_lines_number_idx').on(t.dealId, t.number),
  check('deal_lines_values_check', sql`${t.number} between 1 and 99 and ${t.quantity} between 1 and 50`),
]);

export const dealLineOptions = modulus.table('deal_line_options', {
  lineId: uuid('line_id').notNull().references(() => dealLines.id, { onDelete: 'cascade' }),
  optionId: uuid('option_id').notNull().references(() => options.id),
}, (t) => [primaryKey({ columns: [t.lineId, t.optionId] })]);

/**
 * An offer A, B… of a deal. A draft is computed from the deal's lines; sent, it is frozen (trigger): content, totals, discount,
 * lead time, validity, currency and rate, assumptions and reservations never change; only the state moves (accepted, declined)
 * and the Codex reference of its PDF is set once.
 */
export const offers = modulus.table('offers', {
  id: id(),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  letter: text('letter').notNull(),
  state: text('state').notNull().default('draft'),
  discountPct: doublePrecision('discount_pct').notNull().default(0),
  validityDays: integer('validity_days').notNull(),
  currency: text('currency').notNull().default('EUR'),
  /** Units of the currency for 1 EUR, fixed when the offer is sent (D-14). */
  rate: doublePrecision('rate'),
  assumptions: text('assumptions'),
  reservations: text('reservations'),
  note: text('note'),
  content: jsonb('content').$type<FrozenConfiguration>(),
  totalSaleKeur: doublePrecision('total_sale_keur'),
  totalBudgetKeur: doublePrecision('total_budget_keur'),
  leadWeeks: integer('lead_weeks'),
  sentOn: date('sent_on'),
  sentByName: text('sent_by_name'),
  codexRef: text('codex_ref'),
  ...timestamps,
}, (t) => [
  uniqueIndex('offers_letter_idx').on(t.dealId, t.letter),
  check('offers_letter_check', sql`${t.letter} ~ '^[A-Z]$'`),
  check('offers_state_check', inList(t.state, OFFER_STATES)),
  check('offers_discount_check', sql`${t.discountPct} between 0 and 50`),
  check('offers_validity_check', sql`${t.validityDays} between 1 and 365`),
  check('offers_currency_check', sql`${t.currency} ~ '^[A-Z]{3}$' and ((${t.state} = 'draft' and ${t.rate} is null) or (${t.state} <> 'draft' and (${t.currency} = 'EUR') = (${t.rate} is null))) and (${t.rate} is null or ${t.rate} > 0)`),
  check('offers_frozen_shape_check', sql`(${t.state} = 'draft') = (${t.content} is null) and (${t.state} = 'draft') = (${t.sentOn} is null)
    and (${t.state} = 'draft') = (${t.totalSaleKeur} is null) and (${t.state} = 'draft') = (${t.sentByName} is null) and (${t.state} = 'draft') = (${t.leadWeeks} is null)`),
  check('offers_totals_check', sql`(${t.totalSaleKeur} is null or ${t.totalSaleKeur} > 0) and (${t.totalBudgetKeur} is null or ${t.totalBudgetKeur} >= 0)`),
  check('offers_codex_check', sql`${t.codexRef} is null or ${t.codexRef} ~ '${sql.raw(PG_FORMATS.codexRef)}'`),
]);

/** Offer review (D-8): go / no-go with its author and the checklist as computed — append-only (trigger). */
export const offerReviews = modulus.table('offer_reviews', {
  id: id(),
  offerId: uuid('offer_id').notNull().references(() => offers.id),
  level: text('level').notNull(),
  decision: text('decision').notNull(),
  comment: text('comment'),
  checks: jsonb('checks').$type<{ label: string; ok: boolean; detail: string }[]>().notNull(),
  decidedById: uuid('decided_by_id').notNull().references(() => users.id),
  decidedByName: text('decided_by_name').notNull(),
  decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('offer_reviews_offer_idx').on(t.offerId),
  check('offer_reviews_level_check', inList(t.level, REVIEW_LEVELS)),
  check('offer_reviews_decision_check', inList(t.decision, REVIEW_DECISIONS)),
  check('offer_reviews_nogo_check', sql`${t.decision} = 'go' or btrim(coalesce(${t.comment}, '')) <> ''`),
]);

/**
 * A sold configuration and its versions: v1 at the order (frozen copy of the offer retained), v2… at each amendment (what
 * changes, its reason). Immutable (trigger), except the Keystone project linked once.
 */
export const soldConfigurations = modulus.table('sold_configurations', {
  id: id(),
  ref: text('ref').notNull(),
  version: integer('version').notNull(),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  offerId: uuid('offer_id').notNull().references(() => offers.id),
  orderedOn: date('ordered_on').notNull(),
  customerOrderRef: text('customer_order_ref').notNull(),
  amendmentReason: text('amendment_reason'),
  content: jsonb('content').$type<FrozenConfiguration>().notNull(),
  totalSaleKeur: doublePrecision('total_sale_keur').notNull(),
  totalBudgetKeur: doublePrecision('total_budget_keur').notNull(),
  leadWeeks: integer('lead_weeks').notNull(),
  keystoneProject: text('keystone_project'),
  createdByName: text('created_by_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('sold_configurations_version_idx').on(t.ref, t.version),
  check('sold_configurations_ref_check', matches(t.ref, PG_FORMATS.soldRef)),
  check('sold_configurations_version_check', sql`${t.version} between 1 and 99 and (${t.version} = 1) = (${t.amendmentReason} is null)`),
  check('sold_configurations_text_check', sql`btrim(${t.customerOrderRef}) <> '' and (${t.amendmentReason} is null or btrim(${t.amendmentReason}) <> '')`),
  check('sold_configurations_totals_check', sql`${t.totalSaleKeur} > 0 and ${t.totalBudgetKeur} >= 0 and ${t.leadWeeks} between 1 and 520`),
  check('sold_configurations_project_check', sql`${t.keystoneProject} is null or ${t.keystoneProject} ~ '${sql.raw(PG_FORMATS.keystoneProject)}'`),
]);

// ── Quotation requests ────────────────────────────────────────────────────────────────────────────────────────────────

/** A standard questionnaire, versioned like the catalogue (D-10): the common core or a type × category family. */
export const questionnaires = modulus.table('questionnaires', {
  id: id(),
  family: text('family').notNull(),
  label: text('label').notNull(),
  version: integer('version').notNull(),
  state: text('state').notNull().default('draft'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('questionnaires_version_idx').on(t.family, t.version),
  uniqueIndex('questionnaires_one_published_idx').on(t.family).where(sql`${t.state} = 'published'`),
  uniqueIndex('questionnaires_one_draft_idx').on(t.family).where(sql`${t.state} = 'draft'`),
  check('questionnaires_family_check', sql`${t.family} = 'common' or ${t.family} ~ '^[A-Z]{2,8}:(${sql.raw(OPTION_CATEGORIES.join('|'))})$'`),
  check('questionnaires_label_check', notBlank(t.label)),
  check('questionnaires_state_check', inList(t.state, VERSION_STATES)),
  check('questionnaires_version_check', sql`${t.version} between 1 and 999 and (${t.state} = 'draft') = (${t.publishedAt} is null)`),
]);

/** A question of a questionnaire (changed only while its questionnaire is a draft: trigger). */
export const questions = modulus.table('questions', {
  id: id(),
  questionnaireId: uuid('questionnaire_id').notNull().references(() => questionnaires.id),
  position: integer('position').notNull(),
  theme: text('theme').notNull(),
  text: text('text').notNull(),
  answerType: text('answer_type').notNull(),
  unit: text('unit'),
  choices: text('choices'),
  required: boolean('required').notNull().default(false),
}, (t) => [
  uniqueIndex('questions_position_idx').on(t.questionnaireId, t.position),
  check('questions_position_check', sql`${t.position} between 1 and 999`),
  check('questions_theme_check', inList(t.theme, QUESTION_THEMES)),
  check('questions_text_check', notBlank(t.text)),
  check('questions_type_check', inList(t.answerType, ANSWER_TYPES)),
  check('questions_choices_check', sql`(${t.answerType} = 'choice') = (${t.choices} is not null and btrim(${t.choices}) <> '')`),
]);

/** A quotation request (docs/spec/03): from a deal, or sent by Arche for a CAPEX machine need. */
export const quoteRequests = modulus.table('quote_requests', {
  id: id(),
  ref: text('ref').notNull().unique(),
  title: text('title').notNull(),
  origin: text('origin').notNull(),
  dealId: uuid('deal_id').references(() => deals.id),
  capexNeed: text('capex_need'),
  machineId: uuid('machine_id').notNull().references(() => machines.id),
  category: text('category').notNull(),
  estimateClass: text('estimate_class').notNull(),
  receivedOn: date('received_on').notNull(),
  /** Target lead time in working days fixed at reception from the settings (D-11); the due date is computed. */
  targetDays: integer('target_days').notNull(),
  state: text('state').notNull().default('qualification'),
  followedById: uuid('followed_by_id').notNull().references(() => users.id),
  followedByName: text('followed_by_name').notNull(),
  commonQuestionnaireId: uuid('common_questionnaire_id').notNull().references(() => questionnaires.id),
  familyQuestionnaireId: uuid('family_questionnaire_id').references(() => questionnaires.id),
  feasibility: text('feasibility'),
  proposedLevel: text('proposed_level'),
  qualificationNote: text('qualification_note'),
  qualifiedByName: text('qualified_by_name'),
  qualifiedOn: date('qualified_on'),
  answeredOn: date('answered_on'),
  answeredByName: text('answered_by_name'),
  cancelReason: text('cancel_reason'),
  ...timestamps,
}, (t) => [
  check('quote_requests_ref_check', matches(t.ref, PG_FORMATS.quoteRef)),
  check('quote_requests_title_check', sql`btrim(${t.title}) <> '' and btrim(${t.followedByName}) <> ''`),
  check('quote_requests_origin_check', inList(t.origin, QUOTE_ORIGINS)),
  check('quote_requests_origin_shape_check', sql`(${t.origin} = 'deal' and ${t.dealId} is not null) or (${t.origin} = 'arche' and ${t.capexNeed} is not null)`),
  check('quote_requests_capex_check', sql`${t.capexNeed} is null or ${t.capexNeed} ~ '${sql.raw(PG_FORMATS.capexNeed)}'`),
  check('quote_requests_category_check', inList(t.category, OPTION_CATEGORIES)),
  check('quote_requests_class_check', inList(t.estimateClass, ESTIMATE_CLASSES)),
  check('quote_requests_target_check', sql`${t.targetDays} between 1 and 120`),
  check('quote_requests_state_check', inList(t.state, QUOTE_STATES)),
  check('quote_requests_feasibility_check', sql`(${t.feasibility} is null or ${t.feasibility} in (${sql.raw(FEASIBILITIES.map((f) => `'${f}'`).join(', '))}))
    and (${t.proposedLevel} is null or ${t.proposedLevel} in (${sql.raw(KNOWHOW_LEVELS.map((f) => `'${f}'`).join(', '))}))
    and ((${t.feasibility} is null) = (${t.qualifiedOn} is null)) and (${t.state} = 'qualification' or ${t.state} = 'cancelled' or ${t.feasibility} is not null)`),
  check('quote_requests_refused_check', sql`${t.state} <> 'refused' or btrim(coalesce(${t.qualificationNote}, '')) <> ''`),
  check('quote_requests_answered_check', sql`(${t.state} = 'answered') = (${t.answeredOn} is not null)`),
  check('quote_requests_cancel_check', sql`(${t.state} = 'cancelled') = (${t.cancelReason} is not null and btrim(${t.cancelReason}) <> '')`),
]);

export const quoteAnswers = modulus.table('quote_answers', {
  requestId: uuid('request_id').notNull().references(() => quoteRequests.id),
  questionId: uuid('question_id').notNull().references(() => questions.id),
  value: text('value').notNull(),
  enteredByName: text('entered_by_name').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.requestId, t.questionId] }), check('quote_answers_value_check', notBlank(t.value))]);

/** The estimate of a request (docs/spec/03 § 3.2): budget per post (cost: estimators and directions), sale price, lead time. */
export const quoteEstimates = modulus.table('quote_estimates', {
  requestId: uuid('request_id').primaryKey().references(() => quoteRequests.id),
  materialKeur: doublePrecision('material_keur').notNull(),
  subcontractingKeur: doublePrecision('subcontracting_keur').notNull(),
  engineeringHours: doublePrecision('engineering_hours').notNull(),
  workshopHours: doublePrecision('workshop_hours').notNull(),
  siteHours: doublePrecision('site_hours').notNull(),
  expensesKeur: doublePrecision('expenses_keur').notNull(),
  saleKeur: doublePrecision('sale_keur').notNull(),
  extraWeeks: integer('extra_weeks').notNull(),
  validityDays: integer('validity_days').notNull(),
  assumptions: text('assumptions'),
  estimatedByName: text('estimated_by_name').notNull(),
  ...timestamps,
}, (t) => [
  check('quote_estimates_values_check', sql`${t.materialKeur} >= 0 and ${t.subcontractingKeur} >= 0 and ${t.engineeringHours} >= 0 and ${t.workshopHours} >= 0
    and ${t.siteHours} >= 0 and ${t.expensesKeur} >= 0 and ${t.saleKeur} > 0 and ${t.extraWeeks} between 0 and 104 and ${t.validityDays} between 1 and 365`),
]);

export const quoteBomDeltas = modulus.table('quote_bom_deltas', {
  id: id(),
  requestId: uuid('request_id').notNull().references(() => quoteRequests.id),
  op: text('op').notNull(),
  article: text('article').notNull(),
  designation: text('designation').notNull(),
  quantity: doublePrecision('quantity').notNull(),
  unit: text('unit').notNull(),
}, (t) => [
  check('quote_bom_deltas_op_check', inList(t.op, DELTA_OPS)),
  check('quote_bom_deltas_article_check', matches(t.article, PG_FORMATS.article)),
  check('quote_bom_deltas_designation_check', notBlank(t.designation)),
  check('quote_bom_deltas_quantity_check', sql`${t.quantity} > 0`),
  check('quote_bom_deltas_unit_check', inList(t.unit, UNITS)),
]);

/** The thread of a request (questions back to the requester) — append-only (trigger). */
export const quoteMessages = modulus.table('quote_messages', {
  id: id(),
  requestId: uuid('request_id').notNull().references(() => quoteRequests.id),
  authorName: text('author_name').notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('quote_messages_request_idx').on(t.requestId), check('quote_messages_text_check', sql`btrim(${t.authorName}) <> '' and btrim(${t.body}) <> ''`)]);

// ── Project feedback and know-how ─────────────────────────────────────────────────────────────────────────────────────

/** The project's return per sold configuration (D-9: at closure, then at the end of warranty), real cost per post. */
export const projectFeedback = modulus.table('project_feedback', {
  id: id(),
  soldRef: text('sold_ref').notNull(),
  stage: text('stage').notNull(),
  receivedOn: date('received_on').notNull(),
  materialKeur: doublePrecision('material_keur').notNull(),
  subcontractingKeur: doublePrecision('subcontracting_keur').notNull(),
  engineeringKeur: doublePrecision('engineering_keur').notNull(),
  workshopKeur: doublePrecision('workshop_keur').notNull(),
  siteKeur: doublePrecision('site_keur').notNull(),
  expensesKeur: doublePrecision('expenses_keur').notNull(),
  engineeringHours: doublePrecision('engineering_hours').notNull(),
  workshopHours: doublePrecision('workshop_hours').notNull(),
  siteHours: doublePrecision('site_hours').notNull(),
  rexRef: text('rex_ref'),
  rexSummary: text('rex_summary'),
  majorDifficulty: boolean('major_difficulty').notNull().default(false),
  source: text('source').notNull(),
  recordedByName: text('recorded_by_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('project_feedback_stage_idx').on(t.soldRef, t.stage),
  check('project_feedback_ref_check', matches(t.soldRef, PG_FORMATS.soldRef)),
  check('project_feedback_stage_check', inList(t.stage, FEEDBACK_STAGES)),
  check('project_feedback_values_check', sql`${t.materialKeur} >= 0 and ${t.subcontractingKeur} >= 0 and ${t.engineeringKeur} >= 0 and ${t.workshopKeur} >= 0
    and ${t.siteKeur} >= 0 and ${t.expensesKeur} >= 0 and ${t.engineeringHours} >= 0 and ${t.workshopHours} >= 0 and ${t.siteHours} >= 0`),
  check('project_feedback_source_check', sql`${t.source} in ('keystone', 'entered')`),
]);

/** Per option of the sold configuration: delivered or not, real cost (a sold option not delivered is flagged). */
export const feedbackOptions = modulus.table('feedback_options', {
  feedbackId: uuid('feedback_id').notNull().references(() => projectFeedback.id),
  optionId: uuid('option_id').notNull().references(() => options.id),
  delivered: boolean('delivered').notNull(),
  budgetKeur: doublePrecision('budget_keur').notNull(),
  actualKeur: doublePrecision('actual_keur'),
}, (t) => [
  primaryKey({ columns: [t.feedbackId, t.optionId] }),
  check('feedback_options_values_check', sql`${t.budgetKeur} >= 0 and (${t.actualKeur} is null or ${t.actualKeur} >= 0) and (${t.delivered} or ${t.actualKeur} is null)`),
]);

/** Engineering's notes and "to avoid" marks on a (machine,) option — append-only (trigger); the level itself is computed. */
export const knowhowNotes = modulus.table('knowhow_notes', {
  id: id(),
  optionId: uuid('option_id').notNull().references(() => options.id),
  machineId: uuid('machine_id').references(() => machines.id),
  kind: text('kind').notNull(),
  body: text('body').notNull(),
  authorName: text('author_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('knowhow_notes_option_idx').on(t.optionId),
  check('knowhow_notes_kind_check', inList(t.kind, KNOWHOW_NOTE_KINDS)),
  check('knowhow_notes_text_check', sql`btrim(${t.body}) <> '' and btrim(${t.authorName}) <> ''`),
]);

/** Messages to other tools (Codex deposit): simulated until the connectors are validated (docs/spec/05). */
export const outbox = modulus.table('outbox', {
  id: id(),
  target: text('target').notNull(),
  kind: text('kind').notNull(),
  objectRef: text('object_ref').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  state: text('state').notNull().default('pending'),
  resultRef: text('result_ref'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
}, (t) => [
  check('outbox_target_check', sql`${t.target} in ('codex')`),
  check('outbox_kind_check', sql`${t.kind} in ('offer_pdf', 'questionnaire_pdf')`),
  check('outbox_state_check', sql`${t.state} in ('pending', 'sent', 'failed')`),
  check('outbox_sent_check', sql`(${t.state} = 'sent') = (${t.sentAt} is not null)`),
  check('outbox_ref_check', notBlank(t.objectRef)),
]);

