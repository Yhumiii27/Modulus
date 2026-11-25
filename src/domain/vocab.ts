// Modulus's closed vocabularies (docs/spec/01–04, 06). Pure: no I/O. Each list is used twice — by the database constraints
// (src/server/db/schema, CHECK … IN (…)) and by the forms and rules — so a value accepted by the application is accepted by
// the database and the other way round. Labels are EN source strings translated through t().

// ── Catalogue ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export const VERSION_STATES = ['draft', 'published', 'retired'] as const;
export type VersionState = (typeof VERSION_STATES)[number];
export const VERSION_STATE_LABEL: Record<VersionState, string> = { draft: 'Draft', published: 'Published', retired: 'Retired' };

export const OPTION_CATEGORIES = ['capacity', 'automation', 'safety', 'environment', 'comfort', 'service', 'other'] as const;
export type OptionCategory = (typeof OPTION_CATEGORIES)[number];
export const OPTION_CATEGORY_LABEL: Record<OptionCategory, string> = {
  capacity: 'Capacity', automation: 'Automation', safety: 'Safety', environment: 'Environment', comfort: 'Comfort', service: 'Service', other: 'Other',
};

export const OPTION_ORIGINS = ['catalogue', 'specific'] as const;
export type OptionOrigin = (typeof OPTION_ORIGINS)[number];

export const RULE_KINDS = ['excludes', 'requires', 'mandatory_if', 'one_of'] as const;
export type RuleKind = (typeof RULE_KINDS)[number];
export const RULE_KIND_LABEL: Record<RuleKind, string> = { excludes: 'excludes', requires: 'requires', mandatory_if: 'mandatory if', one_of: 'one of' };

export const CONDITION_OPS = ['>=', '<=', '='] as const;
export type ConditionOp = (typeof CONDITION_OPS)[number];

export const DELTA_OPS = ['add', 'remove', 'replace'] as const;
export type DeltaOp = (typeof DELTA_OPS)[number];
export const DELTA_OP_LABEL: Record<DeltaOp, string> = { add: 'adds', remove: 'removes', replace: 'replaces' };

export const UNITS = ['u', 'lot', 'm', 'kg', 'l', 'h'] as const;
export type Unit = (typeof UNITS)[number];

/** Budget posts (docs/spec/01 § 4): the same posts for a machine, an option, an estimate and the project's real cost. */
export const BUDGET_POSTS = ['material', 'subcontracting', 'engineering_hours', 'workshop_hours', 'site_hours', 'expenses'] as const;
export type BudgetPost = (typeof BUDGET_POSTS)[number];
export const BUDGET_POST_LABEL: Record<BudgetPost, string> = {
  material: 'Material', subcontracting: 'Subcontracting', engineering_hours: 'Engineering hours', workshop_hours: 'Workshop hours', site_hours: 'Site hours', expenses: 'Expenses',
};
/** The posts counted in hours (hours × the hourly rate of settings). */
export const HOUR_POSTS = ['engineering_hours', 'workshop_hours', 'site_hours'] as const;
export type HourPost = (typeof HOUR_POSTS)[number];
export const isHourPost = (p: string): p is HourPost => (HOUR_POSTS as readonly string[]).includes(p);

export const PRICE_LIST_STATES = ['draft', 'to_validate', 'published', 'withdrawn'] as const;
export type PriceListState = (typeof PRICE_LIST_STATES)[number];
export const PRICE_LIST_STATE_LABEL: Record<PriceListState, string> = { draft: 'Draft', to_validate: 'To validate', published: 'Published', withdrawn: 'Withdrawn' };

// ── Customers and deals ───────────────────────────────────────────────────────────────────────────────────────────────

/** Customer kinds (answer D-3): a subsidiary of the group, a mining site, an external customer. */
export const CUSTOMER_KINDS = ['subsidiary', 'mining_site', 'external'] as const;
export type CustomerKind = (typeof CUSTOMER_KINDS)[number];
export const CUSTOMER_KIND_LABEL: Record<CustomerKind, string> = { subsidiary: 'Subsidiary of the group', mining_site: 'Mining site', external: 'External customer' };

