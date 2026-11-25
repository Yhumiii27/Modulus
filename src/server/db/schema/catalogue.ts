// The catalogue (docs/spec/01): machine types and their characteristics (D-6), standard machines and their versions (draft →
// published → retired; a published version is frozen by the trigger of migration 0001), the prefabricated BOM of a version,
// catalogue and specific options with their rules and BOM deltas (never a copy of the BOM), budgets per post (cost — their
// own table and right, D-15) and dated price lists (sale price, validated by the sales direction, D-4). Every column carries
// its constraint (Norma § 4).
import { sql } from 'drizzle-orm';
import { boolean, check, date, doublePrecision, index, integer, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { BUDGET_POSTS, CONDITION_OPS, DELTA_OPS, OPTION_CATEGORIES, OPTION_ORIGINS, PG_FORMATS, PRICE_LIST_STATES, RULE_KINDS, UNITS, VERSION_STATES } from '@/domain/vocab';
import { modulus } from './_schema';
import { id, inList, matches, notBlank, timestamps } from './_common';

export const machineTypes = modulus.table('machine_types', {
  code: text('code').primaryKey(),
  label: text('label').notNull(),
  description: text('description'),
  /** Payment terms of the type (docs/spec/02 § 2): deposit / delivery / acceptance, in % (sum 100). */
  depositPct: integer('deposit_pct').notNull().default(30),
  deliveryPct: integer('delivery_pct').notNull().default(60),
  acceptancePct: integer('acceptance_pct').notNull().default(10),
  ...timestamps,
}, (t) => [
  check('machine_types_code_check', matches(t.code, PG_FORMATS.typeCode)),
  check('machine_types_label_check', notBlank(t.label)),
  check('machine_types_payment_check', sql`${t.depositPct} between 0 and 100 and ${t.deliveryPct} between 0 and 100 and ${t.acceptancePct} between 0 and 100 and ${t.depositPct} + ${t.deliveryPct} + ${t.acceptancePct} = 100`),
]);

/** The characteristics of a type (D-6: a starting list, added by type without development). */
export const characteristicDefs = modulus.table('characteristic_defs', {
  typeCode: text('type_code').notNull().references(() => machineTypes.code),
  key: text('key').notNull(),
  label: text('label').notNull(),
  unit: text('unit'),
  position: integer('position').notNull().default(0),
}, (t) => [
  primaryKey({ columns: [t.typeCode, t.key] }),
  check('characteristic_defs_key_check', matches(t.key, PG_FORMATS.characteristicKey)),
  check('characteristic_defs_label_check', notBlank(t.label)),
  check('characteristic_defs_position_check', sql`${t.position} between 0 and 999`),
]);

export const machines = modulus.table('machines', {
  id: id(),
  code: text('code').notNull().unique(),
  typeCode: text('type_code').notNull().references(() => machineTypes.code),
  ...timestamps,
}, (t) => [check('machines_code_check', matches(t.code, PG_FORMATS.machineCode))]);

/** A version of a standard machine. Published or retired: frozen (trigger), except published → retired. */
export const machineVersions = modulus.table('machine_versions', {
  id: id(),
  machineId: uuid('machine_id').notNull().references(() => machines.id),
  version: integer('version').notNull(),
  state: text('state').notNull().default('draft'),
  label: text('label').notNull(),
  variant: text('variant'),
  description: text('description'),
  nominalCapacity: doublePrecision('nominal_capacity').notNull(),
  capacityUnit: text('capacity_unit').notNull(),
  leadWeeks: integer('lead_weeks').notNull(),
  /** Codex reference of the datasheet (Modulus stores no file). */
  datasheetRef: text('datasheet_ref'),
  note: text('note'),
  createdByName: text('created_by_name').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  retiredAt: timestamp('retired_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('machine_versions_number_idx').on(t.machineId, t.version),
  uniqueIndex('machine_versions_one_published_idx').on(t.machineId).where(sql`${t.state} = 'published'`),
  check('machine_versions_version_check', sql`${t.version} between 1 and 999`),
  check('machine_versions_state_check', inList(t.state, VERSION_STATES)),
  check('machine_versions_label_check', sql`btrim(${t.label}) <> '' and btrim(${t.capacityUnit}) <> ''`),
  check('machine_versions_values_check', sql`${t.nominalCapacity} > 0 and ${t.leadWeeks} between 1 and 260`),
  check('machine_versions_datasheet_check', sql`${t.datasheetRef} is null or ${t.datasheetRef} ~ '${sql.raw(PG_FORMATS.codexRef)}'`),
  check('machine_versions_dates_check', sql`(${t.state} = 'draft') = (${t.publishedAt} is null) and (${t.state} = 'retired') = (${t.retiredAt} is not null)`),
]);

/** Value of a characteristic for a version (frozen with the version). */
export const versionCharacteristics = modulus.table('version_characteristics', {
  versionId: uuid('version_id').notNull().references(() => machineVersions.id),
  key: text('key').notNull(),
  value: text('value').notNull(),
}, (t) => [
  primaryKey({ columns: [t.versionId, t.key] }),
  check('version_characteristics_key_check', matches(t.key, PG_FORMATS.characteristicKey)),
  check('version_characteristics_value_check', notBlank(t.value)),
]);

/** Base BOM of a machine version: articles of Keystone (D-5, keystone.pub_articles). Changed only on a draft (trigger). */
export const bomLines = modulus.table('bom_lines', {
  id: id(),
  versionId: uuid('version_id').notNull().references(() => machineVersions.id),
  subassembly: text('subassembly').notNull(),
  mark: text('mark').notNull(),
  article: text('article').notNull(),
  designation: text('designation').notNull(),
  quantity: doublePrecision('quantity').notNull(),
  unit: text('unit').notNull(),
}, (t) => [
  index('bom_lines_version_idx').on(t.versionId),
  uniqueIndex('bom_lines_article_idx').on(t.versionId, t.article),
  check('bom_lines_article_check', matches(t.article, PG_FORMATS.article)),
  check('bom_lines_text_check', sql`btrim(${t.subassembly}) <> '' and btrim(${t.mark}) <> '' and btrim(${t.designation}) <> ''`),
  check('bom_lines_quantity_check', sql`${t.quantity} > 0`),
  check('bom_lines_unit_check', inList(t.unit, UNITS)),
]);

/** Last purchase price of an article — the stand-in of Keystone's view of purchase prices (request K-1) for the computed budget. */
export const articlePrices = modulus.table('article_prices', {
  article: text('article').primaryKey(),
  unitPriceKeur: doublePrecision('unit_price_keur').notNull(),
  on: date('on').notNull(),
  source: text('source').notNull().default('simulation'),
}, (t) => [
  check('article_prices_article_check', matches(t.article, PG_FORMATS.article)),
  check('article_prices_price_check', sql`${t.unitPriceKeur} >= 0`),
  check('article_prices_source_check', sql`${t.source} in ('simulation', 'keystone')`),
]);

/** An option: of the catalogue, or specific (born from a quotation request, docs/spec/03 § 4). */
export const options = modulus.table('options', {
  id: id(),
  code: text('code').notNull().unique(),
  label: text('label').notNull(),
  description: text('description'),
  category: text('category').notNull(),
  origin: text('origin').notNull().default('catalogue'),
  /** The quotation request a specific option comes from (DC-…). */
  quoteRequestId: uuid('quote_request_id'),
  extraWeeks: integer('extra_weeks').notNull().default(0),
  active: boolean('active').notNull().default(true),
  ...timestamps,
}, (t) => [
  check('options_code_check', matches(t.code, PG_FORMATS.optionCode)),
  check('options_label_check', notBlank(t.label)),
  check('options_category_check', inList(t.category, OPTION_CATEGORIES)),
  check('options_origin_check', inList(t.origin, OPTION_ORIGINS)),
  check('options_specific_check', sql`(${t.origin} = 'specific') = (${t.quoteRequestId} is not null) and (${t.origin} = 'specific') = (${t.code} like 'SPE-%')`),
  check('options_weeks_check', sql`${t.extraWeeks} between 0 and 104`),
]);

/** Machines an option applies to. */
export const optionMachines = modulus.table('option_machines', {
  optionId: uuid('option_id').notNull().references(() => options.id),
  machineId: uuid('machine_id').notNull().references(() => machines.id),
}, (t) => [primaryKey({ columns: [t.optionId, t.machineId] })]);

/** Rules between options (the configurator): excludes, requires, mandatory if (a characteristic), one of (exclusive group). */
export const optionRules = modulus.table('option_rules', {
  id: id(),
  optionId: uuid('option_id').notNull().references(() => options.id),
  kind: text('kind').notNull(),
  targetOptionId: uuid('target_option_id').references(() => options.id),
  conditionKey: text('condition_key'),
  conditionOp: text('condition_op'),
  conditionValue: doublePrecision('condition_value'),
  explanation: text('explanation').notNull(),
  createdByName: text('created_by_name').notNull(),
  ...timestamps,
}, (t) => [
  check('option_rules_kind_check', inList(t.kind, RULE_KINDS)),
  check('option_rules_shape_check', sql`(${t.kind} = 'mandatory_if' and ${t.targetOptionId} is null and ${t.conditionKey} is not null and ${t.conditionOp} is not null and ${t.conditionValue} is not null)
    or (${t.kind} <> 'mandatory_if' and ${t.targetOptionId} is not null and ${t.targetOptionId} <> ${t.optionId} and ${t.conditionKey} is null and ${t.conditionOp} is null and ${t.conditionValue} is null)`),
  check('option_rules_op_check', sql`${t.conditionOp} is null or ${t.conditionOp} in (${sql.raw(CONDITION_OPS.map((o) => `'${o}'`).join(', '))})`),
  check('option_rules_key_check', sql`${t.conditionKey} is null or ${t.conditionKey} ~ '${sql.raw(PG_FORMATS.characteristicKey)}'`),
  check('option_rules_explanation_check', notBlank(t.explanation)),
]);

/** What an option changes in the BOM: adds, removes or replaces lines (a delta, never a copy). */
export const optionBomDeltas = modulus.table('option_bom_deltas', {
  id: id(),
  optionId: uuid('option_id').notNull().references(() => options.id),
  op: text('op').notNull(),
  article: text('article').notNull(),
  designation: text('designation').notNull(),
  quantity: doublePrecision('quantity'),
  unit: text('unit'),
  /** The article of the base BOM replaced (op = replace). */
  replaces: text('replaces'),
}, (t) => [
  index('option_bom_deltas_option_idx').on(t.optionId),
  check('option_bom_deltas_op_check', inList(t.op, DELTA_OPS)),
  check('option_bom_deltas_article_check', sql`${t.article} ~ '${sql.raw(PG_FORMATS.article)}' and (${t.replaces} is null or ${t.replaces} ~ '${sql.raw(PG_FORMATS.article)}')`),
  check('option_bom_deltas_designation_check', notBlank(t.designation)),
  check('option_bom_deltas_shape_check', sql`(${t.op} = 'remove' and ${t.quantity} is null and ${t.replaces} is null)
    or (${t.op} = 'add' and ${t.quantity} > 0 and ${t.unit} is not null and ${t.replaces} is null)
    or (${t.op} = 'replace' and ${t.quantity} > 0 and ${t.unit} is not null and ${t.replaces} is not null)`),
  check('option_bom_deltas_unit_check', sql`${t.unit} is null or ${t.unit} in (${sql.raw(UNITS.map((u) => `'${u}'`).join(', '))})`),
]);

/**
 * Budget (cost price forecast) per post of a machine version or of a catalogue option (D-7: entered; the computed value comes
 * from the BOM × purchase prices and the hours × rates, never stored). Its own table and right (D-15): never published to Arche.
 */
export const costBudgets = modulus.table('cost_budgets', {
  id: id(),
  machineVersionId: uuid('machine_version_id').references(() => machineVersions.id),
  optionId: uuid('option_id').references(() => options.id),
  post: text('post').notNull(),
  enteredKeur: doublePrecision('entered_keur').notNull(),
  /** Standard hours of an hour post (computed value = hours × rate). */
  hours: doublePrecision('hours'),
  basis: text('basis'),
  updatedByName: text('updated_by_name').notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('cost_budgets_version_post_idx').on(t.machineVersionId, t.post).where(sql`${t.machineVersionId} is not null`),
  uniqueIndex('cost_budgets_option_post_idx').on(t.optionId, t.post).where(sql`${t.optionId} is not null`),
  check('cost_budgets_subject_check', sql`(${t.machineVersionId} is null) <> (${t.optionId} is null)`),
  check('cost_budgets_post_check', inList(t.post, BUDGET_POSTS)),
  check('cost_budgets_values_check', sql`${t.enteredKeur} >= 0 and (${t.hours} is null or ${t.hours} >= 0)`),
  check('cost_budgets_hours_check', sql`${t.hours} is null or ${t.post} in ('engineering_hours', 'workshop_hours', 'site_hours')`),
]);

/** Dated price lists in euros (D-14), published once validated by the sales direction (D-4). */
export const priceLists = modulus.table('price_lists', {
  id: id(),
  code: text('code').notNull().unique(),
  validFrom: date('valid_from').notNull(),
  validTo: date('valid_to').notNull(),
  currency: text('currency').notNull().default('EUR'),
  state: text('state').notNull().default('draft'),
  maxDiscountPct: doublePrecision('max_discount_pct').notNull().default(10),
  proposedByName: text('proposed_by_name').notNull(),
  validatedByName: text('validated_by_name'),
  validatedAt: timestamp('validated_at', { withTimezone: true }),
  /** Second validation by the general management when the maximum discount exceeds the threshold (D-4). */
  confirmedByName: text('confirmed_by_name'),
  ...timestamps,
}, (t) => [
  check('price_lists_code_check', matches(t.code, PG_FORMATS.priceList)),
  check('price_lists_dates_check', sql`${t.validFrom} <= ${t.validTo}`),
  check('price_lists_currency_check', sql`${t.currency} = 'EUR'`),
  check('price_lists_state_check', inList(t.state, PRICE_LIST_STATES)),
  check('price_lists_discount_check', sql`${t.maxDiscountPct} between 0 and 50`),
  check('price_lists_validated_check', sql`(${t.state} in ('published', 'withdrawn')) = (${t.validatedAt} is not null and ${t.validatedByName} is not null)`),
]);

/** Sale price of a machine (any version) or a catalogue option in a price list, in k€. */
export const priceListItems = modulus.table('price_list_items', {
  id: id(),
  priceListId: uuid('price_list_id').notNull().references(() => priceLists.id),
  machineId: uuid('machine_id').references(() => machines.id),
  optionId: uuid('option_id').references(() => options.id),
  saleKeur: doublePrecision('sale_keur').notNull(),
}, (t) => [
  uniqueIndex('price_list_items_machine_idx').on(t.priceListId, t.machineId).where(sql`${t.machineId} is not null`),
  uniqueIndex('price_list_items_option_idx').on(t.priceListId, t.optionId).where(sql`${t.optionId} is not null`),
  check('price_list_items_subject_check', sql`(${t.machineId} is null) <> (${t.optionId} is null)`),
  check('price_list_items_price_check', sql`${t.saleKeur} > 0`),
]);
