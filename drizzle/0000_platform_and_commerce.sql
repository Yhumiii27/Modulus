CREATE TABLE "modulus"."app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_name" text NOT NULL,
	CONSTRAINT "app_settings_key_check" CHECK ("modulus"."app_settings"."key" ~ '^[a-z][a-z0-9_.-]{1,63}$')
);
--> statement-breakpoint
CREATE TABLE "modulus"."audit_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"actor_user_id" uuid,
	"actor_name" text NOT NULL,
	"actor_role" text,
	"object_ref" text NOT NULL,
	"change" text NOT NULL,
	"area" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	CONSTRAINT "audit_entries_text_check" CHECK (btrim("modulus"."audit_entries"."actor_name") <> '' and btrim("modulus"."audit_entries"."object_ref") <> '' and btrim("modulus"."audit_entries"."change") <> '' and btrim("modulus"."audit_entries"."area") <> '')
);
--> statement-breakpoint
CREATE TABLE "modulus"."counters" (
	"prefix" text NOT NULL,
	"year" integer NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "counters_prefix_year_pk" PRIMARY KEY("prefix","year"),
	CONSTRAINT "counters_prefix_check" CHECK ("modulus"."counters"."prefix" in ('AF', 'DC', 'CV')),
	CONSTRAINT "counters_values_check" CHECK ("modulus"."counters"."year" between 2000 and 2999 and "modulus"."counters"."value" between 0 and 9999)
);
--> statement-breakpoint
CREATE TABLE "modulus"."job_runs" (
	"name" text PRIMARY KEY NOT NULL,
	"lease_until" timestamp with time zone,
	"last_started_at" timestamp with time zone,
	"last_finished_at" timestamp with time zone,
	"last_status" text,
	"last_error" text,
	CONSTRAINT "job_runs_status_check" CHECK ("modulus"."job_runs"."last_status" is null or "modulus"."job_runs"."last_status" in ('ok', 'error'))
);
--> statement-breakpoint
CREATE TABLE "modulus"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"oid" text,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sign_in_at" timestamp with time zone,
	CONSTRAINT "users_oid_unique" UNIQUE("oid"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_email_check" CHECK ("modulus"."users"."email" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and "modulus"."users"."email" = lower("modulus"."users"."email")),
	CONSTRAINT "users_name_check" CHECK (btrim("modulus"."users"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "modulus"."article_prices" (
	"article" text PRIMARY KEY NOT NULL,
	"unit_price_keur" double precision NOT NULL,
	"on" date NOT NULL,
	"source" text DEFAULT 'simulation' NOT NULL,
	CONSTRAINT "article_prices_article_check" CHECK ("modulus"."article_prices"."article" ~ '^ART-[0-9]{6}$'),
	CONSTRAINT "article_prices_price_check" CHECK ("modulus"."article_prices"."unit_price_keur" >= 0),
	CONSTRAINT "article_prices_source_check" CHECK ("modulus"."article_prices"."source" in ('simulation', 'keystone'))
);
--> statement-breakpoint
CREATE TABLE "modulus"."bom_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"subassembly" text NOT NULL,
	"mark" text NOT NULL,
	"article" text NOT NULL,
	"designation" text NOT NULL,
	"quantity" double precision NOT NULL,
	"unit" text NOT NULL,
	CONSTRAINT "bom_lines_article_check" CHECK ("modulus"."bom_lines"."article" ~ '^ART-[0-9]{6}$'),
	CONSTRAINT "bom_lines_text_check" CHECK (btrim("modulus"."bom_lines"."subassembly") <> '' and btrim("modulus"."bom_lines"."mark") <> '' and btrim("modulus"."bom_lines"."designation") <> ''),
	CONSTRAINT "bom_lines_quantity_check" CHECK ("modulus"."bom_lines"."quantity" > 0),
	CONSTRAINT "bom_lines_unit_check" CHECK ("modulus"."bom_lines"."unit" in ('u', 'lot', 'm', 'kg', 'l', 'h'))
);
--> statement-breakpoint
CREATE TABLE "modulus"."characteristic_defs" (
	"type_code" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"unit" text,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "characteristic_defs_type_code_key_pk" PRIMARY KEY("type_code","key"),
	CONSTRAINT "characteristic_defs_key_check" CHECK ("modulus"."characteristic_defs"."key" ~ '^[a-z][a-z0-9_]{1,31}$'),
	CONSTRAINT "characteristic_defs_label_check" CHECK (btrim("modulus"."characteristic_defs"."label") <> ''),
	CONSTRAINT "characteristic_defs_position_check" CHECK ("modulus"."characteristic_defs"."position" between 0 and 999)
);
--> statement-breakpoint
CREATE TABLE "modulus"."cost_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"machine_version_id" uuid,
	"option_id" uuid,
	"post" text NOT NULL,
	"entered_keur" double precision NOT NULL,
	"hours" double precision,
	"basis" text,
	"updated_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cost_budgets_subject_check" CHECK (("modulus"."cost_budgets"."machine_version_id" is null) <> ("modulus"."cost_budgets"."option_id" is null)),
	CONSTRAINT "cost_budgets_post_check" CHECK ("modulus"."cost_budgets"."post" in ('material', 'subcontracting', 'engineering_hours', 'workshop_hours', 'site_hours', 'expenses')),
	CONSTRAINT "cost_budgets_values_check" CHECK ("modulus"."cost_budgets"."entered_keur" >= 0 and ("modulus"."cost_budgets"."hours" is null or "modulus"."cost_budgets"."hours" >= 0)),
	CONSTRAINT "cost_budgets_hours_check" CHECK ("modulus"."cost_budgets"."hours" is null or "modulus"."cost_budgets"."post" in ('engineering_hours', 'workshop_hours', 'site_hours'))
);
--> statement-breakpoint
CREATE TABLE "modulus"."machine_types" (
	"code" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"deposit_pct" integer DEFAULT 30 NOT NULL,
	"delivery_pct" integer DEFAULT 60 NOT NULL,
	"acceptance_pct" integer DEFAULT 10 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "machine_types_code_check" CHECK ("modulus"."machine_types"."code" ~ '^[A-Z]{2,8}$'),
	CONSTRAINT "machine_types_label_check" CHECK (btrim("modulus"."machine_types"."label") <> ''),
	CONSTRAINT "machine_types_payment_check" CHECK ("modulus"."machine_types"."deposit_pct" between 0 and 100 and "modulus"."machine_types"."delivery_pct" between 0 and 100 and "modulus"."machine_types"."acceptance_pct" between 0 and 100 and "modulus"."machine_types"."deposit_pct" + "modulus"."machine_types"."delivery_pct" + "modulus"."machine_types"."acceptance_pct" = 100)
);
--> statement-breakpoint
CREATE TABLE "modulus"."machine_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"machine_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"label" text NOT NULL,
	"variant" text,
	"description" text,
	"nominal_capacity" double precision NOT NULL,
	"capacity_unit" text NOT NULL,
	"lead_weeks" integer NOT NULL,
	"datasheet_ref" text,
	"note" text,
	"created_by_name" text NOT NULL,
	"published_at" timestamp with time zone,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "machine_versions_version_check" CHECK ("modulus"."machine_versions"."version" between 1 and 999),
	CONSTRAINT "machine_versions_state_check" CHECK ("modulus"."machine_versions"."state" in ('draft', 'published', 'retired')),
	CONSTRAINT "machine_versions_label_check" CHECK (btrim("modulus"."machine_versions"."label") <> '' and btrim("modulus"."machine_versions"."capacity_unit") <> ''),
	CONSTRAINT "machine_versions_values_check" CHECK ("modulus"."machine_versions"."nominal_capacity" > 0 and "modulus"."machine_versions"."lead_weeks" between 1 and 260),
	CONSTRAINT "machine_versions_datasheet_check" CHECK ("modulus"."machine_versions"."datasheet_ref" is null or "modulus"."machine_versions"."datasheet_ref" ~ '^[A-Z0-9][A-Z0-9._-]{2,63}$'),
	CONSTRAINT "machine_versions_dates_check" CHECK (("modulus"."machine_versions"."state" = 'draft') = ("modulus"."machine_versions"."published_at" is null) and ("modulus"."machine_versions"."state" = 'retired') = ("modulus"."machine_versions"."retired_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "modulus"."machines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"type_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "machines_code_unique" UNIQUE("code"),
	CONSTRAINT "machines_code_check" CHECK ("modulus"."machines"."code" ~ '^[A-Z]{2,8}-[0-9A-Z]{1,8}$')
);
--> statement-breakpoint
CREATE TABLE "modulus"."option_bom_deltas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"option_id" uuid NOT NULL,
	"op" text NOT NULL,
	"article" text NOT NULL,
	"designation" text NOT NULL,
	"quantity" double precision,
	"unit" text,
	"replaces" text,
	CONSTRAINT "option_bom_deltas_op_check" CHECK ("modulus"."option_bom_deltas"."op" in ('add', 'remove', 'replace')),
	CONSTRAINT "option_bom_deltas_article_check" CHECK ("modulus"."option_bom_deltas"."article" ~ '^ART-[0-9]{6}$' and ("modulus"."option_bom_deltas"."replaces" is null or "modulus"."option_bom_deltas"."replaces" ~ '^ART-[0-9]{6}$')),
	CONSTRAINT "option_bom_deltas_designation_check" CHECK (btrim("modulus"."option_bom_deltas"."designation") <> ''),
	CONSTRAINT "option_bom_deltas_shape_check" CHECK (("modulus"."option_bom_deltas"."op" = 'remove' and "modulus"."option_bom_deltas"."quantity" is null and "modulus"."option_bom_deltas"."replaces" is null)
    or ("modulus"."option_bom_deltas"."op" = 'add' and "modulus"."option_bom_deltas"."quantity" > 0 and "modulus"."option_bom_deltas"."unit" is not null and "modulus"."option_bom_deltas"."replaces" is null)
    or ("modulus"."option_bom_deltas"."op" = 'replace' and "modulus"."option_bom_deltas"."quantity" > 0 and "modulus"."option_bom_deltas"."unit" is not null and "modulus"."option_bom_deltas"."replaces" is not null)),
	CONSTRAINT "option_bom_deltas_unit_check" CHECK ("modulus"."option_bom_deltas"."unit" is null or "modulus"."option_bom_deltas"."unit" in ('u', 'lot', 'm', 'kg', 'l', 'h'))
);
--> statement-breakpoint
CREATE TABLE "modulus"."option_machines" (
	"option_id" uuid NOT NULL,
	"machine_id" uuid NOT NULL,
	CONSTRAINT "option_machines_option_id_machine_id_pk" PRIMARY KEY("option_id","machine_id")
);
--> statement-breakpoint
CREATE TABLE "modulus"."option_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"option_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"target_option_id" uuid,
	"condition_key" text,
	"condition_op" text,
	"condition_value" double precision,
	"explanation" text NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "option_rules_kind_check" CHECK ("modulus"."option_rules"."kind" in ('excludes', 'requires', 'mandatory_if', 'one_of')),
	CONSTRAINT "option_rules_shape_check" CHECK (("modulus"."option_rules"."kind" = 'mandatory_if' and "modulus"."option_rules"."target_option_id" is null and "modulus"."option_rules"."condition_key" is not null and "modulus"."option_rules"."condition_op" is not null and "modulus"."option_rules"."condition_value" is not null)
    or ("modulus"."option_rules"."kind" <> 'mandatory_if' and "modulus"."option_rules"."target_option_id" is not null and "modulus"."option_rules"."target_option_id" <> "modulus"."option_rules"."option_id" and "modulus"."option_rules"."condition_key" is null and "modulus"."option_rules"."condition_op" is null and "modulus"."option_rules"."condition_value" is null)),
	CONSTRAINT "option_rules_op_check" CHECK ("modulus"."option_rules"."condition_op" is null or "modulus"."option_rules"."condition_op" in ('>=', '<=', '=')),
	CONSTRAINT "option_rules_key_check" CHECK ("modulus"."option_rules"."condition_key" is null or "modulus"."option_rules"."condition_key" ~ '^[a-z][a-z0-9_]{1,31}$'),
	CONSTRAINT "option_rules_explanation_check" CHECK (btrim("modulus"."option_rules"."explanation") <> '')
);
--> statement-breakpoint
CREATE TABLE "modulus"."options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"origin" text DEFAULT 'catalogue' NOT NULL,
	"quote_request_id" uuid,
	"extra_weeks" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "options_code_unique" UNIQUE("code"),
	CONSTRAINT "options_code_check" CHECK ("modulus"."options"."code" ~ '^(OPT-[A-Z]{3}-[0-9]{2}|SPE-[0-9]{4}-[0-9]{4})$'),
	CONSTRAINT "options_label_check" CHECK (btrim("modulus"."options"."label") <> ''),
	CONSTRAINT "options_category_check" CHECK ("modulus"."options"."category" in ('capacity', 'automation', 'safety', 'environment', 'comfort', 'service', 'other')),
	CONSTRAINT "options_origin_check" CHECK ("modulus"."options"."origin" in ('catalogue', 'specific')),
	CONSTRAINT "options_specific_check" CHECK (("modulus"."options"."origin" = 'specific') = ("modulus"."options"."quote_request_id" is not null) and ("modulus"."options"."origin" = 'specific') = ("modulus"."options"."code" like 'SPE-%')),
	CONSTRAINT "options_weeks_check" CHECK ("modulus"."options"."extra_weeks" between 0 and 104)
);
--> statement-breakpoint
CREATE TABLE "modulus"."price_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"price_list_id" uuid NOT NULL,
	"machine_id" uuid,
	"option_id" uuid,
	"sale_keur" double precision NOT NULL,
	CONSTRAINT "price_list_items_subject_check" CHECK (("modulus"."price_list_items"."machine_id" is null) <> ("modulus"."price_list_items"."option_id" is null)),
	CONSTRAINT "price_list_items_price_check" CHECK ("modulus"."price_list_items"."sale_keur" > 0)
);
--> statement-breakpoint
CREATE TABLE "modulus"."price_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"max_discount_pct" double precision DEFAULT 10 NOT NULL,
	"proposed_by_name" text NOT NULL,
	"validated_by_name" text,
	"validated_at" timestamp with time zone,
	"confirmed_by_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_lists_code_unique" UNIQUE("code"),
	CONSTRAINT "price_lists_code_check" CHECK ("modulus"."price_lists"."code" ~ '^GRILLE-[0-9]{4}(-[A-Z0-9]{1,8})?$'),
	CONSTRAINT "price_lists_dates_check" CHECK ("modulus"."price_lists"."valid_from" <= "modulus"."price_lists"."valid_to"),
	CONSTRAINT "price_lists_currency_check" CHECK ("modulus"."price_lists"."currency" = 'EUR'),
	CONSTRAINT "price_lists_state_check" CHECK ("modulus"."price_lists"."state" in ('draft', 'to_validate', 'published', 'withdrawn')),
	CONSTRAINT "price_lists_discount_check" CHECK ("modulus"."price_lists"."max_discount_pct" between 0 and 50),
	CONSTRAINT "price_lists_validated_check" CHECK (("modulus"."price_lists"."state" in ('published', 'withdrawn')) = ("modulus"."price_lists"."validated_at" is not null and "modulus"."price_lists"."validated_by_name" is not null))
);
--> statement-breakpoint
CREATE TABLE "modulus"."version_characteristics" (
	"version_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "version_characteristics_version_id_key_pk" PRIMARY KEY("version_id","key"),
	CONSTRAINT "version_characteristics_key_check" CHECK ("modulus"."version_characteristics"."key" ~ '^[a-z][a-z0-9_]{1,31}$'),
	CONSTRAINT "version_characteristics_value_check" CHECK (btrim("modulus"."version_characteristics"."value") <> '')
);
--> statement-breakpoint
CREATE TABLE "modulus"."customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"country" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_code_unique" UNIQUE("code"),
	CONSTRAINT "customers_code_check" CHECK ("modulus"."customers"."code" ~ '^[A-Z0-9][A-Z0-9-]{1,23}$'),
	CONSTRAINT "customers_name_check" CHECK (btrim("modulus"."customers"."name") <> ''),
	CONSTRAINT "customers_kind_check" CHECK ("modulus"."customers"."kind" in ('subsidiary', 'mining_site', 'external')),
	CONSTRAINT "customers_country_check" CHECK ("modulus"."customers"."country" ~ '^[A-Z]{2}$'),
	CONSTRAINT "customers_source_check" CHECK ("modulus"."customers"."source" in ('keystone', 'modulus'))
);
--> statement-breakpoint
CREATE TABLE "modulus"."deal_line_options" (
	"line_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	CONSTRAINT "deal_line_options_line_id_option_id_pk" PRIMARY KEY("line_id","option_id")
);
--> statement-breakpoint
CREATE TABLE "modulus"."deal_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"machine_version_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deal_lines_values_check" CHECK ("modulus"."deal_lines"."number" between 1 and 99 and "modulus"."deal_lines"."quantity" between 1 and 50)
);
--> statement-breakpoint
CREATE TABLE "modulus"."deal_members" (
	"deal_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"user_name" text NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "deal_members_deal_id_user_id_pk" PRIMARY KEY("deal_id","user_id"),
	CONSTRAINT "deal_members_role_check" CHECK ("modulus"."deal_members"."role" in ('sales', 'estimator', 'engineering')),
	CONSTRAINT "deal_members_name_check" CHECK (btrim("modulus"."deal_members"."user_name") <> '')
);
--> statement-breakpoint
CREATE TABLE "modulus"."deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"sale_case" integer NOT NULL,
	"customer_id" uuid NOT NULL,
	"intermediary_id" uuid,
	"capex_need" text,
	"delivery_site" text NOT NULL,
	"origin" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"owner_name" text NOT NULL,
	"need" text NOT NULL,
	"wished_for" text,
	"customer_budget_keur" double precision,
	"state" text DEFAULT 'open' NOT NULL,
	"probability" integer NOT NULL,
	"loss_reason" text,
	"loss_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deals_ref_unique" UNIQUE("ref"),
	CONSTRAINT "deals_ref_check" CHECK ("modulus"."deals"."ref" ~ '^AF-[0-9]{4}-[0-9]{4}$'),
	CONSTRAINT "deals_case_check" CHECK ("modulus"."deals"."sale_case" in (1, 2, 3)),
	CONSTRAINT "deals_case_shape_check" CHECK (("modulus"."deals"."sale_case" = 2) = ("modulus"."deals"."intermediary_id" is not null) and ("modulus"."deals"."sale_case" = 1 or "modulus"."deals"."capex_need" is null)),
	CONSTRAINT "deals_capex_check" CHECK ("modulus"."deals"."capex_need" is null or "modulus"."deals"."capex_need" ~ '^CPX-[0-9]{4}-[0-9]{3}\/B[0-9]{2}$'),
	CONSTRAINT "deals_text_check" CHECK (btrim("modulus"."deals"."delivery_site") <> '' and btrim("modulus"."deals"."need") <> '' and btrim("modulus"."deals"."owner_name") <> ''),
	CONSTRAINT "deals_origin_check" CHECK ("modulus"."deals"."origin" in ('customer_request', 'capex_need', 'tender', 'renewal')),
	CONSTRAINT "deals_origin_capex_check" CHECK (("modulus"."deals"."origin" = 'capex_need') = ("modulus"."deals"."capex_need" is not null)),
	CONSTRAINT "deals_state_check" CHECK ("modulus"."deals"."state" in ('open', 'quoting', 'offer_sent', 'won', 'lost', 'abandoned')),
	CONSTRAINT "deals_probability_check" CHECK ("modulus"."deals"."probability" between 0 and 100 and ("modulus"."deals"."state" <> 'won' or "modulus"."deals"."probability" = 100) and ("modulus"."deals"."state" not in ('lost', 'abandoned') or "modulus"."deals"."probability" = 0)),
	CONSTRAINT "deals_loss_check" CHECK (("modulus"."deals"."state" in ('lost', 'abandoned')) = ("modulus"."deals"."loss_reason" is not null) and ("modulus"."deals"."loss_reason" is null or "modulus"."deals"."loss_reason" in ('price', 'lead_time', 'technical', 'competitor', 'project_abandoned', 'other'))),
	CONSTRAINT "deals_budget_check" CHECK ("modulus"."deals"."customer_budget_keur" is null or "modulus"."deals"."customer_budget_keur" > 0)
);
--> statement-breakpoint
CREATE TABLE "modulus"."feedback_options" (
	"feedback_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"delivered" boolean NOT NULL,
	"budget_keur" double precision NOT NULL,
	"actual_keur" double precision,
	CONSTRAINT "feedback_options_feedback_id_option_id_pk" PRIMARY KEY("feedback_id","option_id"),
	CONSTRAINT "feedback_options_values_check" CHECK ("modulus"."feedback_options"."budget_keur" >= 0 and ("modulus"."feedback_options"."actual_keur" is null or "modulus"."feedback_options"."actual_keur" >= 0) and ("modulus"."feedback_options"."delivered" or "modulus"."feedback_options"."actual_keur" is null))
);
--> statement-breakpoint
CREATE TABLE "modulus"."knowhow_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"option_id" uuid NOT NULL,
	"machine_id" uuid,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"author_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowhow_notes_kind_check" CHECK ("modulus"."knowhow_notes"."kind" in ('note', 'avoid', 'clear_avoid')),
	CONSTRAINT "knowhow_notes_text_check" CHECK (btrim("modulus"."knowhow_notes"."body") <> '' and btrim("modulus"."knowhow_notes"."author_name") <> '')
);
--> statement-breakpoint
CREATE TABLE "modulus"."offer_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"level" text NOT NULL,
	"decision" text NOT NULL,
	"comment" text,
	"checks" jsonb NOT NULL,
	"decided_by_id" uuid NOT NULL,
	"decided_by_name" text NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offer_reviews_level_check" CHECK ("modulus"."offer_reviews"."level" in ('sales_director', 'general_management')),
	CONSTRAINT "offer_reviews_decision_check" CHECK ("modulus"."offer_reviews"."decision" in ('go', 'no_go')),
	CONSTRAINT "offer_reviews_nogo_check" CHECK ("modulus"."offer_reviews"."decision" = 'go' or btrim(coalesce("modulus"."offer_reviews"."comment", '')) <> '')
);
--> statement-breakpoint
CREATE TABLE "modulus"."offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"letter" text NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"discount_pct" double precision DEFAULT 0 NOT NULL,
	"validity_days" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"rate" double precision,
	"assumptions" text,
	"reservations" text,
	"note" text,
	"content" jsonb,
	"total_sale_keur" double precision,
	"total_budget_keur" double precision,
	"lead_weeks" integer,
	"sent_on" date,
	"sent_by_name" text,
	"codex_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offers_letter_check" CHECK ("modulus"."offers"."letter" ~ '^[A-Z]$'),
	CONSTRAINT "offers_state_check" CHECK ("modulus"."offers"."state" in ('draft', 'sent', 'accepted', 'declined')),
	CONSTRAINT "offers_discount_check" CHECK ("modulus"."offers"."discount_pct" between 0 and 50),
	CONSTRAINT "offers_validity_check" CHECK ("modulus"."offers"."validity_days" between 1 and 365),
	CONSTRAINT "offers_currency_check" CHECK ("modulus"."offers"."currency" ~ '^[A-Z]{3}$' and (("modulus"."offers"."state" = 'draft' and "modulus"."offers"."rate" is null) or ("modulus"."offers"."state" <> 'draft' and ("modulus"."offers"."currency" = 'EUR') = ("modulus"."offers"."rate" is null))) and ("modulus"."offers"."rate" is null or "modulus"."offers"."rate" > 0)),
	CONSTRAINT "offers_frozen_shape_check" CHECK (("modulus"."offers"."state" = 'draft') = ("modulus"."offers"."content" is null) and ("modulus"."offers"."state" = 'draft') = ("modulus"."offers"."sent_on" is null)
    and ("modulus"."offers"."state" = 'draft') = ("modulus"."offers"."total_sale_keur" is null) and ("modulus"."offers"."state" = 'draft') = ("modulus"."offers"."sent_by_name" is null) and ("modulus"."offers"."state" = 'draft') = ("modulus"."offers"."lead_weeks" is null)),
	CONSTRAINT "offers_totals_check" CHECK (("modulus"."offers"."total_sale_keur" is null or "modulus"."offers"."total_sale_keur" > 0) and ("modulus"."offers"."total_budget_keur" is null or "modulus"."offers"."total_budget_keur" >= 0)),
	CONSTRAINT "offers_codex_check" CHECK ("modulus"."offers"."codex_ref" is null or "modulus"."offers"."codex_ref" ~ '^[A-Z0-9][A-Z0-9._-]{2,63}$')
);
--> statement-breakpoint
CREATE TABLE "modulus"."outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target" text NOT NULL,
	"kind" text NOT NULL,
	"object_ref" text NOT NULL,
	"payload" jsonb NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"result_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "outbox_target_check" CHECK ("modulus"."outbox"."target" in ('codex')),
	CONSTRAINT "outbox_kind_check" CHECK ("modulus"."outbox"."kind" in ('offer_pdf', 'questionnaire_pdf')),
	CONSTRAINT "outbox_state_check" CHECK ("modulus"."outbox"."state" in ('pending', 'sent', 'failed')),
	CONSTRAINT "outbox_sent_check" CHECK (("modulus"."outbox"."state" = 'sent') = ("modulus"."outbox"."sent_at" is not null)),
	CONSTRAINT "outbox_ref_check" CHECK (btrim("modulus"."outbox"."object_ref") <> '')
);
--> statement-breakpoint
CREATE TABLE "modulus"."project_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sold_ref" text NOT NULL,
	"stage" text NOT NULL,
	"received_on" date NOT NULL,
	"material_keur" double precision NOT NULL,
	"subcontracting_keur" double precision NOT NULL,
	"engineering_keur" double precision NOT NULL,
	"workshop_keur" double precision NOT NULL,
	"site_keur" double precision NOT NULL,
	"expenses_keur" double precision NOT NULL,
	"engineering_hours" double precision NOT NULL,
	"workshop_hours" double precision NOT NULL,
	"site_hours" double precision NOT NULL,
	"rex_ref" text,
	"rex_summary" text,
	"major_difficulty" boolean DEFAULT false NOT NULL,
	"source" text NOT NULL,
	"recorded_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_feedback_ref_check" CHECK ("modulus"."project_feedback"."sold_ref" ~ '^CV-[0-9]{4}-[0-9]{4}$'),
	CONSTRAINT "project_feedback_stage_check" CHECK ("modulus"."project_feedback"."stage" in ('closure', 'warranty_end')),
	CONSTRAINT "project_feedback_values_check" CHECK ("modulus"."project_feedback"."material_keur" >= 0 and "modulus"."project_feedback"."subcontracting_keur" >= 0 and "modulus"."project_feedback"."engineering_keur" >= 0 and "modulus"."project_feedback"."workshop_keur" >= 0
    and "modulus"."project_feedback"."site_keur" >= 0 and "modulus"."project_feedback"."expenses_keur" >= 0 and "modulus"."project_feedback"."engineering_hours" >= 0 and "modulus"."project_feedback"."workshop_hours" >= 0 and "modulus"."project_feedback"."site_hours" >= 0),
	CONSTRAINT "project_feedback_source_check" CHECK ("modulus"."project_feedback"."source" in ('keystone', 'entered'))
);
--> statement-breakpoint
CREATE TABLE "modulus"."questionnaires" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family" text NOT NULL,
	"label" text NOT NULL,
	"version" integer NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questionnaires_family_check" CHECK ("modulus"."questionnaires"."family" = 'common' or "modulus"."questionnaires"."family" ~ '^[A-Z]{2,8}:(capacity|automation|safety|environment|comfort|service|other)$'),
	CONSTRAINT "questionnaires_label_check" CHECK (btrim("modulus"."questionnaires"."label") <> ''),
	CONSTRAINT "questionnaires_state_check" CHECK ("modulus"."questionnaires"."state" in ('draft', 'published', 'retired')),
	CONSTRAINT "questionnaires_version_check" CHECK ("modulus"."questionnaires"."version" between 1 and 999 and ("modulus"."questionnaires"."state" = 'draft') = ("modulus"."questionnaires"."published_at" is null))
);
--> statement-breakpoint
CREATE TABLE "modulus"."questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"questionnaire_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"theme" text NOT NULL,
	"text" text NOT NULL,
	"answer_type" text NOT NULL,
	"unit" text,
	"choices" text,
	"required" boolean DEFAULT false NOT NULL,
	CONSTRAINT "questions_position_check" CHECK ("modulus"."questions"."position" between 1 and 999),
	CONSTRAINT "questions_theme_check" CHECK ("modulus"."questions"."theme" in ('need', 'product', 'performance', 'environment', 'standards', 'interfaces', 'schedule', 'attachments')),
	CONSTRAINT "questions_text_check" CHECK (btrim("modulus"."questions"."text") <> ''),
	CONSTRAINT "questions_type_check" CHECK ("modulus"."questions"."answer_type" in ('text', 'number', 'choice', 'yes_no', 'attachment')),
	CONSTRAINT "questions_choices_check" CHECK (("modulus"."questions"."answer_type" = 'choice') = ("modulus"."questions"."choices" is not null and btrim("modulus"."questions"."choices") <> ''))
);
--> statement-breakpoint
CREATE TABLE "modulus"."quote_answers" (
	"request_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"value" text NOT NULL,
	"entered_by_name" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_answers_request_id_question_id_pk" PRIMARY KEY("request_id","question_id"),
	CONSTRAINT "quote_answers_value_check" CHECK (btrim("modulus"."quote_answers"."value") <> '')
);
--> statement-breakpoint
CREATE TABLE "modulus"."quote_bom_deltas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"op" text NOT NULL,
	"article" text NOT NULL,
	"designation" text NOT NULL,
	"quantity" double precision NOT NULL,
	"unit" text NOT NULL,
	CONSTRAINT "quote_bom_deltas_op_check" CHECK ("modulus"."quote_bom_deltas"."op" in ('add', 'remove', 'replace')),
	CONSTRAINT "quote_bom_deltas_article_check" CHECK ("modulus"."quote_bom_deltas"."article" ~ '^ART-[0-9]{6}$'),
	CONSTRAINT "quote_bom_deltas_designation_check" CHECK (btrim("modulus"."quote_bom_deltas"."designation") <> ''),
	CONSTRAINT "quote_bom_deltas_quantity_check" CHECK ("modulus"."quote_bom_deltas"."quantity" > 0),
	CONSTRAINT "quote_bom_deltas_unit_check" CHECK ("modulus"."quote_bom_deltas"."unit" in ('u', 'lot', 'm', 'kg', 'l', 'h'))
);
--> statement-breakpoint
CREATE TABLE "modulus"."quote_estimates" (
	"request_id" uuid PRIMARY KEY NOT NULL,
	"material_keur" double precision NOT NULL,
	"subcontracting_keur" double precision NOT NULL,
	"engineering_hours" double precision NOT NULL,
	"workshop_hours" double precision NOT NULL,
	"site_hours" double precision NOT NULL,
	"expenses_keur" double precision NOT NULL,
	"sale_keur" double precision NOT NULL,
	"extra_weeks" integer NOT NULL,
	"validity_days" integer NOT NULL,
	"assumptions" text,
	"estimated_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_estimates_values_check" CHECK ("modulus"."quote_estimates"."material_keur" >= 0 and "modulus"."quote_estimates"."subcontracting_keur" >= 0 and "modulus"."quote_estimates"."engineering_hours" >= 0 and "modulus"."quote_estimates"."workshop_hours" >= 0
    and "modulus"."quote_estimates"."site_hours" >= 0 and "modulus"."quote_estimates"."expenses_keur" >= 0 and "modulus"."quote_estimates"."sale_keur" > 0 and "modulus"."quote_estimates"."extra_weeks" between 0 and 104 and "modulus"."quote_estimates"."validity_days" between 1 and 365)
);
--> statement-breakpoint
CREATE TABLE "modulus"."quote_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_messages_text_check" CHECK (btrim("modulus"."quote_messages"."author_name") <> '' and btrim("modulus"."quote_messages"."body") <> '')
);
--> statement-breakpoint
CREATE TABLE "modulus"."quote_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"title" text NOT NULL,
	"origin" text NOT NULL,
	"deal_id" uuid,
	"capex_need" text,
	"machine_id" uuid NOT NULL,
	"category" text NOT NULL,
	"estimate_class" text NOT NULL,
	"received_on" date NOT NULL,
	"target_days" integer NOT NULL,
	"state" text DEFAULT 'qualification' NOT NULL,
	"followed_by_id" uuid NOT NULL,
	"followed_by_name" text NOT NULL,
	"common_questionnaire_id" uuid NOT NULL,
	"family_questionnaire_id" uuid,
	"feasibility" text,
	"proposed_level" text,
	"qualification_note" text,
	"qualified_by_name" text,
	"qualified_on" date,
	"answered_on" date,
	"answered_by_name" text,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_requests_ref_unique" UNIQUE("ref"),
	CONSTRAINT "quote_requests_ref_check" CHECK ("modulus"."quote_requests"."ref" ~ '^DC-[0-9]{4}-[0-9]{4}$'),
	CONSTRAINT "quote_requests_title_check" CHECK (btrim("modulus"."quote_requests"."title") <> '' and btrim("modulus"."quote_requests"."followed_by_name") <> ''),
	CONSTRAINT "quote_requests_origin_check" CHECK ("modulus"."quote_requests"."origin" in ('deal', 'arche')),
	CONSTRAINT "quote_requests_origin_shape_check" CHECK (("modulus"."quote_requests"."origin" = 'deal' and "modulus"."quote_requests"."deal_id" is not null) or ("modulus"."quote_requests"."origin" = 'arche' and "modulus"."quote_requests"."capex_need" is not null)),
	CONSTRAINT "quote_requests_capex_check" CHECK ("modulus"."quote_requests"."capex_need" is null or "modulus"."quote_requests"."capex_need" ~ '^CPX-[0-9]{4}-[0-9]{3}\/B[0-9]{2}$'),
	CONSTRAINT "quote_requests_category_check" CHECK ("modulus"."quote_requests"."category" in ('capacity', 'automation', 'safety', 'environment', 'comfort', 'service', 'other')),
	CONSTRAINT "quote_requests_class_check" CHECK ("modulus"."quote_requests"."estimate_class" in ('indicative', 'quote', 'firm')),
	CONSTRAINT "quote_requests_target_check" CHECK ("modulus"."quote_requests"."target_days" between 1 and 120),
	CONSTRAINT "quote_requests_state_check" CHECK ("modulus"."quote_requests"."state" in ('qualification', 'estimating', 'answered', 'refused', 'cancelled')),
	CONSTRAINT "quote_requests_feasibility_check" CHECK (("modulus"."quote_requests"."feasibility" is null or "modulus"."quote_requests"."feasibility" in ('feasible', 'to_study', 'refused'))
    and ("modulus"."quote_requests"."proposed_level" is null or "modulus"."quote_requests"."proposed_level" in ('mastered', 'done', 'sold', 'quoted', 'never', 'avoid'))
    and (("modulus"."quote_requests"."feasibility" is null) = ("modulus"."quote_requests"."qualified_on" is null)) and ("modulus"."quote_requests"."state" = 'qualification' or "modulus"."quote_requests"."state" = 'cancelled' or "modulus"."quote_requests"."feasibility" is not null)),
	CONSTRAINT "quote_requests_refused_check" CHECK ("modulus"."quote_requests"."state" <> 'refused' or btrim(coalesce("modulus"."quote_requests"."qualification_note", '')) <> ''),
	CONSTRAINT "quote_requests_answered_check" CHECK (("modulus"."quote_requests"."state" = 'answered') = ("modulus"."quote_requests"."answered_on" is not null)),
	CONSTRAINT "quote_requests_cancel_check" CHECK (("modulus"."quote_requests"."state" = 'cancelled') = ("modulus"."quote_requests"."cancel_reason" is not null and btrim("modulus"."quote_requests"."cancel_reason") <> ''))
);
--> statement-breakpoint
CREATE TABLE "modulus"."sold_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"version" integer NOT NULL,
	"deal_id" uuid NOT NULL,
	"offer_id" uuid NOT NULL,
	"ordered_on" date NOT NULL,
	"customer_order_ref" text NOT NULL,
	"amendment_reason" text,
	"content" jsonb NOT NULL,
	"total_sale_keur" double precision NOT NULL,
	"total_budget_keur" double precision NOT NULL,
	"lead_weeks" integer NOT NULL,
	"keystone_project" text,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sold_configurations_ref_check" CHECK ("modulus"."sold_configurations"."ref" ~ '^CV-[0-9]{4}-[0-9]{4}$'),
	CONSTRAINT "sold_configurations_version_check" CHECK ("modulus"."sold_configurations"."version" between 1 and 99 and ("modulus"."sold_configurations"."version" = 1) = ("modulus"."sold_configurations"."amendment_reason" is null)),
	CONSTRAINT "sold_configurations_text_check" CHECK (btrim("modulus"."sold_configurations"."customer_order_ref") <> '' and ("modulus"."sold_configurations"."amendment_reason" is null or btrim("modulus"."sold_configurations"."amendment_reason") <> '')),
	CONSTRAINT "sold_configurations_totals_check" CHECK ("modulus"."sold_configurations"."total_sale_keur" > 0 and "modulus"."sold_configurations"."total_budget_keur" >= 0 and "modulus"."sold_configurations"."lead_weeks" between 1 and 520),
	CONSTRAINT "sold_configurations_project_check" CHECK ("modulus"."sold_configurations"."keystone_project" is null or "modulus"."sold_configurations"."keystone_project" ~ '^[A-Z0-9][A-Z0-9-]{1,31}$')
);
--> statement-breakpoint
ALTER TABLE "modulus"."audit_entries" ADD CONSTRAINT "audit_entries_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "modulus"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."bom_lines" ADD CONSTRAINT "bom_lines_version_id_machine_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "modulus"."machine_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."characteristic_defs" ADD CONSTRAINT "characteristic_defs_type_code_machine_types_code_fk" FOREIGN KEY ("type_code") REFERENCES "modulus"."machine_types"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."cost_budgets" ADD CONSTRAINT "cost_budgets_machine_version_id_machine_versions_id_fk" FOREIGN KEY ("machine_version_id") REFERENCES "modulus"."machine_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."cost_budgets" ADD CONSTRAINT "cost_budgets_option_id_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "modulus"."options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."machine_versions" ADD CONSTRAINT "machine_versions_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "modulus"."machines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."machines" ADD CONSTRAINT "machines_type_code_machine_types_code_fk" FOREIGN KEY ("type_code") REFERENCES "modulus"."machine_types"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."option_bom_deltas" ADD CONSTRAINT "option_bom_deltas_option_id_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "modulus"."options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."option_machines" ADD CONSTRAINT "option_machines_option_id_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "modulus"."options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."option_machines" ADD CONSTRAINT "option_machines_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "modulus"."machines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."option_rules" ADD CONSTRAINT "option_rules_option_id_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "modulus"."options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."option_rules" ADD CONSTRAINT "option_rules_target_option_id_options_id_fk" FOREIGN KEY ("target_option_id") REFERENCES "modulus"."options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."price_list_items" ADD CONSTRAINT "price_list_items_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "modulus"."price_lists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."price_list_items" ADD CONSTRAINT "price_list_items_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "modulus"."machines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."price_list_items" ADD CONSTRAINT "price_list_items_option_id_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "modulus"."options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."version_characteristics" ADD CONSTRAINT "version_characteristics_version_id_machine_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "modulus"."machine_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."deal_line_options" ADD CONSTRAINT "deal_line_options_line_id_deal_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "modulus"."deal_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."deal_line_options" ADD CONSTRAINT "deal_line_options_option_id_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "modulus"."options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."deal_lines" ADD CONSTRAINT "deal_lines_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "modulus"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."deal_lines" ADD CONSTRAINT "deal_lines_machine_version_id_machine_versions_id_fk" FOREIGN KEY ("machine_version_id") REFERENCES "modulus"."machine_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."deal_members" ADD CONSTRAINT "deal_members_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "modulus"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."deal_members" ADD CONSTRAINT "deal_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "modulus"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."deals" ADD CONSTRAINT "deals_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "modulus"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."deals" ADD CONSTRAINT "deals_intermediary_id_customers_id_fk" FOREIGN KEY ("intermediary_id") REFERENCES "modulus"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."deals" ADD CONSTRAINT "deals_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "modulus"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."feedback_options" ADD CONSTRAINT "feedback_options_feedback_id_project_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "modulus"."project_feedback"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."feedback_options" ADD CONSTRAINT "feedback_options_option_id_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "modulus"."options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."knowhow_notes" ADD CONSTRAINT "knowhow_notes_option_id_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "modulus"."options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."knowhow_notes" ADD CONSTRAINT "knowhow_notes_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "modulus"."machines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."offer_reviews" ADD CONSTRAINT "offer_reviews_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "modulus"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."offer_reviews" ADD CONSTRAINT "offer_reviews_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "modulus"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."offers" ADD CONSTRAINT "offers_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "modulus"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."questions" ADD CONSTRAINT "questions_questionnaire_id_questionnaires_id_fk" FOREIGN KEY ("questionnaire_id") REFERENCES "modulus"."questionnaires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."quote_answers" ADD CONSTRAINT "quote_answers_request_id_quote_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "modulus"."quote_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."quote_answers" ADD CONSTRAINT "quote_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "modulus"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."quote_bom_deltas" ADD CONSTRAINT "quote_bom_deltas_request_id_quote_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "modulus"."quote_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."quote_estimates" ADD CONSTRAINT "quote_estimates_request_id_quote_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "modulus"."quote_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."quote_messages" ADD CONSTRAINT "quote_messages_request_id_quote_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "modulus"."quote_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."quote_requests" ADD CONSTRAINT "quote_requests_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "modulus"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."quote_requests" ADD CONSTRAINT "quote_requests_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "modulus"."machines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."quote_requests" ADD CONSTRAINT "quote_requests_followed_by_id_users_id_fk" FOREIGN KEY ("followed_by_id") REFERENCES "modulus"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."quote_requests" ADD CONSTRAINT "quote_requests_common_questionnaire_id_questionnaires_id_fk" FOREIGN KEY ("common_questionnaire_id") REFERENCES "modulus"."questionnaires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."quote_requests" ADD CONSTRAINT "quote_requests_family_questionnaire_id_questionnaires_id_fk" FOREIGN KEY ("family_questionnaire_id") REFERENCES "modulus"."questionnaires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."sold_configurations" ADD CONSTRAINT "sold_configurations_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "modulus"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulus"."sold_configurations" ADD CONSTRAINT "sold_configurations_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "modulus"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entries_occurred_at_idx" ON "modulus"."audit_entries" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "audit_entries_entity_idx" ON "modulus"."audit_entries" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "bom_lines_version_idx" ON "modulus"."bom_lines" USING btree ("version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bom_lines_article_idx" ON "modulus"."bom_lines" USING btree ("version_id","article");--> statement-breakpoint
CREATE UNIQUE INDEX "cost_budgets_version_post_idx" ON "modulus"."cost_budgets" USING btree ("machine_version_id","post") WHERE "modulus"."cost_budgets"."machine_version_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "cost_budgets_option_post_idx" ON "modulus"."cost_budgets" USING btree ("option_id","post") WHERE "modulus"."cost_budgets"."option_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "machine_versions_number_idx" ON "modulus"."machine_versions" USING btree ("machine_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "machine_versions_one_published_idx" ON "modulus"."machine_versions" USING btree ("machine_id") WHERE "modulus"."machine_versions"."state" = 'published';--> statement-breakpoint
CREATE INDEX "option_bom_deltas_option_idx" ON "modulus"."option_bom_deltas" USING btree ("option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "price_list_items_machine_idx" ON "modulus"."price_list_items" USING btree ("price_list_id","machine_id") WHERE "modulus"."price_list_items"."machine_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "price_list_items_option_idx" ON "modulus"."price_list_items" USING btree ("price_list_id","option_id") WHERE "modulus"."price_list_items"."option_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "deal_lines_number_idx" ON "modulus"."deal_lines" USING btree ("deal_id","number");--> statement-breakpoint
CREATE INDEX "knowhow_notes_option_idx" ON "modulus"."knowhow_notes" USING btree ("option_id");--> statement-breakpoint
CREATE INDEX "offer_reviews_offer_idx" ON "modulus"."offer_reviews" USING btree ("offer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offers_letter_idx" ON "modulus"."offers" USING btree ("deal_id","letter");--> statement-breakpoint
CREATE UNIQUE INDEX "project_feedback_stage_idx" ON "modulus"."project_feedback" USING btree ("sold_ref","stage");--> statement-breakpoint
CREATE UNIQUE INDEX "questionnaires_version_idx" ON "modulus"."questionnaires" USING btree ("family","version");--> statement-breakpoint
CREATE UNIQUE INDEX "questionnaires_one_published_idx" ON "modulus"."questionnaires" USING btree ("family") WHERE "modulus"."questionnaires"."state" = 'published';--> statement-breakpoint
CREATE UNIQUE INDEX "questionnaires_one_draft_idx" ON "modulus"."questionnaires" USING btree ("family") WHERE "modulus"."questionnaires"."state" = 'draft';--> statement-breakpoint
CREATE UNIQUE INDEX "questions_position_idx" ON "modulus"."questions" USING btree ("questionnaire_id","position");--> statement-breakpoint
CREATE INDEX "quote_messages_request_idx" ON "modulus"."quote_messages" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sold_configurations_version_idx" ON "modulus"."sold_configurations" USING btree ("ref","version");