/** Where the customer sheet is kept (D-16 default): read in Keystone, or a prospect created in Modulus. */
export const CUSTOMER_SOURCES = ['keystone', 'modulus'] as const;
export type CustomerSource = (typeof CUSTOMER_SOURCES)[number];

/** Sale cases (answer D-3). */
export const SALE_CASES = [1, 2, 3] as const;
export type SaleCase = (typeof SALE_CASES)[number];
export const SALE_CASE_LABEL: Record<SaleCase, string> = {
  1: 'Case 1 · the subsidiary buys and operates',
  2: 'Case 2 · mining site, subsidiary as intermediary',
  3: 'Case 3 · direct customer',
};

export const DEAL_ORIGINS = ['customer_request', 'capex_need', 'tender', 'renewal'] as const;
export type DealOrigin = (typeof DEAL_ORIGINS)[number];
export const DEAL_ORIGIN_LABEL: Record<DealOrigin, string> = {
  customer_request: 'Customer request', capex_need: 'Machine need of an Arche CAPEX', tender: 'Tender', renewal: 'Renewal',
};

export const DEAL_STATES = ['open', 'quoting', 'offer_sent', 'won', 'lost', 'abandoned'] as const;
export type DealState = (typeof DEAL_STATES)[number];
export const DEAL_STATE_LABEL: Record<DealState, string> = {
  open: 'Open', quoting: 'Quoting', offer_sent: 'Offer sent', won: 'Won', lost: 'Lost', abandoned: 'Abandoned',
};
export const ACTIVE_DEAL_STATES: readonly DealState[] = ['open', 'quoting', 'offer_sent'];
export const isActiveDeal = (s: string) => (ACTIVE_DEAL_STATES as readonly string[]).includes(s);

export const LOSS_REASONS = ['price', 'lead_time', 'technical', 'competitor', 'project_abandoned', 'other'] as const;
export type LossReason = (typeof LOSS_REASONS)[number];
export const LOSS_REASON_LABEL: Record<LossReason, string> = {
  price: 'Price', lead_time: 'Lead time', technical: 'Technical', competitor: 'Competitor', project_abandoned: 'Project abandoned', other: 'Other',
};

export const TEAM_ROLES = ['sales', 'estimator', 'engineering'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];
export const TEAM_ROLE_LABEL: Record<TeamRole, string> = { sales: 'account management', estimator: 'estimating', engineering: 'engineering' };

export const OFFER_STATES = ['draft', 'sent', 'accepted', 'declined'] as const;
export type OfferState = (typeof OFFER_STATES)[number];
export const OFFER_STATE_LABEL: Record<OfferState, string> = { draft: 'Draft', sent: 'Sent · frozen', accepted: 'Accepted', declined: 'Declined' };

