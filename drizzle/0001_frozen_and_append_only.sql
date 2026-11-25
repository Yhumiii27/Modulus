-- Custom SQL migration file, put your code below! ---- What Modulus must never change (CLAUDE.md "What was sold is frozen", Norma § 4 "append-only audit trail"), enforced by the
-- database: the code checks again for a clear message, never alone. ERRCODE restrict_violation (23001) everywhere.

-- 1. Append-only tables: the audit trail, the offer reviews, the thread of a quotation request, the know-how notes.
CREATE OR REPLACE FUNCTION "modulus"."append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % refused', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation', HINT = 'This table can only be added to.';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "audit_entries_no_update_delete" BEFORE UPDATE OR DELETE ON "modulus"."audit_entries" FOR EACH ROW EXECUTE FUNCTION "modulus"."append_only"();
--> statement-breakpoint
CREATE TRIGGER "audit_entries_no_truncate" BEFORE TRUNCATE ON "modulus"."audit_entries" FOR EACH STATEMENT EXECUTE FUNCTION "modulus"."append_only"();
--> statement-breakpoint
CREATE TRIGGER "offer_reviews_no_update_delete" BEFORE UPDATE OR DELETE ON "modulus"."offer_reviews" FOR EACH ROW EXECUTE FUNCTION "modulus"."append_only"();
--> statement-breakpoint
CREATE TRIGGER "quote_messages_no_update_delete" BEFORE UPDATE OR DELETE ON "modulus"."quote_messages" FOR EACH ROW EXECUTE FUNCTION "modulus"."append_only"();
--> statement-breakpoint
CREATE TRIGGER "knowhow_notes_no_update_delete" BEFORE UPDATE OR DELETE ON "modulus"."knowhow_notes" FOR EACH ROW EXECUTE FUNCTION "modulus"."append_only"();
--> statement-breakpoint

-- 2. A published or retired machine version is frozen: only published → retired (with retired_at) may change; never deleted.
CREATE OR REPLACE FUNCTION "modulus"."machine_versions_frozen"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.state <> 'draft' THEN
      RAISE EXCEPTION 'machine version % is published and cannot be deleted', OLD.version USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.state = 'draft' THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - 'state' - 'retired_at' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'state' - 'retired_at' - 'updated_at')
     OR NOT (NEW.state = OLD.state OR (OLD.state = 'published' AND NEW.state = 'retired')) THEN
    RAISE EXCEPTION 'machine version % is published and frozen: create a new version', OLD.version USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "machine_versions_frozen" BEFORE UPDATE OR DELETE ON "modulus"."machine_versions" FOR EACH ROW EXECUTE FUNCTION "modulus"."machine_versions_frozen"();
--> statement-breakpoint

-- 3. The BOM lines and characteristics of a version change only while the version is a draft.
CREATE OR REPLACE FUNCTION "modulus"."version_children_draft_only"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v uuid;
BEGIN
  v := CASE WHEN TG_OP = 'DELETE' THEN OLD.version_id ELSE NEW.version_id END;
  IF EXISTS (SELECT 1 FROM "modulus"."machine_versions" m WHERE m.id = v AND m.state <> 'draft')
     OR (TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM "modulus"."machine_versions" m WHERE m.id = OLD.version_id AND m.state <> 'draft')) THEN
    RAISE EXCEPTION '%: the machine version is published and frozen', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "bom_lines_draft_only" BEFORE INSERT OR UPDATE OR DELETE ON "modulus"."bom_lines" FOR EACH ROW EXECUTE FUNCTION "modulus"."version_children_draft_only"();
--> statement-breakpoint
CREATE TRIGGER "version_characteristics_draft_only" BEFORE INSERT OR UPDATE OR DELETE ON "modulus"."version_characteristics" FOR EACH ROW EXECUTE FUNCTION "modulus"."version_children_draft_only"();
--> statement-breakpoint

-- 4. A published price list is frozen (only published → withdrawn), and so are its prices.
CREATE OR REPLACE FUNCTION "modulus"."price_lists_frozen"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.state IN ('published', 'withdrawn') THEN RAISE EXCEPTION 'price list % is published', OLD.code USING ERRCODE = 'restrict_violation'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.state NOT IN ('published', 'withdrawn') THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - 'state' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'state' - 'updated_at')
     OR NOT (NEW.state = OLD.state OR (OLD.state = 'published' AND NEW.state = 'withdrawn')) THEN
    RAISE EXCEPTION 'price list % is published and frozen', OLD.code USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "price_lists_frozen" BEFORE UPDATE OR DELETE ON "modulus"."price_lists" FOR EACH ROW EXECUTE FUNCTION "modulus"."price_lists_frozen"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "modulus"."price_list_items_draft_only"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE l uuid;