export const REVIEW_DECISIONS = ['go', 'no_go'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

/** Who decided a review: the sales direction, and for a discount beyond the threshold the general management too (D-4). */
export const REVIEW_LEVELS = ['sales_director', 'general_management'] as const;
export type ReviewLevel = (typeof REVIEW_LEVELS)[number];

export const CURRENCIES = ['EUR', 'USD', 'CAD', 'AUD', 'ZAR', 'XOF', 'CLP', 'PEN', 'GBP'] as const;

// ── Quotation requests ─────────────────────────────────────────────────────────────────────────────────────────────────

export const ESTIMATE_CLASSES = ['indicative', 'quote', 'firm'] as const;
export type EstimateClass = (typeof ESTIMATE_CLASSES)[number];
export const ESTIMATE_CLASS_LABEL: Record<EstimateClass, string> = { indicative: 'indicative', quote: 'quote', firm: 'firm offer' };

export const QUOTE_ORIGINS = ['deal', 'arche'] as const;
export type QuoteOrigin = (typeof QUOTE_ORIGINS)[number];

export const QUOTE_STATES = ['qualification', 'estimating', 'answered', 'refused', 'cancelled'] as const;
export type QuoteState = (typeof QUOTE_STATES)[number];
export const QUOTE_STATE_LABEL: Record<QuoteState, string> = {
  qualification: 'qualification', estimating: 'estimating', answered: 'answered', refused: 'refused', cancelled: 'cancelled',
};
export const isOpenQuote = (s: string) => s === 'qualification' || s === 'estimating';

export const FEASIBILITIES = ['feasible', 'to_study', 'refused'] as const;
export type Feasibility = (typeof FEASIBILITIES)[number];
export const FEASIBILITY_LABEL: Record<Feasibility, string> = { feasible: 'feasible', to_study: 'to study', refused: 'refused' };

export const QUESTION_THEMES = ['need', 'product', 'performance', 'environment', 'standards', 'interfaces', 'schedule', 'attachments'] as const;
export type QuestionTheme = (typeof QUESTION_THEMES)[number];
export const QUESTION_THEME_LABEL: Record<QuestionTheme, string> = {
  need: 'Need', product: 'Product', performance: 'Performance', environment: 'Environment', standards: 'Standards and safety', interfaces: 'Interfaces',
  schedule: 'Lead time and budget', attachments: 'Attachments',
};

export const ANSWER_TYPES = ['text', 'number', 'choice', 'yes_no', 'attachment'] as const;
export type AnswerType = (typeof ANSWER_TYPES)[number];
export const ANSWER_TYPE_LABEL: Record<AnswerType, string> = { text: 'text', number: 'number', choice: 'choice', yes_no: 'yes / no', attachment: 'attachment' };

/** Family of a questionnaire (D-10): the common core, or a machine type × option category. */
export const COMMON_FAMILY = 'common';
export const familyKey = (type: string, category: string) => `${type}:${category}`;

// ── Project feedback and know-how ─────────────────────────────────────────────────────────────────────────────────────

export const FEEDBACK_STAGES = ['closure', 'warranty_end'] as const;
export type FeedbackStage = (typeof FEEDBACK_STAGES)[number];
export const FEEDBACK_STAGE_LABEL: Record<FeedbackStage, string> = { closure: 'Project closure', warranty_end: 'End of warranty' };

export const KNOWHOW_LEVELS = ['mastered', 'done', 'sold', 'quoted', 'never', 'avoid'] as const;
export type KnowhowLevel = (typeof KNOWHOW_LEVELS)[number];
export const KNOWHOW_LEVEL_LABEL: Record<KnowhowLevel, string> = {
  mastered: 'Mastered', done: 'Done before', sold: 'Sold, not delivered yet', quoted: 'Quoted, never sold', never: 'Never done', avoid: 'To avoid',
};

export const KNOWHOW_NOTE_KINDS = ['note', 'avoid', 'clear_avoid'] as const;
export type KnowhowNoteKind = (typeof KNOWHOW_NOTE_KINDS)[number];

// ── Formats (database CHECK and form validation) ────────────────────────────────────────────────────────────────────

export const FORMATS = {
  typeCode: /^[A-Z]{2,8}$/,
  machineCode: /^[A-Z]{2,8}-[0-9A-Z]{1,8}$/,
  optionCode: /^(OPT-[A-Z]{3}-[0-9]{2}|SPE-[0-9]{4}-[0-9]{4})$/,
  article: /^ART-[0-9]{6}$/,
  priceList: /^GRILLE-[0-9]{4}(-[A-Z0-9]{1,8})?$/,
  dealRef: /^AF-[0-9]{4}-[0-9]{4}$/,
  quoteRef: /^DC-[0-9]{4}-[0-9]{4}$/,
  soldRef: /^CV-[0-9]{4}-[0-9]{4}$/,
  capexNeed: /^CPX-[0-9]{4}-[0-9]{3}\/B[0-9]{2}$/,
  customerCode: /^[A-Z0-9][A-Z0-9-]{1,23}$/,
  country: /^[A-Z]{2}$/,
  characteristicKey: /^[a-z][a-z0-9_]{1,31}$/,
  keystoneProject: /^[A-Z0-9][A-Z0-9-]{1,31}$/,
  codexRef: /^[A-Z0-9][A-Z0-9._-]{2,63}$/,
} as const;

/** The same formats as PostgreSQL regular expressions (POSIX ERE, no lookahead). */
export const PG_FORMATS: Record<keyof typeof FORMATS, string> = Object.fromEntries(
  Object.entries(FORMATS).map(([k, re]) => [k, re.source]),
) as Record<keyof typeof FORMATS, string>;