BEGIN
  l := CASE WHEN TG_OP = 'DELETE' THEN OLD.price_list_id ELSE NEW.price_list_id END;
  IF EXISTS (SELECT 1 FROM "modulus"."price_lists" p WHERE p.id = l AND p.state IN ('published', 'withdrawn')) THEN
    RAISE EXCEPTION 'price_list_items: the price list is published and frozen' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "price_list_items_draft_only" BEFORE INSERT OR UPDATE OR DELETE ON "modulus"."price_list_items" FOR EACH ROW EXECUTE FUNCTION "modulus"."price_list_items_draft_only"();
--> statement-breakpoint

-- 5. A sent offer is frozen: only its state moves (sent → accepted | declined) and its Codex reference is set once; never deleted.
CREATE OR REPLACE FUNCTION "modulus"."offers_frozen"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.state <> 'draft' THEN RAISE EXCEPTION 'offer % is sent and cannot be deleted', OLD.letter USING ERRCODE = 'restrict_violation'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.state = 'draft' THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - 'state' - 'codex_ref' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'state' - 'codex_ref' - 'updated_at')
     OR (OLD.codex_ref IS NOT NULL AND NEW.codex_ref IS DISTINCT FROM OLD.codex_ref)
     OR NOT (NEW.state = OLD.state OR (OLD.state = 'sent' AND NEW.state IN ('accepted', 'declined'))) THEN
    RAISE EXCEPTION 'offer % is sent and frozen: create a new offer', OLD.letter USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "offers_frozen" BEFORE UPDATE OR DELETE ON "modulus"."offers" FOR EACH ROW EXECUTE FUNCTION "modulus"."offers_frozen"();
--> statement-breakpoint

-- 6. A sold configuration is immutable (an amendment is a new version); only the Keystone project is set once.
CREATE OR REPLACE FUNCTION "modulus"."sold_configurations_frozen"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'sold configuration % is immutable', OLD.ref USING ERRCODE = 'restrict_violation'; END IF;
  IF (to_jsonb(NEW) - 'keystone_project') IS DISTINCT FROM (to_jsonb(OLD) - 'keystone_project')
     OR (OLD.keystone_project IS NOT NULL AND NEW.keystone_project IS DISTINCT FROM OLD.keystone_project) THEN
    RAISE EXCEPTION 'sold configuration % v% is immutable: record an amendment', OLD.ref, OLD.version USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "sold_configurations_frozen" BEFORE UPDATE OR DELETE ON "modulus"."sold_configurations" FOR EACH ROW EXECUTE FUNCTION "modulus"."sold_configurations_frozen"();
--> statement-breakpoint
CREATE TRIGGER "sold_configurations_no_truncate" BEFORE TRUNCATE ON "modulus"."sold_configurations" FOR EACH STATEMENT EXECUTE FUNCTION "modulus"."append_only"();
--> statement-breakpoint

-- 7. A published questionnaire is frozen (only published → retired), and its questions change only on a draft.
CREATE OR REPLACE FUNCTION "modulus"."questionnaires_frozen"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.state <> 'draft' THEN RAISE EXCEPTION 'questionnaire % v% is published', OLD.family, OLD.version USING ERRCODE = 'restrict_violation'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.state = 'draft' THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - 'state' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'state' - 'updated_at')
     OR NOT (NEW.state = OLD.state OR (OLD.state = 'published' AND NEW.state = 'retired')) THEN
    RAISE EXCEPTION 'questionnaire % v% is published and frozen', OLD.family, OLD.version USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "questionnaires_frozen" BEFORE UPDATE OR DELETE ON "modulus"."questionnaires" FOR EACH ROW EXECUTE FUNCTION "modulus"."questionnaires_frozen"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "modulus"."questions_draft_only"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE q uuid;
BEGIN
  q := CASE WHEN TG_OP = 'DELETE' THEN OLD.questionnaire_id ELSE NEW.questionnaire_id END;
  IF EXISTS (SELECT 1 FROM "modulus"."questionnaires" x WHERE x.id = q AND x.state <> 'draft') THEN
    RAISE EXCEPTION 'questions: the questionnaire is published and frozen' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "questions_draft_only" BEFORE INSERT OR UPDATE OR DELETE ON "modulus"."questions" FOR EACH ROW EXECUTE FUNCTION "modulus"."questions_draft_only"();
